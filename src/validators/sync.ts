import { z } from "zod";

const operationType = z.enum(["INSERT", "UPDATE", "DELETE"]);
const stockOperationType = z.enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"]);

const payloadSchema = z.object({
  old: z.record(z.unknown()).nullable(),
  new: z.record(z.unknown()).nullable(),
});

export const operationSchema = z.object({
  idempotency_key: z.string().uuid(),
  operation: operationType,
  table: z.string().min(1).max(50),
  record_key: z.string().uuid(),
  payload: payloadSchema,
  version: z.number().int().positive(),
  client_generated_at: z.string().datetime(),
});

export const syncRequestSchema = z.object({
  tenant_id: z.string().min(1).max(50),
  client_id: z.string().min(1).max(100),
  cursor: z.number().int().min(0),
  operations: operationSchema.array().max(500).optional(),
  page_size: z.number().int().min(1).max(500).optional(),
  page_token: z.string().optional(),
});

export const stockOperationSchema = z.object({
  idempotency_key: z.string().uuid(),
  operation: stockOperationType,
  product_key: z.string().uuid(),
  quantity: z.number(),
  reference_type: z.string().optional(),
  reference_key: z.string().uuid().optional(),
  client_generated_at: z.string().datetime(),
});

export const stockSyncRequestSchema = z.object({
  tenant_id: z.string().min(1).max(50),
  client_id: z.string().min(1).max(100),
  operations: stockOperationSchema.array().max(200).optional(),
  last_ledger_id: z.number().int().min(0).optional(),
});

export const pullRequestSchema = z.object({
  tenant_id: z.string().min(1).max(50),
  cursor: z.number().int().min(0),
  page_size: z.number().int().min(1).max(500).optional(),
  page_token: z.string().optional(),
});

export const stockPullRequestSchema = z.object({
  tenant_id: z.string().min(1).max(50),
  last_ledger_id: z.number().int().min(0),
});