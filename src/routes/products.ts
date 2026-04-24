import { Router } from "express";
import { db } from "../db";
import { products, NewProduct, units, categories, brands } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";
import { checkPermission } from "../middleware/checkPermission";
import { checkDeprecatedFields } from "../middleware/validate";
import { resolveProductUuids, findProductByUuid } from "../services/uuid-resolver";

const productRouter = Router();

productRouter.use(auth);
productRouter.use(checkDeprecatedFields);

productRouter.get("/", checkPermission('VIEW_PRODUCTS'), async (req: AuthRequest, res) => {
    try {
        const { updatedSince } = req.query;
        let query = db.select().from(products).where(
            and(
                eq(products.companyId, req.companyId!),
                eq(products.isDeleted, false)
            )
        );

        if (updatedSince) {
            query = db.select().from(products).where(
                and(
                    eq(products.companyId, req.companyId!),
                    eq(products.isDeleted, false),
                    gt(products.updatedAt, new Date(updatedSince as string))
                )
            );
        }

        const allProducts = await query;
        res.json(allProducts);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

productRouter.get("/:uuid", checkPermission('VIEW_PRODUCTS'), async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const [product] = await db
            .select()
            .from(products)
            .where(
                and(
                    eq(products.uuid, uuid),
                    eq(products.companyId, req.companyId!)
                )
            );

        if (!product) {
            res.status(404).json({ error: "NOT_FOUND", field: "uuid", message: "Product not found" });
            return;
        }

        res.json(product);
    } catch (e) {
        res.status(500).json({ error: "INTERNAL_ERROR", message: e });
    }
});

productRouter.post("/", checkPermission('MANAGE_PRODUCTS'), async (req: AuthRequest, res) => {
    try {
        const isArray = Array.isArray(req.body);
        const productData = isArray ? req.body : [req.body];
        const results = [];

        console.log(`[SYNC] Products POST received ${productData.length} item(s) from company ${req.companyId}`);

        for (const item of productData) {
            const { uuid, unitUuid, categoryUuid, brandUuid, ...rest } = item;
            
            console.log(`[SYNC] Processing product: uuid=${uuid}, unitUuid=${unitUuid}, categoryUuid=${categoryUuid}, brandUuid=${brandUuid}`);

            const { resolved, error: resolveError } = await resolveProductUuids(
                unitUuid,
                categoryUuid,
                brandUuid,
                req.companyId!
            );

            if (resolveError) {
                console.log(`[SYNC] UUID resolution failed: ${resolveError.error} - ${resolveError.message}`);
                res.status(400).json({
                    error: "INVALID_REFERENCE",
                    field: resolveError.field,
                    message: resolveError.message,
                });
                return;
            }

            console.log(`[SYNC] Resolved IDs: unitId=${resolved.unitId}, categoryId=${resolved.categoryId}, brandId=${resolved.brandId}`);

            let unitId = resolved.unitId;
            let categoryId = resolved.categoryId;
            let brandId = resolved.brandId;

            const now = new Date();
            const incomingUpdatedAt = item.updatedAt ? new Date(item.updatedAt) : now;

            if (uuid) {
                const existing = await findProductByUuid(uuid, req.companyId!);

                if (existing.exists) {
                    const [existingProduct] = await db
                        .select({ updatedAt: products.updatedAt })
                        .from(products)
                        .where(and(eq(products.uuid, uuid), eq(products.companyId, req.companyId!)));
                    
                    const existingUpdatedAt = existingProduct?.updatedAt ? new Date(existingProduct.updatedAt) : new Date(0);
                    
                    if (incomingUpdatedAt <= existingUpdatedAt) {
                        console.log(`[SYNC] Product ${uuid} skipped - incoming (${incomingUpdatedAt.toISOString()}) is not newer than existing (${existingUpdatedAt.toISOString()})`);
                        continue;
                    }
                    
                    console.log(`[SYNC] Product ${uuid} updating (timestamp conflict resolved)`);
                    const updateData: Partial<NewProduct> = {
                        ...rest,
                        ...(unitId !== undefined && { unitId }),
                        ...(categoryId !== undefined && { categoryId }),
                        ...(brandId !== undefined && { brandId }),
                        updatedAt: now,
                    };
                    const [updated] = await db
                        .update(products)
                        .set(updateData)
                        .where(and(eq(products.uuid, uuid), eq(products.companyId, req.companyId!)))
                        .returning();
                    results.push(updated);
                    continue;
                }
            }

            const newProduct: NewProduct = {
                ...rest,
                ...(uuid ? { uuid } : {}),
                unitId,
                categoryId,
                brandId,
                companyId: req.companyId!,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const [createdProduct] = await db
                .insert(products)
                .values(newProduct)
                .returning();
            
            console.log(`[SYNC] Created product: ${createdProduct.uuid} with id=${createdProduct.id}`);
            results.push(createdProduct);
        }

        res.status(isArray ? 200 : (results.length > 0 ? 201 : 200)).json(isArray ? results : results[0]);
    } catch (e) {
        console.error("Product POST error:", e);
        res.status(500).json({ error: e });
    }
});

productRouter.put("/:uuid", checkPermission('MANAGE_PRODUCTS'), async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const { unitUuid, categoryUuid, brandUuid, ...rest } = req.body;

        console.log(`[SYNC] Products PUT for ${uuid}: unitUuid=${unitUuid}, categoryUuid=${categoryUuid}, brandUuid=${brandUuid}`);

        const { resolved, error: resolveError } = await resolveProductUuids(
            unitUuid,
            categoryUuid,
            brandUuid,
            req.companyId!
        );

        if (resolveError) {
            console.log(`[SYNC] UUID resolution failed: ${resolveError.error} - ${resolveError.message}`);
            res.status(400).json(resolveError);
            return;
        }

        console.log(`[SYNC] Resolved IDs: unitId=${resolved.unitId}, categoryId=${resolved.categoryId}, brandId=${resolved.brandId}`);

        let unitId = resolved.unitId ?? rest.unitId;
        let categoryId = resolved.categoryId ?? rest.categoryId;
        let brandId = resolved.brandId ?? rest.brandId;

        const updatedProduct: Partial<NewProduct> = {
            ...rest,
            ...(unitId !== undefined && { unitId }),
            ...(categoryId !== undefined && { categoryId }),
            ...(brandId !== undefined && { brandId }),
            updatedAt: new Date(),
        };
        const [result] = await db
            .update(products)
            .set(updatedProduct)
            .where(
                and(
                    eq(products.uuid, uuid),
                    eq(products.companyId, req.companyId!)
                )
            )
            .returning();

        if (!result) {
            res.status(404).json({ error: "NOT_FOUND", field: "uuid", message: "Product not found" });
            return;
        }

        console.log(`[SYNC] Updated product: ${uuid}`);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: "INTERNAL_ERROR", message: String(e) });
    }
});

productRouter.delete("/:uuid", checkPermission('MANAGE_PRODUCTS'), async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const now = new Date();
        const [deletedProduct] = await db
            .update(products)
            .set({ isDeleted: true, deletedAt: now, updatedAt: now })
            .where(
                and(
                    eq(products.uuid, uuid),
                    eq(products.companyId, req.companyId!)
                )
            )
            .returning();

        if (!deletedProduct) {
            res.status(404).json({ error: "NOT_FOUND", field: "uuid", message: "Product not found" });
            return;
        }

        res.json(deletedProduct);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

export default productRouter;