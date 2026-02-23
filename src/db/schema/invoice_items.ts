import { pgTable, text, uuid, timestamp, serial, doublePrecision, integer } from "drizzle-orm/pg-core";
import { invoices } from "./invoices";
import { products } from "./products";
import { companies } from "./companies";

export const invoiceItems = pgTable("invoice_items", {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").defaultRandom().notNull().unique(),
    invoiceId: integer("invoice_id").references(() => invoices.id),
    productId: integer("product_id").references(() => products.id),
    quantity: integer("quantity").notNull(),
    bonus: integer("bonus").default(0).notNull(),
    unitPrice: doublePrecision("unit_price").notNull(),
    discount: doublePrecision("discount").default(0.0).notNull(),
    totalPrice: doublePrecision("total_price").notNull(),
    companyId: integer("company_id")
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
