import { Router } from "express";
import { db } from "../db";
import { categories, NewCategory } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";
import { checkDeprecatedFields, isValidUUID, validateParamUUID } from "../middleware/validate";
import { findCategoryByUuid } from "../services/uuid-resolver";

const categoryRouter = Router();

categoryRouter.use(auth);
categoryRouter.use(checkDeprecatedFields);

categoryRouter.get("/", async (req: AuthRequest, res) => {
    try {
        const { updatedSince } = req.query;
        let query = db.select().from(categories).where(
            and(
                eq(categories.companyId, req.companyId!),
                eq(categories.isDeleted, false)
            )
        );

        if (updatedSince) {
            query = db.select().from(categories).where(
                and(
                    eq(categories.companyId, req.companyId!),
                    eq(categories.isDeleted, false),
                    gt(categories.updatedAt, new Date(updatedSince as string))
                )
            );
        }

        const allCategories = await query;
        res.json(allCategories);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

categoryRouter.get("/:uuid", validateParamUUID, async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const [category] = await db
            .select()
            .from(categories)
            .where(
                and(
                    eq(categories.uuid, uuid),
                    eq(categories.companyId, req.companyId!)
                )
            );

        if (!category) {
            res.status(404).json({
                error: "NOT_FOUND",
                field: "uuid",
                message: "Category not found"
            });
            return;
        }

        res.json(category);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

categoryRouter.post("/", async (req: AuthRequest, res) => {
    try {
        const isArray = Array.isArray(req.body);
        const categoryData = isArray ? req.body : [req.body];
        const results = [];

        console.log(`[SYNC] Categories POST received ${categoryData.length} item(s) from company ${req.companyId}`);

        for (const item of categoryData) {
            const { uuid, name, subcategory, isActive } = item;

            if (uuid && !isValidUUID(uuid)) {
                console.log(`[SYNC] Invalid UUID format: ${uuid}`);
                res.status(400).json({
                    error: "INVALID_UUID",
                    field: "uuid",
                    message: "Invalid UUID format"
                });
                return;
            }

            console.log(`[SYNC] Processing category: uuid=${uuid}, name=${name}`);

            if (uuid) {
                const existing = await findCategoryByUuid(uuid, req.companyId!);

                if (existing.exists) {
                    console.log(`[SYNC] Category ${uuid} exists, updating...`);
                    const updateData: Partial<NewCategory> = {
                        ...(name && { name }),
                        ...(subcategory !== undefined && { subcategory }),
                        ...(isActive !== undefined && { isActive }),
                        updatedAt: new Date(),
                    };
                    const [updated] = await db
                        .update(categories)
                        .set(updateData)
                        .where(and(eq(categories.uuid, uuid), eq(categories.companyId, req.companyId!)))
                        .returning();
                    results.push(updated);
                    continue;
                }
            }

            const newCategory: NewCategory = {
                ...(uuid ? { uuid } : {}),
                name,
                subcategory,
                isActive: isActive ?? true,
                companyId: req.companyId!,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const [createdCategory] = await db
                .insert(categories)
                .values(newCategory)
                .returning();
            
            console.log(`[SYNC] Created category: ${createdCategory.uuid} with id=${createdCategory.id}`);
            results.push(createdCategory);
        }

        res.status(isArray ? 200 : (results.length > 0 ? 201 : 200)).json(isArray ? results : results[0]);
    } catch (e) {
        console.error("Category POST error:", e);
        res.status(500).json({ error: e });
    }
});

categoryRouter.put("/:uuid", validateParamUUID, async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const { name, subcategory, isActive } = req.body;

        console.log(`[SYNC] Categories PUT for ${uuid}: name=${name}, subcategory=${subcategory}`);

        const updatedCategory: Partial<NewCategory> = {
            ...(name && { name }),
            ...(subcategory !== undefined && { subcategory }),
            ...(isActive !== undefined && { isActive }),
            updatedAt: new Date(),
        };
        const [result] = await db
            .update(categories)
            .set(updatedCategory)
            .where(
                and(
                    eq(categories.uuid, uuid),
                    eq(categories.companyId, req.companyId!)
                )
            )
            .returning();

        if (!result) {
            res.status(404).json({
                error: "NOT_FOUND",
                field: "uuid",
                message: "Category not found"
            });
            return;
        }

        console.log(`[SYNC] Updated category: ${uuid}`);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

categoryRouter.delete("/:uuid", validateParamUUID, async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        console.log(`[SYNC] Categories DELETE for ${uuid}`);

        const [deletedCategory] = await db
            .update(categories)
            .set({ isDeleted: true, updatedAt: new Date() })
            .where(
                and(
                    eq(categories.uuid, uuid),
                    eq(categories.companyId, req.companyId!)
                )
            )
            .returning();

        if (!deletedCategory) {
            res.status(404).json({
                error: "NOT_FOUND",
                field: "uuid",
                message: "Category not found"
            });
            return;
        }

        res.json(deletedCategory);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

export default categoryRouter;