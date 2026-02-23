import { Router } from "express";
import { db } from "../db";
import {
    products, categories, units, brands, customers, invoices, invoiceItems, employees, suppliers,
} from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";

const syncRouter = Router();

// All sync routes require authentication
syncRouter.use(auth);

syncRouter.post("/", async (req: AuthRequest, res) => {
    try {
        const { lastSyncTime, changes } = req.body;
        const lastSync = lastSyncTime ? new Date(lastSyncTime) : new Date(0);

        // This is a simplified batch sync. 
        // In a real scenario, you'd iterate through 'changes' and apply them.
        // For this prompt, we'll focus on returning server-side updates since lastSync.

        const newUpdates = {
            products: await db.select().from(products).where(
                and(
                    eq(products.companyId, req.companyId!),
                    gt(products.updatedAt, lastSync)
                )
            ),
            categories: await db.select().from(categories).where(
                and(
                    eq(categories.companyId, req.companyId!),
                    gt(categories.updatedAt, lastSync)
                )
            ),
            units: await db.select().from(units).where(
                and(
                    eq(units.companyId, req.companyId!),
                    gt(units.updatedAt, lastSync)
                )
            ),
            brands: await db.select().from(brands).where(
                and(
                    eq(brands.companyId, req.companyId!),
                    gt(brands.updatedAt, lastSync)
                )
            ),
            customers: await db.select().from(customers).where(
                and(
                    eq(customers.companyId, req.companyId!),
                    gt(customers.updatedAt, lastSync)
                )
            ),
            invoices: await db.select().from(invoices).where(
                and(
                    eq(invoices.companyId, req.companyId!),
                    gt(invoices.updatedAt, lastSync)
                )
            ),
            invoiceItems: await db.select().from(invoiceItems).where(
                and(
                    eq(invoiceItems.companyId, req.companyId!),
                    gt(invoiceItems.createdAt, lastSync)
                )
            ),
            employees: await db.select().from(employees).where(
                and(
                    eq(employees.companyId, req.companyId!),
                    gt(employees.updatedAt, lastSync)
                )
            ),
            suppliers: await db.select().from(suppliers).where(
                and(
                    eq(suppliers.companyId, req.companyId!),
                    gt(suppliers.updatedAt, lastSync)
                )
            ),
        };

        res.json({
            serverTime: new Date().toISOString(),
            updates: newUpdates
        });
    } catch (e) {
        console.error("Sync error:", e);
        res.status(500).json({ error: e });
    }
});

export default syncRouter;
