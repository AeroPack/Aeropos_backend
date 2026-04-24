// ============================================================
//  Types & Interfaces  (aligned to real schema)
// ============================================================

import { Request } from "express";

// ── Auth Request (for legacy middleware compatibility) ─────────
export type AuthRequest = Request & {
  tenantId?: string;
  tenantFk?: number;
  companyId?: number;
  userId?: string;
  role?: string;
  employeeId?: number | string;
  deviceId?: string;
  companyIds?: string[];
}

// ── Stock Sync Types ────────────────────────────────────────
export interface StockOperation {
  idempotency_key: string;
  product_key: string;
  operation: string;
  quantity: number;
  reference_type?: string;
  reference_key?: string;
  client_generated_at?: string;
}

export interface StockServerOperation {
  id: number;
  operation: string;
  product_key: string;
  quantity: number;
  reference_type?: string;
  reference_key?: string;
  version: number;
  server_generated_at: string;
}

export interface StockRejectedOperation {
  idempotency_key: string;
  reason: string;
}

// ── Sync error codes ──────────────────────────────────────────
export type SyncErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'FOREIGN_KEY_NOT_FOUND'
  | 'TIMESTAMP_CONFLICT'
  | 'DUPLICATE'
  | 'UNKNOWN';

// ── Per-operation result ──────────────────────────────────────
export interface OpError {
  code: SyncErrorCode;
  message: string;
  serverState?: Record<string, unknown>;  // For conflict resolution
}

export type AcknowledgedStatus = 'SUCCESS' | 'FAILED' | 'DUPLICATE';

export interface AcknowledgedOp {
  opId: string;
  status: AcknowledgedStatus;
  error?: OpError;
}

// ── Inbound operation from client ────────────────────────────
export type OperationType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface InboundOperation {
  opId: string;                  // UUID – idempotency key
  type: OperationType;
  table: string;
  recordId: string;              // UUID – maps to entity table's uuid column
  data?: Record<string, unknown>;
  timestamp: string;             // ISO 8601
}

// ── Sync request body ─────────────────────────────────────────
export interface SyncRequest {
  deviceId: string;
  lastPulledAt: string;          // ISO 8601
  operations: InboundOperation[];
}

// ── Outbound operation for pull ───────────────────────────────
export interface OutboundOperation {
  opId: string;
  type: OperationType;
  table: string;
  recordId: string;
  data: Record<string, unknown> | null;
  timestamp: string;
}

// ── Sync response ─────────────────────────────────────────────
export interface SyncResponse {
  serverTime: string;
  acknowledged: AcknowledgedOp[];
  operations: OutboundOperation[];
  nextCursor: string;
}

// ── Auth context attached by middleware ───────────────────────
// NOTE: your app has NO tenant_id — multi-tenancy is company_id only
export interface SyncContext {
  companyId: number;
  employeeId: string;   // JWT sub
  deviceId: string;
}

// ── UUID resolution map per table ─────────────────────────────
export interface UuidRefField {
  clientField: string;      // field name sent by Flutter e.g. "unit_uuid"
  targetTable: string;      // table to look up                e.g. "units"
  resultField: string;      // field to inject into payload    e.g. "unit_id"
  optional?: boolean;       // if true, missing ref is silently skipped
}

export interface TableUuidRefs {
  uuidFields: UuidRefField[];
}

// ── operations_log row ────────────────────────────────────────
export interface OperationLogRow {
  id: number;
  op_id: string;
  company_id: number;
  device_id: string;
  table_name: string;
  record_uuid: string;
  operation: OperationType;
  data_old: Record<string, unknown> | null;
  data_new: Record<string, unknown> | null;
  timestamp: Date;
  created_at: Date;
}

