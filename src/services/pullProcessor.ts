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
 * Production-grade pull processor.
 * 
 * Key improvements:
 * 1. Enforced max operations limit (prevent memory issues)
 * 2. Proper cursor-based pagination
 * 3. Scoped to company_id (security)
 * 4. Only returns NEW updates (not already synced)
 * 5. Ordered by timestamp for consistent results
 */
export async function fetchPullOperations(
  companyId: number,
  lastPulledAt: string,
): Promise<PullResult> {
  // Validate inputs
  if (!companyId || companyId <= 0) {
    console.error(`[pullProcessor] Invalid companyId: ${companyId}`);
    return { operations: [], nextCursor: lastPulledAt };
  }

  // Parse cursor
  let cursor: Date;
  try {
    cursor = lastPulledAt ? new Date(lastPulledAt) : new Date(0);
    if (isNaN(cursor.getTime())) {
      cursor = new Date(0);
    }
  } catch {
    cursor = new Date(0);
  }

  // Query for operations after cursor
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
      AND timestamp > $2
    ORDER BY timestamp ASC
    LIMIT $3`,
    [companyId, cursor, PULL_LIMIT],
  );

// Map to outbound operations
  const operations: OutboundOperation[] = rows.map((row) => ({
    opId: row.op_id,
    type: row.operation,
    table: row.table_name,
    recordId: row.record_uuid,
    data: row.data_new,
    timestamp: row.timestamp.toISOString(),
  }));

  // Calculate next cursor
  let nextCursor = lastPulledAt;
  if (operations.length > 0) {
    nextCursor = operations[operations.length - 1].timestamp;
  }

  // Log pull statistics
  console.log(`[pullProcessor] companyId=${companyId} pulled=${operations.length} cursor=${cursor.toISOString()}`);

  return { operations, nextCursor };
}