import { pgTable, text, timestamp, serial, boolean, doublePrecision, integer } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const invoiceSettings = pgTable("invoice_settings", {
    id: serial("id").primaryKey(),
    businessName: text("business_name").notNull(),
    layout: text("layout").notNull(),
    footerMessage: text("footer_message").notNull(),
    accentColor: text("accent_color").notNull(),
    fontFamily: text("font_family").notNull(),
    fontSizeMultiplier: doublePrecision("font_size_multiplier").notNull(),
    showAddress: boolean("show_address").default(true).notNull(),
    showCustomerDetails: boolean("show_customer_details").default(true).notNull(),
    showFooter: boolean("show_footer").default(true).notNull(),
    businessPhone: text("business_phone"),
    businessAddress: text("business_address"),
    businessGstin: text("business_gstin"),
    companyId: integer("company_id")
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InvoiceSettings = typeof invoiceSettings.$inferSelect;
export type NewInvoiceSettings = typeof invoiceSettings.$inferInsert;
