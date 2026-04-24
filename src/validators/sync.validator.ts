import { z } from 'zod';

// ── Supported tables ──────────────────────────────────────────
export const VALID_TABLES = [
  'products',
  'categories',
  'units',
  'brands',
  'customers',
  'suppliers',
  'invoices',
  'invoice_items',
  'invoice_settings',
  'employees',
  'tasks',
  'role_permissions',
] as const;

/**
 * Tables that have NO updated_at column — LWW timestamp check is skipped for these.
 * invoice_items and role_permissions are insert-only or replaced wholesale.
 */
export const TABLES_WITHOUT_UPDATED_AT = new Set([
  'invoice_items',
  'invoice_settings',  // uses updated_at but no is_deleted — handled separately
  'role_permissions',
  'tasks',             // tasks.id is UUID PK, no updated_at
]);

/**
 * Tables that use soft-delete (is_deleted column).
 * Tables NOT in this set will use hard delete on DELETE operations.
 */
export const SOFT_DELETE_TABLES = new Set([
  'products',
  'categories',
  'units',
  'brands',
  'customers',
  'suppliers',
  'invoices',
  'invoice_items',
  'employees',
]);

/**
 * Tables where the PK uuid IS the record id (no separate integer PK).
 * tasks.id = UUID, not serial integer.
 */
export const UUID_PK_TABLES = new Set(['tasks']);

export type ValidTable = (typeof VALID_TABLES)[number];

// ── Single inbound operation ──────────────────────────────────
export const inboundOperationSchema = z.object({
  opId: z.string().uuid({ message: 'opId must be a valid UUID' }),
  type: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  table: z.enum(VALID_TABLES, {
    errorMap: () => ({ message: `table must be one of: ${VALID_TABLES.join(', ')}` }),
  }),
  recordId: z.string().uuid({ message: 'recordId must be a valid UUID' }),
  data: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime({ message: 'timestamp must be ISO 8601' }),
});

// ── Sync request body ─────────────────────────────────────────
export const syncRequestSchema = z.object({
  deviceId: z.string().min(1, 'deviceId is required'),
  lastPulledAt: z.string().datetime({ message: 'lastPulledAt must be ISO 8601' }),
  operations: z
    .array(inboundOperationSchema)
    .max(1000, 'Maximum 1000 operations per request'),
});

export type ValidatedSyncRequest = z.infer<typeof syncRequestSchema>;
export type ValidatedOperation = z.infer<typeof inboundOperationSchema>;

// ── Stock Sync ─────────────────────────────────────────────
const stockOperationSchema = z.object({
  idempotency_key: z.string().uuid(),
  product_key: z.string(),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  quantity: z.number(),
  reference_type: z.string().optional(),
  reference_key: z.string().optional(),
  client_generated_at: z.string().datetime().optional(),
});

export const stockSyncRequestSchema = z.object({
  client_id: z.string().uuid(),
  operations: z.array(stockOperationSchema).max(1000),
});

export const stockPullRequestSchema = z.object({
  last_ledger_id: z.number().optional(),
});
