import { pgTable, text, uuid, timestamp, serial, boolean } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").defaultRandom().notNull().unique(),
    businessName: text("business_name").notNull(),
    businessAddress: text("business_address"),
    taxId: text("tax_id"),
    phone: text("phone"),
    email: text("email"), // Company contact email
    logoUrl: text("logo_url"), // Company logo (renamed from profileImage)
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
