import { Router } from "express";
import { db } from "../db";
import { units, NewUnit } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";

const unitRouter = Router();

// All unit routes require authentication
unitRouter.use(auth);

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

unitRouter.get("/:uuid", async (req: AuthRequest, res) => {
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
            res.status(404).json({ error: "Unit not found" });
            return;
        }

        res.json(unit);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

unitRouter.post("/", async (req: AuthRequest, res) => {
    try {
        const newUnit: NewUnit = {
            ...req.body,
            companyId: req.companyId!,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const [createdUnit] = await db
            .insert(units)
            .values(newUnit)
            .returning();
        res.status(201).json(createdUnit);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

unitRouter.put("/:uuid", async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const updatedUnit: Partial<NewUnit> = {
            ...req.body,
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
            res.status(404).json({ error: "Unit not found" });
            return;
        }

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

unitRouter.delete("/:uuid", async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
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
            res.status(404).json({ error: "Unit not found" });
            return;
        }

        res.json(deletedUnit);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

export default unitRouter;
