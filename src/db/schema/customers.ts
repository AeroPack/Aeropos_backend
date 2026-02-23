import { pgTable, text, uuid, timestamp, serial, boolean, doublePrecision, integer } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const customers = pgTable("customers", {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").defaultRandom().notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    creditLimit: doublePrecision("credit_limit").default(0.0).notNull(),
    currentBalance: doublePrecision("current_balance").default(0.0).notNull(),
    companyId: integer("company_id")
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
