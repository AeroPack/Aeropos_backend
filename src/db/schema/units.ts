import { pgTable, text, uuid, serial, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const units = pgTable("units", {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").defaultRandom().notNull(),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    companyId: integer("company_id")
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;
