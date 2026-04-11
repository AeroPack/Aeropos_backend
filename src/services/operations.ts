import { query, queryOne, execute, getClient } from "../db/sync-db";
import type { Operation, ServerOperation, RejectedOperation } from "../types/sync";

interface DbOperation {
  id: number;
  tenant_id: string;
  operation: string;
  table_name: string;
  record_key: string;
  payload: Record<string, unknown>;
  version: number;
  idempotency_key: string | null;
  server_generated_at: Date;
}

const VALID_TABLES = [
  "products", "categories", "units", "brands",
  "customers", "suppliers", "invoices", "invoice_items",
  "employees", "tenant_settings"
];

export async function processOperations(
  tenantId: string,
  clientId: string,
  operations: Operation[]
): Promise<{ acked: string[]; rejected: RejectedOperation[] }> {
  if (operations.length === 0) {
    return { acked: [], rejected: [] };
  }

  const acked: string[] = [];
  const rejected: RejectedOperation[] = [];

  const client = await getClient();
  
  try {
    await client.query("BEGIN");

    const currentVersionResult = await client.query<{ max_version: string }>(
      "SELECT COALESCE(MAX(version), 0) as max_version FROM operations_log WHERE tenant_id = $1",
      [tenantId]
    );
    let currentVersion = parseInt(currentVersionResult.rows[0]?.max_version || "0", 10);

    const existingIdempotencyResult = await client.query<{ idempotency_key: string }>(
      `SELECT idempotency_key FROM operations_log 
       WHERE tenant_id = $1 AND idempotency_key = ANY($2)`,
      [tenantId, operations.map(op => op.idempotency_key)]
    );
    const existingIdempotencyKeys = new Set(existingIdempotencyResult.rows.map(r => r.idempotency_key));

    const validOps: Operation[] = [];
    const versionConflicts: Map<string, number> = new Map();

    for (const op of operations) {
      if (!VALID_TABLES.includes(op.table)) {
        rejected.push({
          idempotency_key: op.idempotency_key,
          reason: "INVALID_TABLE",
        });
        continue;
      }

      if (existingIdempotencyKeys.has(op.idempotency_key)) {
        acked.push(op.idempotency_key);
        continue;
      }

      if (op.operation === "INSERT" || op.operation === "UPDATE") {
        if (!op.payload.new) {
          rejected.push({
            idempotency_key: op.idempotency_key,
            reason: "INVALID_OPERATION",
          });
          continue;
        }

        const existingRecord = await client.query<{ version: number }>(
          `SELECT version FROM ${op.table} WHERE uuid = $1 AND company_id IN 
           (SELECT id FROM companies WHERE tenant_id = $1)`,
          [op.record_key, tenantId]
        );

        if (existingRecord.rows.length > 0) {
          const serverVersion = existingRecord.rows[0].version;
          if (op.version <= serverVersion) {
            versionConflicts.set(op.idempotency_key, serverVersion);
            continue;
          }
        }
      }

      validOps.push(op);
    }

    if (validOps.length > 0) {
      const insertValues: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      for (const op of validOps) {
        currentVersion++;
        insertValues.push(
          `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, NOW(), $${paramIndex++})`
        );
        params.push(
          tenantId,
          op.operation,
          op.table,
          op.record_key,
          JSON.stringify(op.payload),
          currentVersion,
          op.idempotency_key,
          op.client_generated_at,
          clientId
        );
      }

      const insertQuery = `
        INSERT INTO operations_log 
        (tenant_id, operation, table_name, record_key, payload, version, idempotency_key, client_generated_at, server_generated_at, client_id)
        VALUES ${insertValues.join(", ")}
        ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
        RETURNING idempotency_key
      `;

      const insertResult = await client.query(insertQuery, params);
      
      for (const op of validOps) {
        if (insertResult.rows.some(r => r.idempotency_key === op.idempotency_key)) {
          acked.push(op.idempotency_key);
        } else {
          rejected.push({
            idempotency_key: op.idempotency_key,
            reason: "INVALID_OPERATION",
          });
        }
      }
    }

    for (const [idempotencyKey, serverVersion] of versionConflicts) {
      const conflictRecord = await queryOne<Record<string, unknown>>(
        `SELECT * FROM ${operations.find(op => op.idempotency_key === idempotencyKey)?.table || "products"} 
         WHERE uuid = $1`,
        [operations.find(op => op.idempotency_key === idempotencyKey)?.record_key]
      );

      rejected.push({
        idempotency_key: idempotencyKey,
        reason: "VERSION_CONFLICT",
        server_version: serverVersion,
        current_state: conflictRecord || undefined,
      });
    }

    await client.query("COMMIT");

    await updateCursor(tenantId, clientId, currentVersion);

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { acked, rejected };
}

export async function getServerChanges(
  tenantId: string,
  sinceVersion: number,
  limit: number = 500,
  pageToken?: string
): Promise<{ operations: ServerOperation[]; nextCursor: number; hasMore: boolean }> {
  const offset = pageToken ? parseInt(Buffer.from(pageToken, "base64").toString(), 10) : 0;

  const result = await query<DbOperation>(
    `SELECT id, operation, table_name, record_key, payload, version, server_generated_at
     FROM operations_log
     WHERE tenant_id = $1 AND version > $2
     ORDER BY version ASC
     LIMIT $3 OFFSET $4`,
    [tenantId, sinceVersion, limit, offset]
  );

  const operations: ServerOperation[] = result.map(row => ({
    id: row.id,
    operation: row.operation as "INSERT" | "UPDATE" | "DELETE",
    table: row.table_name,
    record_key: row.record_key,
    payload: row.payload as { old: Record<string, unknown> | null; new: Record<string, unknown> | null },
    version: row.version,
    server_generated_at: row.server_generated_at.toISOString(),
  }));

  const lastVersion = operations.length > 0 ? operations[operations.length - 1].version : sinceVersion;
  const hasMore = result.length === limit;
  const nextCursor = hasMore ? lastVersion : sinceVersion;

  return {
    operations,
    nextCursor,
    hasMore,
  };
}

export async function updateCursor(
  tenantId: string,
  clientId: string,
  lastVersion: number
): Promise<void> {
  await execute(
    `INSERT INTO sync_cursors (tenant_id, client_id, last_version_synced, last_ack_version, updated_at)
     VALUES ($1, $2, $3, $3, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       client_id = EXCLUDED.client_id,
       last_version_synced = GREATEST(sync_cursors.last_version_synced, EXCLUDED.last_version_synced),
       last_ack_version = GREATEST(sync_cursors.last_ack_version, EXCLUDED.last_ack_version),
       updated_at = NOW()`,
    [tenantId, clientId, lastVersion]
  );
}

export async function getCursor(tenantId: string): Promise<number> {
  const result = await queryOne<{ last_version_synced: string }>(
    "SELECT last_version_synced FROM sync_cursors WHERE tenant_id = $1",
    [tenantId]
  );
  return result ? parseInt(result.last_version_synced, 10) : 0;
}