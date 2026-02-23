import { Router } from "express";
import { db } from "../db";
import { products, NewProduct, units, categories, brands } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";
import { checkPermission } from "../middleware/checkPermission";

const productRouter = Router();

// All product routes require authentication
productRouter.use(auth);

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
            res.status(404).json({ error: "Product not found" });
            return;
        }

        res.json(product);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

productRouter.post("/", checkPermission('MANAGE_PRODUCTS'), async (req: AuthRequest, res) => {
    try {
        const { uuid, unitUuid, categoryUuid, brandUuid, ...rest } = req.body;
        let unitId = rest.unitId;
        let categoryId = rest.categoryId;
        let brandId = rest.brandId;

        if (unitUuid) {
            const [unit] = await db
                .select({ id: units.id })
                .from(units)
                .where(and(eq(units.uuid, unitUuid), eq(units.companyId, req.companyId!)));
            if (unit) unitId = unit.id;
        }

        if (categoryUuid) {
            const [category] = await db
                .select({ id: categories.id })
                .from(categories)
                .where(and(eq(categories.uuid, categoryUuid), eq(categories.companyId, req.companyId!)));
            if (category) categoryId = category.id;
        }

        if (brandUuid) {
            const [brand] = await db
                .select({ id: brands.id })
                .from(brands)
                .where(and(eq(brands.uuid, brandUuid), eq(brands.companyId, req.companyId!)));
            if (brand) brandId = brand.id;
        }

        // Upsert by UUID: if product with this UUID already exists for this company, update it
        if (uuid) {
            const [existing] = await db
                .select()
                .from(products)
                .where(and(eq(products.uuid, uuid), eq(products.companyId, req.companyId!)));

            if (existing) {
                const updateData: Partial<NewProduct> = {
                    ...rest,
                    ...(unitId !== undefined && { unitId }),
                    ...(categoryId !== undefined && { categoryId }),
                    ...(brandId !== undefined && { brandId }),
                    updatedAt: new Date(),
                };
                const [updated] = await db
                    .update(products)
                    .set(updateData)
                    .where(and(eq(products.uuid, uuid), eq(products.companyId, req.companyId!)))
                    .returning();
                res.status(200).json(updated);
                return;
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
        res.status(201).json(createdProduct);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

productRouter.put("/:uuid", checkPermission('MANAGE_PRODUCTS'), async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const { unitUuid, categoryUuid, brandUuid, ...rest } = req.body;
        let unitId = rest.unitId;
        let categoryId = rest.categoryId;
        let brandId = rest.brandId;

        if (unitUuid) {
            const [unit] = await db
                .select({ id: units.id })
                .from(units)
                .where(and(eq(units.uuid, unitUuid), eq(units.companyId, req.companyId!)));
            if (unit) unitId = unit.id;
        }

        if (categoryUuid) {
            const [category] = await db
                .select({ id: categories.id })
                .from(categories)
                .where(and(eq(categories.uuid, categoryUuid), eq(categories.companyId, req.companyId!)));
            if (category) categoryId = category.id;
        }

        if (brandUuid) {
            const [brand] = await db
                .select({ id: brands.id })
                .from(brands)
                .where(and(eq(brands.uuid, brandUuid), eq(brands.companyId, req.companyId!)));
            if (brand) brandId = brand.id;
        }

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
            res.status(404).json({ error: "Product not found" });
            return;
        }

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

productRouter.delete("/:uuid", checkPermission('MANAGE_PRODUCTS'), async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const [deletedProduct] = await db
            .update(products)
            .set({ isDeleted: true, updatedAt: new Date() })
            .where(
                and(
                    eq(products.uuid, uuid),
                    eq(products.companyId, req.companyId!)
                )
            )
            .returning();

        if (!deletedProduct) {
            res.status(404).json({ error: "Product not found" });
            return;
        }

        res.json(deletedProduct);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

export default productRouter;
