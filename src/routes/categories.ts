import { Router } from "express";
import { db } from "../db";
import { categories, NewCategory } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";

const categoryRouter = Router();

// All category routes require authentication
categoryRouter.use(auth);

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

categoryRouter.get("/:uuid", async (req: AuthRequest, res) => {
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
            res.status(404).json({ error: "Category not found" });
            return;
        }

        res.json(category);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

categoryRouter.post("/", async (req: AuthRequest, res) => {
    try {
        const newCategory: NewCategory = {
            ...req.body,
            companyId: req.companyId!,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const [createdCategory] = await db
            .insert(categories)
            .values(newCategory)
            .returning();
        res.status(201).json(createdCategory);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

categoryRouter.put("/:uuid", async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const updatedCategory: Partial<NewCategory> = {
            ...req.body,
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
            res.status(404).json({ error: "Category not found" });
            return;
        }

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

categoryRouter.delete("/:uuid", async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
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
            res.status(404).json({ error: "Category not found" });
            return;
        }

        res.json(deletedCategory);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

export default categoryRouter;
