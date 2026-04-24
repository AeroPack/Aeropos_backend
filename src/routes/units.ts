import { Router } from "express";
import { db } from "../db";
import { units, NewUnit, companies } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";
import { checkDeprecatedFields, isValidUUID, validateParamUUID } from "../middleware/validate";
import { findUnitByUuid } from "../services/uuid-resolver";

const unitRouter = Router();

unitRouter.use(auth);
unitRouter.use(checkDeprecatedFields);

unitRouter.get("/", async (req: AuthRequest, res) => {
    try {
        const { updatedSince } = req.query;
        let query = db.select().from(units).where(
            and(
                eq(units.companyId, req.companyId!),
                eq(units.isDeleted, false)
            )
        );

        if (updatedSince) {
            query = db.select().from(units).where(
                and(
                    eq(units.companyId, req.companyId!),
                    eq(units.isDeleted, false),
                    gt(units.updatedAt, new Date(updatedSince as string))
                )
            );
        }

        const allUnits = await query;
        res.json(allUnits);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

unitRouter.get("/:uuid", validateParamUUID, async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const [unit] = await db
            .select()
            .from(units)
            .where(
                and(
                    eq(units.uuid, uuid),
                    eq(units.companyId, req.companyId!)
                )
            );

        if (!unit) {
            res.status(404).json({
                error: "NOT_FOUND",
                field: "uuid",
                message: "Unit not found"
            });
            return;
        }

        res.json(unit);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

unitRouter.post("/", async (req: AuthRequest, res) => {
    try {
        const isArray = Array.isArray(req.body);
        const unitData = isArray ? req.body : [req.body];
        const results = [];

        console.log(`[SYNC] Units POST received ${unitData.length} item(s) from company ${req.companyId}`);

        for (const item of unitData) {
            const { uuid, name, symbol, isActive, description } = item;

            if (uuid && !isValidUUID(uuid)) {
                console.log(`[SYNC] Invalid UUID format: ${uuid}`);
                res.status(400).json({
                    error: "INVALID_UUID",
                    field: "uuid",
                    message: "Invalid UUID format"
                });
                return;
            }

            console.log(`[SYNC] Processing unit: uuid=${uuid}, name=${name}`);

            if (uuid) {
                const existing = await findUnitByUuid(uuid, req.companyId!);

                if (existing.exists) {
                    console.log(`[SYNC] Unit ${uuid} exists, updating...`);
                    const updateData: Partial<NewUnit> = {
                        ...(name && { name }),
                        ...(symbol && { symbol }),
                        ...(isActive !== undefined && { isActive }),
                        updatedAt: new Date(),
                    };
                    const [updated] = await db
                        .update(units)
                        .set(updateData)
                        .where(and(eq(units.uuid, uuid), eq(units.companyId, req.companyId!)))
                        .returning();
                    results.push(updated);
                    continue;
                }
            }

            const newUnit: NewUnit = {
                ...(uuid ? { uuid } : {}),
                name,
                symbol,
                isActive: isActive ?? true,
                companyId: req.companyId!,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const [createdUnit] = await db
                .insert(units)
                .values(newUnit)
                .returning();
            
            console.log(`[SYNC] Created unit: ${createdUnit.uuid} with id=${createdUnit.id}`);
            results.push(createdUnit);
        }

        res.status(isArray ? 200 : (results.length > 0 ? 201 : 200)).json(isArray ? results : results[0]);
    } catch (e) {
        console.error("Unit POST error:", e);
        res.status(500).json({ error: e });
    }
});

unitRouter.put("/:uuid", validateParamUUID, async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const { name, symbol, isActive } = req.body;

        console.log(`[SYNC] Units PUT for ${uuid}: name=${name}, symbol=${symbol}`);

        const updatedUnit: Partial<NewUnit> = {
            ...(name && { name }),
            ...(symbol && { symbol }),
            ...(isActive !== undefined && { isActive }),
            updatedAt: new Date(),
        };
        const [result] = await db
            .update(units)
            .set(updatedUnit)
            .where(
                and(
                    eq(units.uuid, uuid),
                    eq(units.companyId, req.companyId!)
                )
            )
            .returning();

        if (!result) {
            res.status(404).json({
                error: "NOT_FOUND",
                field: "uuid",
                message: "Unit not found"
            });
            return;
        }

        console.log(`[SYNC] Updated unit: ${uuid}`);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

unitRouter.delete("/:uuid", validateParamUUID, async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        console.log(`[SYNC] Units DELETE for ${uuid}`);

        const [deletedUnit] = await db
            .update(units)
            .set({ isDeleted: true, updatedAt: new Date() })
            .where(
                and(
                    eq(units.uuid, uuid),
                    eq(units.companyId, req.companyId!)
                )
            )
            .returning();

        if (!deletedUnit) {
            res.status(404).json({
                error: "NOT_FOUND",
                field: "uuid",
                message: "Unit not found"
            });
            return;
        }

        res.json(deletedUnit);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

export default unitRouter;