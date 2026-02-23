import { Router } from "express";
import { db } from "../db";
import { invoices, invoiceItems, NewInvoice, NewInvoiceItem } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { getWalkInCustomerId } from "../db/seed";
import { auth, AuthRequest } from "../middleware/auth";

const invoiceRouter = Router();

// All invoice routes require authentication
invoiceRouter.use(auth);

invoiceRouter.get("/", async (req: AuthRequest, res) => {
    try {
        const { updatedSince } = req.query;
        let query;

        if (updatedSince) {
            query = db.select().from(invoices).where(
                and(
                    eq(invoices.companyId, req.companyId!),
                    gt(invoices.updatedAt, new Date(updatedSince as string))
                )
            );
        } else {
            query = db.select().from(invoices).where(
                eq(invoices.companyId, req.companyId!)
            );
        }

        const allInvoices = await query;
        res.json(allInvoices);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

invoiceRouter.get("/:uuid", async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const [invoice] = await db
            .select()
            .from(invoices)
            .where(
                and(
                    eq(invoices.uuid, uuid),
                    eq(invoices.companyId, req.companyId!)
                )
            );

        if (!invoice) {
            res.status(404).json({ error: "Invoice not found" });
            return;
        }

        const items = await db
            .select()
            .from(invoiceItems)
            .where(eq(invoiceItems.invoiceId, invoice.id));

        res.json({ ...invoice, items });
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

invoiceRouter.post("/", async (req: AuthRequest, res) => {
    try {
        const { items, uuid, date, customerId, ...restInvoiceData } = req.body;

        // If customerId is null or undefined, assign to walk-in customer for this tenant
        let finalCustomerId = customerId;
        if (finalCustomerId === null || finalCustomerId === undefined) {
            finalCustomerId = await getWalkInCustomerId(req.companyId!);
        }

        // Convert date string to Date object if it's a string
        const finalDate = date ? new Date(date) : new Date();

        let createdInvoice;

        // Check if invoice with this UUID already exists (for offline sync)
        if (uuid) {
            const [existingInvoice] = await db
                .select()
                .from(invoices)
                .where(eq(invoices.uuid, uuid));

            if (existingInvoice) {
                // Update existing invoice
                const updateValues: any = {
                    ...restInvoiceData,
                    customerId: finalCustomerId,
                    date: finalDate,
                    companyId: req.companyId!,
                    updatedAt: new Date(),
                };

                [createdInvoice] = await db
                    .update(invoices)
                    .set(updateValues)
                    .where(eq(invoices.uuid, uuid))
                    .returning();

                // Delete existing invoice items and re-insert
                await db
                    .delete(invoiceItems)
                    .where(eq(invoiceItems.invoiceId, existingInvoice.id));
            } else {
                // Insert new invoice with provided UUID
                const invoiceValues: any = {
                    ...restInvoiceData,
                    customerId: finalCustomerId,
                    date: finalDate,
                    uuid: uuid,
                    companyId: req.companyId!,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                [createdInvoice] = await db
                    .insert(invoices)
                    .values(invoiceValues)
                    .returning();
            }
        } else {
            // No UUID provided - create new invoice (database will auto-generate UUID)
            const invoiceValues: any = {
                ...restInvoiceData,
                customerId: finalCustomerId,
                date: finalDate,
                companyId: req.companyId!,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            [createdInvoice] = await db
                .insert(invoices)
                .values(invoiceValues)
                .returning();
        }

        // Insert invoice items
        if (items && Array.isArray(items)) {
            // Validate that all product IDs exist
            const productIds = items.map((item: any) => item.productId).filter(Boolean);

            if (productIds.length > 0) {
                const { products } = await import("../db/schema");
                const { inArray } = await import("drizzle-orm");

                const existingProducts = await db
                    .select({ id: products.id })
                    .from(products)
                    .where(inArray(products.id, productIds));

                const existingProductIds = new Set(existingProducts.map(p => p.id));
                const invalidProductIds = productIds.filter(id => !existingProductIds.has(id));

                if (invalidProductIds.length > 0) {
                    res.status(400).json({
                        error: "Invalid product IDs",
                        message: `The following product IDs do not exist: ${invalidProductIds.join(", ")}`,
                        invalidProductIds
                    });
                    return;
                }
            }

            const invoiceItemsData: NewInvoiceItem[] = items.map((item: any) => ({
                ...item,
                invoiceId: createdInvoice.id,
                companyId: req.companyId!,
                createdAt: new Date(),
            }));
            await db.insert(invoiceItems).values(invoiceItemsData);
        }

        res.status(201).json(createdInvoice);
    } catch (e) {
        console.error("Error creating invoice:", e);
        res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
});

export default invoiceRouter;
