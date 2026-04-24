import { pgTable, text, uuid, timestamp, serial, boolean, integer, varchar } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").defaultRandom().notNull().unique(),
    externalKey: varchar("external_key", { length: 50 }).notNull().unique(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    plan: varchar("plan", { length: 50 }).default("free").notNull(),
    planExpiresAt: timestamp("plan_expires_at"),
    billingEmail: text("billing_email"),
    settings: text("settings").default("{}"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;