import { Request } from "express";

export interface AuthRequest extends Request {
  tenantId?: string;
  deviceId?: string;
  userId?: string;
  role?: string;
  companyIds?: string[];
}

export interface Operation {
  idempotency_key: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record_key: string;
  payload: {
    old: Record<string, unknown> | null;
    new: Record<string, unknown> | null;
  };
  version: number;
  client_generated_at: string;
}

export interface SyncRequest {
  tenant_id: string;
  client_id: string;
  cursor: number;
  operations?: Operation[];
  page_size?: number;
  page_token?: string;
}

export interface SyncResponse {
  cursor: number;
  acked: string[];
  rejected: RejectedOperation[];
  server_changes: ServerOperation[];
  next_page_token?: string;
  has_more?: boolean;
}

export interface RejectedOperation {
  idempotency_key: string;
  reason: "VERSION_CONFLICT" | "INVALID_TABLE" | "INVALID_OPERATION";
  server_version?: number;
  current_state?: Record<string, unknown>;
}

export interface ServerOperation {
  id: number;
  operation: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record_key: string;
  payload: {
    old: Record<string, unknown> | null;
    new: Record<string, unknown> | null;
  };
  version: number;
  server_generated_at: string;
}

export interface StockOperation {
  idempotency_key: string;
  operation: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT";
  product_key: string;
  quantity: number;
  reference_type?: string;
  reference_key?: string;
  client_generated_at: string;
}

export interface StockSyncRequest {
  tenant_id: string;
  client_id: string;
  operations?: StockOperation[];
  last_ledger_id?: number;
}

export interface StockSyncResponse {
  acked: string[];
  rejected: StockRejectedOperation[];
  current_stock?: Record<string, number>;
  last_ledger_id?: number;
  operations?: StockServerOperation[];
}

export interface StockRejectedOperation {
  idempotency_key: string;
  reason: string;
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