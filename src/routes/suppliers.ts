import { Router } from "express";
import { db } from "../db";
import { suppliers, NewSupplier } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";

const supplierRouter = Router();

// All supplier routes require authentication
supplierRouter.use(auth);

// Get all suppliers for the authenticated tenant
supplierRouter.get("/", async (req: AuthRequest, res) => {
    try {
        const { updatedSince } = req.query;

        let query = db.select().from(suppliers).where(
            and(
                eq(suppliers.companyId, req.companyId!),
                eq(suppliers.isDeleted, false)
            )
        );

        if (updatedSince) {
            query = db.select().from(suppliers).where(
                and(
                    eq(suppliers.companyId, req.companyId!),
                    eq(suppliers.isDeleted, false),
                    gt(suppliers.updatedAt, new Date(updatedSince as string))
                )
            );
        }

        const allSuppliers = await query;
        res.json(allSuppliers);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

// Get specific supplier by UUID
supplierRouter.get("/:uuid", async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const [supplier] = await db
            .select()
            .from(suppliers)
            .where(
                and(
                    eq(suppliers.uuid, uuid),
                    eq(suppliers.companyId, req.companyId!)
                )
            );

        if (!supplier) {
            res.status(404).json({ error: "Supplier not found" });
            return;
        }

        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

// Create new supplier
supplierRouter.post("/", async (req: AuthRequest, res) => {
    try {
        const newSupplier: NewSupplier = {
            ...req.body,
            companyId: req.companyId!,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const [createdSupplier] = await db
            .insert(suppliers)
            .values(newSupplier)
            .returning();

        res.status(201).json(createdSupplier);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

// Update supplier
supplierRouter.put("/:uuid", async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const updatedSupplier: Partial<NewSupplier> = {
            ...req.body,
            updatedAt: new Date(),
        };

        const [result] = await db
            .update(suppliers)
            .set(updatedSupplier)
            .where(
                and(
                    eq(suppliers.uuid, uuid),
                    eq(suppliers.companyId, req.companyId!)
                )
            )
            .returning();

        if (!result) {
            res.status(404).json({ error: "Supplier not found" });
            return;
        }

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

// Soft delete supplier
supplierRouter.delete("/:uuid", async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const [deletedSupplier] = await db
            .update(suppliers)
            .set({ isDeleted: true, updatedAt: new Date() })
            .where(
                and(
                    eq(suppliers.uuid, uuid),
                    eq(suppliers.companyId, req.companyId!)
                )
            )
            .returning();

        if (!deletedSupplier) {
            res.status(404).json({ error: "Supplier not found" });
            return;
        }

        res.json(deletedSupplier);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

export default supplierRouter;
