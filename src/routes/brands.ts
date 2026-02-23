import { Router } from "express";
import { db } from "../db";
import { brands, NewBrand } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";

const brandRouter = Router();

// All brand routes require authentication
brandRouter.use(auth);

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

brandRouter.get("/:uuid", async (req: AuthRequest, res) => {
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
            res.status(404).json({ error: "Brand not found" });
            return;
        }

        res.json(brand);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

brandRouter.post("/", async (req: AuthRequest, res) => {
    try {
        const newBrand: NewBrand = {
            ...req.body,
            companyId: req.companyId!,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const [createdBrand] = await db
            .insert(brands)
            .values(newBrand)
            .returning();
        res.status(201).json(createdBrand);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

brandRouter.put("/:uuid", async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const updatedBrand: Partial<NewBrand> = {
            ...req.body,
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
            res.status(404).json({ error: "Brand not found" });
            return;
        }

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

brandRouter.delete("/:uuid", async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
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
            res.status(404).json({ error: "Brand not found" });
            return;
        }

        res.json(deletedBrand);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

export default brandRouter;
