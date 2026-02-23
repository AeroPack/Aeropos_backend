import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const tasks = pgTable("tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    hexColor: text("hex_color").notNull(),
    companyId: integer("company_id")
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at").$defaultFn(
        () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    ),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
