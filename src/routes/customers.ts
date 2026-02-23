import { Router } from "express";
import { db } from "../db";
import { customers, NewCustomer } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";

const customerRouter = Router();

// All customer routes require authentication
customerRouter.use(auth);

// Get all customers for the authenticated tenant
customerRouter.get("/", async (req: AuthRequest, res) => {
    try {
        const { updatedSince } = req.query;

        let query = db.select().from(customers).where(
            and(
                eq(customers.companyId, req.companyId!),
                eq(customers.isDeleted, false)
            )
        );

        if (updatedSince) {
            query = db.select().from(customers).where(
                and(
                    eq(customers.companyId, req.companyId!),
                    eq(customers.isDeleted, false),
                    gt(customers.updatedAt, new Date(updatedSince as string))
                )
            );
        }

        const allCustomers = await query;
        res.json(allCustomers);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

// Get specific customer by UUID
customerRouter.get("/:uuid", async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const [customer] = await db
            .select()
            .from(customers)
            .where(
                and(
                    eq(customers.uuid, uuid),
                    eq(customers.companyId, req.companyId!)
                )
            );

        if (!customer) {
            res.status(404).json({ error: "Customer not found" });
            return;
        }

        res.json(customer);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

// Create new customer
customerRouter.post("/", async (req: AuthRequest, res) => {
    try {
        const newCustomer: NewCustomer = {
            ...req.body,
            companyId: req.companyId!,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const [createdCustomer] = await db
            .insert(customers)
            .values(newCustomer)
            .returning();

        res.status(201).json(createdCustomer);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

// Update customer
customerRouter.put("/:uuid", async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const updatedCustomer: Partial<NewCustomer> = {
            ...req.body,
            updatedAt: new Date(),
        };

        const [result] = await db
            .update(customers)
            .set(updatedCustomer)
            .where(
                and(
                    eq(customers.uuid, uuid),
                    eq(customers.companyId, req.companyId!)
                )
            )
            .returning();

        if (!result) {
            res.status(404).json({ error: "Customer not found" });
            return;
        }

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

// Soft delete customer
customerRouter.delete("/:uuid", async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const [deletedCustomer] = await db
            .update(customers)
            .set({ isDeleted: true, updatedAt: new Date() })
            .where(
                and(
                    eq(customers.uuid, uuid),
                    eq(customers.companyId, req.companyId!)
                )
            )
            .returning();

        if (!deletedCustomer) {
            res.status(404).json({ error: "Customer not found" });
            return;
        }

        res.json(deletedCustomer);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

export default customerRouter;
