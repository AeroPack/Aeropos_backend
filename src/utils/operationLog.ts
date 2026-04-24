import { PoolClient } from 'pg';
import { OperationType } from '../types/sync.types';

interface WriteOpLogParams {
  client: PoolClient;
  opId: string;
  companyId: number;
  deviceId: string;
  tableName: string;
  recordUuid: string;
  operation: OperationType;
  dataOld: Record<string, unknown> | null;
  dataNew: Record<string, unknown> | null;
  timestamp: Date;
}

export async function writeOperationLog(params: WriteOpLogParams): Promise<void> {
  const {
    client, opId, companyId, deviceId,
    tableName, recordUuid, operation, dataOld, dataNew, timestamp,
  } = params;

  await client.query(
    `INSERT INTO sync_operations_log
       (op_id, company_id, device_id, table_name,
        record_uuid, operation, data_old, data_new, timestamp)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (op_id) DO NOTHING`,
    [
      opId, companyId, deviceId, tableName,
      recordUuid, operation,
      dataOld ? JSON.stringify(dataOld) : null,
      dataNew  ? JSON.stringify(dataNew)  : null,
      timestamp,
    ],
  );
}

