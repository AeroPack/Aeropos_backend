import { pgTable, text, serial, integer, unique } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const rolePermissions = pgTable("role_permissions", {
    id: serial("id").primaryKey(),
    role: text("role").notNull(), // e.g., 'admin', 'manager', 'employee', 'cashier'
    permission: text("permission").notNull(), // e.g., 'view_transactions', 'manage_products'
    companyId: integer("company_id")
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
}, (t) => ({
    uniqueRolePermission: unique().on(t.role, t.permission, t.companyId),
}));

export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
