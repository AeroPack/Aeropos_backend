import { PoolClient } from 'pg';
import { withTransaction } from '../db/transaction';
import { ValidatedOperation } from '../validators/sync.validator';
import { AcknowledgedOp, SyncErrorCode, SyncContext } from '../types/sync.types';
import { resolveUuidRefs } from '../utils/uuidResolver';
import { applyToEntityTable } from './entityApplier';
import { writeOperationLog } from '../utils/operationLog';

/**
 * Processes all inbound operations (push phase).
 * Each operation runs in its own transaction — one failure
 * does not roll back others.
 * Operations MUST be pre-sorted by timestamp ASC before calling.
 */
export async function processPushOperations(
  operations: ValidatedOperation[],
  ctx: SyncContext,
): Promise<AcknowledgedOp[]> {
  const acknowledged: AcknowledgedOp[] = [];
  for (const op of operations) {
    const ack = await processSingleOperation(op, ctx);
    acknowledged.push(ack);
  }
  return acknowledged;
}

async function processSingleOperation(
  op: ValidatedOperation,
  ctx: SyncContext,
): Promise<AcknowledgedOp> {
  try {
    return await withTransaction(async (client) => {
      // ── Step 1: Idempotency check ───────────────────────────
      const already = await checkIdempotency(client, op.opId, ctx.companyId);
      if (already) return success(op.opId);

      // ── Step 2: Validate data presence ─────────────────────
      if ((op.type === 'INSERT' || op.type === 'UPDATE') && !op.data) {
        return fail(op.opId, 'VALIDATION_ERROR', `data is required for ${op.type}`);
      }

      const rawData = op.data ?? {};
      const incomingTimestamp = new Date(op.timestamp);

      // ── Step 3: Resolve UUID references ────────────────────
      const { resolved, missingRef } = await resolveUuidRefs(
        client, op.table, rawData, ctx.companyId,
      );

      if (missingRef) {
        return fail(
          op.opId,
          'FOREIGN_KEY_NOT_FOUND',
          `Cannot resolve ${missingRef.clientField} = "${missingRef.uuid}" in "${missingRef.targetTable}"`,
        );
      }

      // ── Step 4: Apply to entity table ───────────────────────
      let dataOld: Record<string, unknown> | null = null;
      let dataNew: Record<string, unknown> | null = null;

      try {
        ({ dataOld, dataNew } = await applyToEntityTable(
          client, op.type, op.table, op.recordId,
          resolved, ctx.companyId, incomingTimestamp,
        ));
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        return fail(op.opId, mapErrorCode(e.code), e.message ?? 'Apply failed');
      }

      // ── Step 5: Write to operations_log ─────────────────────
      await writeOperationLog({
        client,
        opId:       op.opId,
        companyId:  ctx.companyId,
        deviceId:   ctx.deviceId,
        tableName:  op.table,
        recordUuid: op.recordId,
        operation:  op.type,
        dataOld,
        dataNew,
        timestamp:  incomingTimestamp,
      });

      return success(op.opId);
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error(`[sync push] unexpected error opId=${op.opId}:`, e);
    return fail(op.opId, 'UNKNOWN', e.message ?? 'Unexpected server error');
  }
}

// ── Idempotency check ─────────────────────────────────────────
async function checkIdempotency(
  client: PoolClient,
  opId: string,
  companyId: number,
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM sync_operations_log WHERE op_id = $1 AND company_id = $2 LIMIT 1`,
    [opId, companyId],
  );
  return rows.length > 0;
}

// ── Helpers ───────────────────────────────────────────────────
function success(opId: string): AcknowledgedOp {
  return { opId, status: 'SUCCESS' };
}

function fail(opId: string, code: SyncErrorCode, message: string): AcknowledgedOp {
  return { opId, status: 'FAILED', error: { code, message } };
}

function mapErrorCode(code: string | undefined): SyncErrorCode {
  const map: Record<string, SyncErrorCode> = {
    NOT_FOUND:             'NOT_FOUND',
    TIMESTAMP_CONFLICT:    'TIMESTAMP_CONFLICT',
    VALIDATION_ERROR:      'VALIDATION_ERROR',
    FOREIGN_KEY_NOT_FOUND: 'FOREIGN_KEY_NOT_FOUND',
    DUPLICATE:             'DUPLICATE',
  };
  return map[code ?? ''] ?? 'UNKNOWN';
}

