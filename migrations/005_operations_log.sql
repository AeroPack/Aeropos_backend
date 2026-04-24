-- ============================================================
--  NEW Sync Operations Log Table
--  This is for the new unified /api/sync endpoint
-- ============================================================

-- Create new sync_operations_log table (separate from old operations_log)
CREATE TABLE IF NOT EXISTS sync_operations_log (
  id           BIGSERIAL    PRIMARY KEY,
  op_id        UUID         NOT NULL UNIQUE,
  company_id   INTEGER      NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id    TEXT         NOT NULL,
  table_name   TEXT         NOT NULL,
  record_uuid  UUID         NOT NULL,
  operation    TEXT         NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  data_old     JSONB,
  data_new     JSONB,
  timestamp    TIMESTAMPTZ  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Indexes for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_sync_oplog_company_ts ON sync_operations_log (company_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_sync_oplog_op_id    ON sync_operations_log (op_id);

-- ============================================================
--  Note: Old operations_log table from 001_sync_core.sql
--  is kept for backward compatibility with stock sync.
-- ============================================================
