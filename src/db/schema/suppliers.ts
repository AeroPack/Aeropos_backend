import { pgTable, text, uuid, timestamp, serial, boolean, integer } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const suppliers = pgTable("suppliers", {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").defaultRandom().notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    companyId: integer("company_id")
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
