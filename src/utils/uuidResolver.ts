import { PoolClient } from 'pg';
import { ValidTable } from '../validators/sync.validator';
import { TableUuidRefs, UuidRefField } from '../types/sync.types';

// ── UUID reference map aligned to your real schema ────────────
//
//  Rules:
//  - optional: true  → if uuid field is absent or null, silently skip (nullable FK)
//  - optional: false → if uuid field is present but unresolvable, FAIL the op
//
const TABLE_UUID_REFS: Partial<Record<ValidTable, TableUuidRefs>> = {
  products: {
    uuidFields: [
      // category_id, unit_id, brand_id are all nullable FKs in your schema
      { clientField: 'category_uuid', targetTable: 'categories', resultField: 'category_id', optional: true },
      { clientField: 'unit_uuid',     targetTable: 'units',      resultField: 'unit_id',     optional: true },
      { clientField: 'brand_uuid',    targetTable: 'brands',     resultField: 'brand_id',    optional: true },
    ],
  },
  invoices: {
    uuidFields: [
      // customer_id is nullable on invoices (walk-in customers)
      { clientField: 'customer_uuid', targetTable: 'customers', resultField: 'customer_id', optional: true },
    ],
  },
  invoice_items: {
    uuidFields: [
      // invoice_id is required; product_id is nullable (custom line items)
      { clientField: 'invoice_uuid', targetTable: 'invoices',  resultField: 'invoice_id', optional: false },
      { clientField: 'product_uuid', targetTable: 'products',  resultField: 'product_id', optional: true  },
    ],
  },
  // employees, customers, suppliers, brands, units, categories:
  //   no FK references to other syncable entities — no resolver entry needed
  // invoice_settings: no FK refs to syncable entities
  // tasks: no FK refs to syncable entities
  // role_permissions: no FK refs to syncable entities
};

export interface ResolveResult {
  resolved: Record<string, unknown>;
  missingRef?: { clientField: string; uuid: string; targetTable: string };
}

/**
 * Resolves all UUID reference fields in `data` to internal integer IDs.
 * Scoped to companyId for tenant isolation.
 *
 * Optional refs: if the client omits the field or sends null → skip silently.
 * Required refs: if the client sends a value that can't be resolved → FAIL.
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

    // Field absent or null
    if (uuid === undefined || uuid === null) {
      if (optional) {
        // Ensure the target ID field is explicitly set to null (don't leave it undefined)
        resolved[resultField] = null;
        delete resolved[clientField];
      }
      // If required and missing, the Zod validator should have caught it already;
      // but if somehow here, just skip and let the DB NOT NULL constraint catch it.
      continue;
    }

    if (typeof uuid !== 'string') {
      return {
        resolved,
        missingRef: { clientField, uuid: String(uuid), targetTable },
      };
    }

    // categories and units don't have a UNIQUE constraint on uuid in your schema
    // (they have uuid column but it's not explicitly UNIQUE — safe to query by it)
    const { rows } = await client.query<{ id: number }>(
      `SELECT id FROM ${targetTable}
       WHERE uuid = $1
         AND company_id = $2
         AND is_deleted = false
       LIMIT 1`,
      [uuid, companyId],
    );

    if (rows.length === 0) {
      if (optional) {
        // Ref provided but target deleted or doesn't exist — set to null gracefully
        resolved[resultField] = null;
        delete resolved[clientField];
        continue;
      }
      // Required ref not found
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
