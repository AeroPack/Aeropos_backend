import { Router } from "express";
import { db } from "../db";
import { brands, NewBrand } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";
import { checkDeprecatedFields, isValidUUID, validateParamUUID } from "../middleware/validate";
import { findBrandByUuid } from "../services/uuid-resolver";

const brandRouter = Router();

brandRouter.use(auth);
brandRouter.use(checkDeprecatedFields);

brandRouter.get("/", async (req: AuthRequest, res) => {
    try {
        const { updatedSince } = req.query;
        let query = db.select().from(brands).where(
            and(
                eq(brands.companyId, req.companyId!),
                eq(brands.isDeleted, false)
            )
        );

        if (updatedSince) {
            query = db.select().from(brands).where(
                and(
                    eq(brands.companyId, req.companyId!),
                    eq(brands.isDeleted, false),
                    gt(brands.updatedAt, new Date(updatedSince as string))
                )
            );
        }

        const allBrands = await query;
        res.json(allBrands);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

brandRouter.get("/:uuid", validateParamUUID, async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const [brand] = await db
            .select()
            .from(brands)
            .where(
                and(
                    eq(brands.uuid, uuid),
                    eq(brands.companyId, req.companyId!)
                )
            );

        if (!brand) {
            res.status(404).json({
                error: "NOT_FOUND",
                field: "uuid",
                message: "Brand not found"
            });
            return;
        }

        res.json(brand);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

brandRouter.post("/", async (req: AuthRequest, res) => {
    try {
        const isArray = Array.isArray(req.body);
        const brandData = isArray ? req.body : [req.body];
        const results = [];

        console.log(`[SYNC] Brands POST received ${brandData.length} item(s) from company ${req.companyId}`);

        for (const item of brandData) {
            const { uuid, name, description, isActive } = item;

            if (uuid && !isValidUUID(uuid)) {
                console.log(`[SYNC] Invalid UUID format: ${uuid}`);
                res.status(400).json({
                    error: "INVALID_UUID",
                    field: "uuid",
                    message: "Invalid UUID format"
                });
                return;
            }

            console.log(`[SYNC] Processing brand: uuid=${uuid}, name=${name}`);

            if (uuid) {
                const existing = await findBrandByUuid(uuid, req.companyId!);

                if (existing.exists) {
                    console.log(`[SYNC] Brand ${uuid} exists, updating...`);
                    const updateData: Partial<NewBrand> = {
                        ...(name && { name }),
                        ...(description !== undefined && { description }),
                        ...(isActive !== undefined && { isActive }),
                        updatedAt: new Date(),
                    };
                    const [updated] = await db
                        .update(brands)
                        .set(updateData)
                        .where(and(eq(brands.uuid, uuid), eq(brands.companyId, req.companyId!)))
                        .returning();
                    results.push(updated);
                    continue;
                }
            }

            const newBrand: NewBrand = {
                ...(uuid ? { uuid } : {}),
                name,
                description,
                isActive: isActive ?? true,
                companyId: req.companyId!,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const [createdBrand] = await db
                .insert(brands)
                .values(newBrand)
                .returning();
            
            console.log(`[SYNC] Created brand: ${createdBrand.uuid} with id=${createdBrand.id}`);
            results.push(createdBrand);
        }

        res.status(isArray ? 200 : (results.length > 0 ? 201 : 200)).json(isArray ? results : results[0]);
    } catch (e) {
        console.error("Brand POST error:", e);
        res.status(500).json({ error: e });
    }
});

brandRouter.put("/:uuid", validateParamUUID, async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const { name, description, isActive } = req.body;

        console.log(`[SYNC] Brands PUT for ${uuid}: name=${name}, description=${description}`);

        const updatedBrand: Partial<NewBrand> = {
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(isActive !== undefined && { isActive }),
            updatedAt: new Date(),
        };
        const [result] = await db
            .update(brands)
            .set(updatedBrand)
            .where(
                and(
                    eq(brands.uuid, uuid),
                    eq(brands.companyId, req.companyId!)
                )
            )
            .returning();

        if (!result) {
            res.status(404).json({
                error: "NOT_FOUND",
                field: "uuid",
                message: "Brand not found"
            });
            return;
        }

        console.log(`[SYNC] Updated brand: ${uuid}`);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

brandRouter.delete("/:uuid", validateParamUUID, async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        console.log(`[SYNC] Brands DELETE for ${uuid}`);

        const [deletedBrand] = await db
            .update(brands)
            .set({ isDeleted: true, updatedAt: new Date() })
            .where(
                and(
                    eq(brands.uuid, uuid),
                    eq(brands.companyId, req.companyId!)
                )
            )
            .returning();

        if (!deletedBrand) {
            res.status(404).json({
                error: "NOT_FOUND",
                field: "uuid",
                message: "Brand not found"
            });
            return;
        }

        res.json(deletedBrand);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

export default brandRouter;