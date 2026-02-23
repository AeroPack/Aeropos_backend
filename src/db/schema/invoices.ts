import { pgTable, text, uuid, timestamp, serial, doublePrecision, integer } from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { companies } from "./companies";

export const invoices = pgTable("invoices", {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").defaultRandom().notNull().unique(),
    invoiceNumber: text("invoice_number").notNull(),
    customerId: integer("customer_id").references(() => customers.id),
    date: timestamp("date").defaultNow().notNull(),
    subtotal: doublePrecision("subtotal").notNull(),
    tax: doublePrecision("tax").notNull(),
    discount: doublePrecision("discount").default(0.0).notNull(),
    total: doublePrecision("total").notNull(),
    signUrl: text("sign_url"),
    companyId: integer("company_id")
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
