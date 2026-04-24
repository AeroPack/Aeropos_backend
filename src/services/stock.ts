import { query, queryOne, execute, getClient } from "../db/sync-db";
import type { StockOperation, StockServerOperation, StockRejectedOperation } from "../types/sync.types";

interface DbStockLedger {
  id: number;
  tenant_id: string;
  product_key: string;
  operation: string;
  quantity: number;
  reference_type: string | null;
  reference_key: string | null;
  version: number;
  idempotency_key: string | null;
  created_at: Date;
}

interface StockSnapshot {
  tenant_id: string;
  product_key: string;
  quantity: number;
  version: number;
}

export async function processStockOperations(
  tenantId: string,
  operations: StockOperation[]
): Promise<{ acked: string[]; rejected: StockRejectedOperation[]; currentStock: Record<string, number> }> {
  if (operations.length === 0) {
    return { acked: [], rejected: [], currentStock: {} };
  }

  const acked: string[] = [];
  const rejected: StockRejectedOperation[] = [];
  const currentStock: Record<string, number> = {};
  const affectedProducts = new Set<string>();

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const currentVersionResult = await client.query<{ max_version: string }>(
      "SELECT COALESCE(MAX(version), 0) as max_version FROM stock_ledger WHERE tenant_id = $1",
      [tenantId]
    );
    let currentVersion = parseInt(currentVersionResult.rows[0]?.max_version || "0", 10);

    const existingIdempotencyResult = await client.query<{ idempotency_key: string }>(
      `SELECT idempotency_key FROM stock_ledger 
       WHERE tenant_id = $1 AND idempotency_key = ANY($2)`,
      [tenantId, operations.map(op => op.idempotency_key)]
    );
    const existingIdempotencyKeys = new Set(existingIdempotencyResult.rows.map(r => r.idempotency_key));

    const validOps: StockOperation[] = [];

    for (const op of operations) {
      if (existingIdempotencyKeys.has(op.idempotency_key)) {
        acked.push(op.idempotency_key);
        continue;
      }

      validOps.push(op);
      affectedProducts.add(op.product_key);
    }

    if (validOps.length > 0) {
      const insertValues: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      for (const op of validOps) {
        currentVersion++;
        insertValues.push(
          `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${
            paramIndex++
          })`
        );
        params.push(
          tenantId,
          op.product_key,
          op.operation,
          op.quantity,
          op.reference_type || null,
          op.reference_key || null,
          currentVersion,
          op.idempotency_key,
          op.client_generated_at
        );
      }

      const insertQuery = `
        INSERT INTO stock_ledger 
        (tenant_id, product_key, operation, quantity, reference_type, reference_key, version, idempotency_key, created_at)
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
            reason: "DUPLICATE_OPERATION",
          });
        }
      }
    }

    for (const productKey of affectedProducts) {
      const stockResult = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(quantity), 0) as total 
         FROM stock_ledger 
         WHERE tenant_id = $1 AND product_key = $2`,
        [tenantId, productKey]
      );
      currentStock[productKey] = parseFloat(stockResult.rows[0]?.total || "0");
    }

    await updateStockSnapshots(client, tenantId, Array.from(affectedProducts));

    await client.query("COMMIT");

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { acked, rejected, currentStock };
}

async function updateStockSnapshots(
  client: Awaited<ReturnType<typeof getClient>>,
  tenantId: string,
  productKeys: string[]
): Promise<void> {
  if (productKeys.length === 0) return;

  const snapshotUpdates: string[] = [];
  const params: unknown[] = [tenantId];
  let paramIndex = 2;

  for (const productKey of productKeys) {
    snapshotUpdates.push(`WHEN product_key = $${paramIndex++} THEN (
      SELECT COALESCE(SUM(quantity), 0) FROM stock_ledger 
      WHERE tenant_id = $1 AND product_key = $${paramIndex - 1}
    )`);
    params.push(productKey);
  }

  const updateQuery = `
    INSERT INTO stock_snapshot (tenant_id, product_key, quantity, version, updated_at)
    VALUES ${productKeys.map((_, i) => `($${1}, $${2 + i}, 0, 0, NOW())`).join(", ")}
    ON CONFLICT (tenant_id, product_key) DO UPDATE SET
      quantity = EXCLUDED.quantity,
      version = stock_snapshot.version + 1,
      updated_at = NOW()
  `;

  await client.query(updateQuery, params);
}

export async function getStockChanges(
  tenantId: string,
  sinceLedgerId: number,
  limit: number = 200
): Promise<{ operations: StockServerOperation[]; lastLedgerId: number }> {
  const result = await query<DbStockLedger>(
    `SELECT id, operation, product_key, quantity, reference_type, reference_key, version, created_at
     FROM stock_ledger
     WHERE tenant_id = $1 AND id > $2
     ORDER BY id ASC
     LIMIT $3`,
    [tenantId, sinceLedgerId, limit]
  );

  const operations: StockServerOperation[] = result.map(row => ({
    id: row.id,
    operation: row.operation,
    product_key: row.product_key,
    quantity: row.quantity,
    reference_type: row.reference_type || undefined,
    reference_key: row.reference_key || undefined,
    version: row.version,
    server_generated_at: row.created_at.toISOString(),
  }));

  const lastLedgerId = operations.length > 0 ? operations[operations.length - 1].id : sinceLedgerId;

  return { operations, lastLedgerId };
}

export async function getCurrentStock(
  tenantId: string,
  productKeys: string[]
): Promise<Record<string, number>> {
  if (productKeys.length === 0) return {};

  const result = await query<StockSnapshot>(
    `SELECT product_key, quantity 
     FROM stock_snapshot 
     WHERE tenant_id = $1 AND product_key = ANY($2)`,
    [tenantId, productKeys]
  );

  const stock: Record<string, number> = {};
  for (const row of result) {
    stock[row.product_key] = parseFloat(row.quantity.toString());
  }

  return stock;
}