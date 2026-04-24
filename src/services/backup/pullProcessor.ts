import { pool } from '../db/sync-db';
import { OutboundOperation, OperationType } from '../types/sync.types';

const PULL_LIMIT = 500;

interface PullResult {
  operations: OutboundOperation[];
  nextCursor: string;
}

interface PullRow {
  op_id: string;
  operation: OperationType;
  table_name: string;
  record_uuid: string;
  data_new: Record<string, unknown> | null;
  timestamp: Date;
}

/**
 * Fetches operations since lastPulledAt for this company.
 * Scoped to company_id — no cross-company data ever returned.
 */
export async function fetchPullOperations(
  companyId: number,
  lastPulledAt: string,
): Promise<PullResult> {
  const cursor = new Date(lastPulledAt);

  const { rows } = await pool.query<PullRow>(
    `SELECT
       op_id,
       operation,
       table_name,
       record_uuid,
       data_new,
       timestamp
     FROM sync_operations_log
     WHERE company_id = $1
       AND timestamp  > $2
     ORDER BY timestamp ASC
     LIMIT $3`,
    [companyId, cursor, PULL_LIMIT],
  );

  const operations: OutboundOperation[] = rows.map((row) => ({
    opId:      row.op_id,
    type:      row.operation,
    table:     row.table_name,
    recordId:  row.record_uuid,
    data:      row.data_new,
    timestamp: row.timestamp.toISOString(),
  }));

  const nextCursor =
    operations.length > 0
      ? operations[operations.length - 1].timestamp
      : lastPulledAt;

  return { operations, nextCursor };
}

