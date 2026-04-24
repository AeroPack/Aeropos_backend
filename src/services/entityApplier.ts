import { PoolClient } from 'pg';
import { ValidTable, SOFT_DELETE_TABLES, TABLES_WITHOUT_UPDATED_AT, UUID_PK_TABLES } from '../validators/sync.validator';
import { TableUuidRefs, UuidRefField, OperationType } from '../types/sync.types';

const TABLE_UUID_REFS: Partial<Record<ValidTable, TableUuidRefs>> = {
  products: {
    uuidFields: [
      { clientField: 'category_uuid', targetTable: 'categories', resultField: 'category_id', optional: true },
      { clientField: 'unit_uuid', targetTable: 'units', resultField: 'unit_id', optional: true },
      { clientField: 'brand_uuid', targetTable: 'brands', resultField: 'brand_id', optional: true },
    ],
  },
  invoices: {
    uuidFields: [
      { clientField: 'customer_uuid', targetTable: 'customers', resultField: 'customer_id', optional: true },
    ],
  },
  invoice_items: {
    uuidFields: [
      { clientField: 'invoice_uuid', targetTable: 'invoices', resultField: 'invoice_id', optional: false },
      { clientField: 'product_uuid', targetTable: 'products', resultField: 'product_id', optional: true },
    ],
  },
};

export interface ResolveResult {
  resolved: Record<string, unknown>;
  missingRef?: { clientField: string; uuid: string; targetTable: string };
}

export interface ApplyResult {
  dataOld: Record<string, unknown> | null;
  dataNew: Record<string, unknown> | null;
}

/**
 * Resolve UUID references in incoming data.
 * Converts client-facing UUID fields to database integer IDs.
 */
export async function resolveUuidRefs(
  client: PoolClient,
  table: ValidTable,
  data: Record<string, unknown>,
  companyId: number,
): Promise<ResolveResult> {
  const refs = TABLE_UUID_REFS[table];
  if (!refs) return { resolved: { ...data } };

  const resolved: Record<string, unknown> = { ...data };

  for (const ref of refs.uuidFields) {
    const { clientField, targetTable, resultField, optional } = ref;
    const uuid = data[clientField];

    if (uuid === undefined || uuid === null) {
      if (optional) {
        resolved[resultField] = null;
        delete resolved[clientField];
      }
      continue;
    }

    if (typeof uuid !== 'string') {
      return {
        resolved,
        missingRef: { clientField, uuid: String(uuid), targetTable },
      };
    }

    const { rows } = await client.query<{ id: number }>(
      `SELECT id FROM ${targetTable}
       WHERE uuid = $1 AND company_id = $2 AND is_deleted = false LIMIT 1`,
      [uuid, companyId],
    );

    if (rows.length === 0) {
      if (optional) {
        resolved[resultField] = null;
        delete resolved[clientField];
        continue;
      }
      return {
        resolved,
        missingRef: { clientField, uuid, targetTable },
      };
    }

    delete resolved[clientField];
    resolved[resultField] = rows[0].id;
  }

  return { resolved };
}

/**
 * Apply operation to entity table.
 * 
 * Key features:
 * 1. UPSERT (ON CONFLICT) for INSERT - handles idempotency
 * 2. Timestamp conflict detection - prevents stale overwrites
 * 3. Returns server state on conflict for client resolution
 * 4. Soft delete support
 */
export async function applyToEntityTable(
  client: PoolClient,
  operation: OperationType,
  table: ValidTable,
  recordUuid: string,
  resolvedData: Record<string, unknown>,
  companyId: number,
  incomingTimestamp: Date,
): Promise<ApplyResult> {
  switch (operation) {
    case 'INSERT':
      return handleInsertOrUpsert(client, table, recordUuid, resolvedData, companyId, incomingTimestamp);
    case 'UPDATE':
      return handleUpdate(client, table, recordUuid, resolvedData, companyId, incomingTimestamp);
    case 'DELETE':
      return handleDelete(client, table, recordUuid, companyId, incomingTimestamp);
  }
}

/**
 * INSERT with UPSERT support.
 * Uses ON CONFLICT DO UPDATE to handle idempotency.
 * This allows the same operation to be retried safely.
 */
async function handleInsertOrUpsert(
  client: PoolClient,
  table: ValidTable,
  recordUuid: string,
  data: Record<string, unknown>,
  companyId: number,
  timestamp: Date,
): Promise<ApplyResult> {
  const isUuidPk = UUID_PK_TABLES.has(table);
  const hasUpdatedAt = !TABLES_WITHOUT_UPDATED_AT.has(table) || table === 'invoice_settings';

  const payload: Record<string, unknown> = {
    ...stripSystemFields(data, table),
    company_id: companyId,
    created_at: timestamp,
  };

  if (isUuidPk) {
    payload['id'] = recordUuid;
    payload['updated_at'] = timestamp;
  } else {
    payload['uuid'] = recordUuid;
    if (hasUpdatedAt) payload['updated_at'] = timestamp;
  }

  if (table === 'invoice_items') {
    delete payload['updated_at'];
  }

  const cols = Object.keys(payload);
  const vals = Object.values(payload);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

  const conflictTarget = isUuidPk ? '(id)' : '(uuid)';

  try {
    const { rows } = await client.query<Record<string, unknown>>(
      `INSERT INTO ${table} (${cols.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT ${conflictTarget} DO UPDATE SET
         updated_at = EXCLUDED.updated_at,
         company_id = EXCLUDED.company_id
       RETURNING *`,
      vals,
    );

    return { dataOld: null, dataNew: rows[0] ?? null };
  } catch (err) {
    console.error(`[entityApplier] INSERT/UPSERT error on ${table}:`, err);
    throw err;
  }
}

/**
 * UPDATE with conflict detection.
 * REJECTS if incoming timestamp is older than server.
 * Returns server state in error for client resolution.
 */
async function handleUpdate(
  client: PoolClient,
  table: ValidTable,
  recordUuid: string,
  data: Record<string, unknown>,
  companyId: number,
  incomingTimestamp: Date,
): Promise<ApplyResult> {
  const isUuidPk = UUID_PK_TABLES.has(table);
  const uuidCol = isUuidPk ? 'id' : 'uuid';
  const hasUpdatedAt = !TABLES_WITHOUT_UPDATED_AT.has(table) || table === 'invoice_settings';

  // Get current record
  const { rows: existing } = await client.query<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE ${uuidCol} = $1 AND company_id = $2 FOR UPDATE`,
    [recordUuid, companyId],
  );

  if (existing.length === 0) {
    const error = new Error(`Record ${recordUuid} not found in ${table}`) as Error & { code: string; serverState: Record<string, unknown> };
    error.code = 'NOT_FOUND';
    error.serverState = {};
    throw error;
  }

  const current = existing[0];

  // Conflict detection: reject if incoming is older
  if (hasUpdatedAt && table !== 'invoice_settings') {
    const serverUpdatedAt = current['updated_at'] as Date;
    if (incomingTimestamp <= serverUpdatedAt) {
      const error = new Error(
        `TIMESTAMP_CONFLICT: incoming ${incomingTimestamp.toISOString()} <= server ${serverUpdatedAt.toISOString()}`,
      ) as Error & { code: string; serverState: Record<string, unknown> };
      error.code = 'TIMESTAMP_CONFLICT';
      error.serverState = current;
      throw error;
    }
  }

  const patch: Record<string, unknown> = {
    ...stripSystemFields(data, table),
  };
  if (hasUpdatedAt) patch['updated_at'] = incomingTimestamp;

  const keys = Object.keys(patch);
  if (keys.length === 0) {
    return { dataOld: current, dataNew: current };
  }

  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const whereIdx1 = keys.length + 1;
  const whereIdx2 = keys.length + 2;

  const { rows: updated } = await client.query<Record<string, unknown>>(
    `UPDATE ${table} SET ${sets} WHERE ${uuidCol} = $${whereIdx1} AND company_id = $${whereIdx2} RETURNING *`,
    [...Object.values(patch), recordUuid, companyId],
  );

  return { dataOld: current, dataNew: updated[0] ?? null };
}

/**
 * DELETE with soft delete support.
 * Returns current state before deletion.
 */
async function handleDelete(
  client: PoolClient,
  table: ValidTable,
  recordUuid: string,
  companyId: number,
  timestamp: Date,
): Promise<ApplyResult> {
  const isUuidPk = UUID_PK_TABLES.has(table);
  const uuidCol = isUuidPk ? 'id' : 'uuid';
  const isSoftDelete = SOFT_DELETE_TABLES.has(table);

  const { rows: existing } = await client.query<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE ${uuidCol} = $1 AND company_id = $2 FOR UPDATE`,
    [recordUuid, companyId],
  );

  if (existing.length === 0) {
    return { dataOld: null, dataNew: null };
  }

  const current = existing[0];

  if (isSoftDelete) {
    const hasUpdatedAt = table !== 'invoice_items';
    const setClause = hasUpdatedAt
      ? `is_deleted = true, updated_at = $1`
      : `is_deleted = true`;
    const params = hasUpdatedAt
      ? [timestamp, recordUuid, companyId]
      : [recordUuid, companyId];
    const uuidParamIdx = hasUpdatedAt ? 2 : 1;
    const companyParamIdx = hasUpdatedAt ? 3 : 2;

    const { rows: deleted } = await client.query<Record<string, unknown>>(
      `UPDATE ${table} SET ${setClause} WHERE ${uuidCol} = $${uuidParamIdx} AND company_id = $${companyParamIdx} RETURNING *`,
      params,
    );
    return { dataOld: current, dataNew: deleted[0] ?? null };
  } else {
    await client.query(
      `DELETE FROM ${table} WHERE ${uuidCol} = $1 AND company_id = $2`,
      [recordUuid, companyId],
    );
    return { dataOld: current, dataNew: null };
  }
}

/**
 * Strip system-managed fields from incoming data.
 */
function stripSystemFields(
  data: Record<string, unknown>,
  table: ValidTable,
): Record<string, unknown> {
  const always = new Set([
    'id', 'uuid', 'company_id', 'created_at', 
    'updated_at', 'is_deleted', 'deleted_at'
  ]);
  return Object.fromEntries(
    Object.entries(data).filter(([k]) => !always.has(k)),
  );
}