import { pgTable, text, uuid, timestamp, serial, boolean, doublePrecision, integer } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const employees = pgTable("employees", {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").defaultRandom().notNull().unique(),
    name: text("name").notNull(),
    email: text("email").unique().notNull(), // For authentication
    password: text("password"), // Hashed password (nullable for Google Auth employees)
    phone: text("phone"),
    address: text("address"),
    position: text("position"),
    salary: doublePrecision("salary"),
    role: text("role").default("employee").notNull(), // admin, manager, employee
    googleAuth: boolean("google_auth").default(false).notNull(), // True if employee was added via Google Auth (no password)
    isOwner: boolean("is_owner").default(false).notNull(), // Company owner flag
    companyId: integer("company_id") // Renamed from tenantId
        .notNull()
        .references(() => companies.id, { onDelete: "cascade" }),
    // Email Verification
    isEmailVerified: boolean("is_email_verified").default(false).notNull(),
    emailVerificationToken: text("email_verification_token"),
    emailVerificationExpires: timestamp("email_verification_expires"),
    // Password Reset
    passwordResetToken: text("password_reset_token"),
    passwordResetExpires: timestamp("password_reset_expires"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
