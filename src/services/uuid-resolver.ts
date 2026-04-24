import { db } from "../db";
import { units, categories, brands, products } from "../db/schema";
import { eq, and } from "drizzle-orm";

export interface ResolvedIds {
  unitId?: number;
  categoryId?: number;
  brandId?: number;
}

export interface ResolveError {
  error: string;
  field: string;
  message: string;
}

export interface DependencyCheckResult {
  success: boolean;
  error?: ResolveError;
}

export async function resolveUnitUuid(
  uuid: string | undefined,
  companyId: number
): Promise<{ id?: number; error?: ResolveError }> {
  if (!uuid) {
    return { id: undefined };
  }

  const [unit] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.uuid, uuid), eq(units.companyId, companyId), eq(units.isDeleted, false)));

  if (!unit) {
    return {
      error: {
        error: "NOT_FOUND",
        field: "unitUuid",
        message: `Unit with UUID ${uuid} not found or deleted`,
      },
    };
  }

  return { id: unit.id };
}

export async function resolveCategoryUuid(
  uuid: string | undefined,
  companyId: number
): Promise<{ id?: number; error?: ResolveError }> {
  if (!uuid) {
    return { id: undefined };
  }

  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.uuid, uuid), eq(categories.companyId, companyId), eq(categories.isDeleted, false)));

  if (!category) {
    return {
      error: {
        error: "NOT_FOUND",
        field: "categoryUuid",
        message: `Category with UUID ${uuid} not found or deleted`,
      },
    };
  }

  return { id: category.id };
}

export async function resolveBrandUuid(
  uuid: string | undefined,
  companyId: number
): Promise<{ id?: number; error?: ResolveError }> {
  if (!uuid) {
    return { id: undefined };
  }

  const [brand] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.uuid, uuid), eq(brands.companyId, companyId), eq(brands.isDeleted, false)));

  if (!brand) {
    return {
      error: {
        error: "NOT_FOUND",
        field: "brandUuid",
        message: `Brand with UUID ${uuid} not found or deleted`,
      },
    };
  }

  return { id: brand.id };
}

export async function resolveProductUuids(
  unitUuid: string | undefined,
  categoryUuid: string | undefined,
  brandUuid: string | undefined,
  companyId: number
): Promise<{ resolved: ResolvedIds; error?: ResolveError }> {
  const resolved: ResolvedIds = {};

  if (unitUuid) {
    const unitResult = await resolveUnitUuid(unitUuid, companyId);
    if (unitResult.error) {
      return { resolved, error: unitResult.error };
    }
    resolved.unitId = unitResult.id;
  }

  if (categoryUuid) {
    const categoryResult = await resolveCategoryUuid(categoryUuid, companyId);
    if (categoryResult.error) {
      return { resolved, error: categoryResult.error };
    }
    resolved.categoryId = categoryResult.id;
  }

  if (brandUuid) {
    const brandResult = await resolveBrandUuid(brandUuid, companyId);
    if (brandResult.error) {
      return { resolved, error: brandResult.error };
    }
    resolved.brandId = brandResult.id;
  }

  return { resolved };
}

export async function checkProductDependencies(
  unitUuid: string | undefined,
  categoryUuid: string | undefined,
  brandUuid: string | undefined,
  companyId: number,
  requireAll: boolean = false
): Promise<DependencyCheckResult> {
  const errors: ResolveError[] = [];

  if (unitUuid || requireAll) {
    const unitResult = await resolveUnitUuid(unitUuid, companyId);
    if (unitResult.error) {
      errors.push(unitResult.error);
    }
  }

  if (categoryUuid || requireAll) {
    const categoryResult = await resolveCategoryUuid(categoryUuid, companyId);
    if (categoryResult.error) {
      errors.push(categoryResult.error);
    }
  }

  if (brandUuid || requireAll) {
    const brandResult = await resolveBrandUuid(brandUuid, companyId);
    if (brandResult.error) {
      errors.push(brandResult.error);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: errors[0],
    };
  }

  return { success: true };
}

export async function findExistingByUuid(
  table: typeof units | typeof categories | typeof brands | typeof products,
  uuid: string,
  companyId: number,
  includeDeleted: boolean = false
): Promise<{ exists: boolean; id?: number }> {
  const conditions = [
    eq(table.uuid as any, uuid),
    eq((table as any).companyId as any, companyId),
  ];
  
  if (!includeDeleted) {
    conditions.push(eq((table as any).isDeleted as any, false));
  }
  
  const [record] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(...conditions));

  return { exists: !!record, id: record?.id };
}

export async function findUnitByUuid(
  uuid: string,
  companyId: number
): Promise<{ exists: boolean; id?: number }> {
  const [unit] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.uuid, uuid), eq(units.companyId, companyId), eq(units.isDeleted, false)));

  return { exists: !!unit, id: unit?.id };
}

export async function findCategoryByUuid(
  uuid: string,
  companyId: number
): Promise<{ exists: boolean; id?: number }> {
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.uuid, uuid), eq(categories.companyId, companyId), eq(categories.isDeleted, false)));

  return { exists: !!category, id: category?.id };
}

export async function findBrandByUuid(
  uuid: string,
  companyId: number
): Promise<{ exists: boolean; id?: number }> {
  const [brand] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.uuid, uuid), eq(brands.companyId, companyId), eq(brands.isDeleted, false)));

  return { exists: !!brand, id: brand?.id };
}

export async function findProductByUuid(
  uuid: string,
  companyId: number
): Promise<{ exists: boolean; id?: number }> {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.uuid, uuid), eq(products.companyId, companyId), eq(products.isDeleted, false)));

  return { exists: !!product, id: product?.id };
}