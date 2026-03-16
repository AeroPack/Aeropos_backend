import { db } from "../db";
import { employees } from "../db/schema";
import { eq, and, ne } from "drizzle-orm";

/**
 * Syncs authentication-related fields across all employee records with the same email.
 * Used when an admin has mirror employee records in multiple companies.
 * 
 * Fields synced: password, isEmailVerified, verification tokens, reset tokens
 */
export async function syncEmployeeAuthFields(
    sourceEmployeeId: number,
    email: string,
    fields: {
        password?: string;
        isEmailVerified?: boolean;
        emailVerificationToken?: string | null;
        emailVerificationExpires?: Date | null;
        passwordResetToken?: string | null;
        passwordResetExpires?: Date | null;
    }
) {
    // Find all other employee records with the same email
    const mirrorEmployees = await db
        .select({ id: employees.id })
        .from(employees)
        .where(
            and(
                eq(employees.email, email),
                ne(employees.id, sourceEmployeeId),
                eq(employees.isDeleted, false)
            )
        );

    if (mirrorEmployees.length === 0) return;

    // Build update object with only provided fields
    const updateData: any = { updatedAt: new Date() };
    if (fields.password !== undefined) updateData.password = fields.password;
    if (fields.isEmailVerified !== undefined) updateData.isEmailVerified = fields.isEmailVerified;
    if (fields.emailVerificationToken !== undefined) updateData.emailVerificationToken = fields.emailVerificationToken;
    if (fields.emailVerificationExpires !== undefined) updateData.emailVerificationExpires = fields.emailVerificationExpires;
    if (fields.passwordResetToken !== undefined) updateData.passwordResetToken = fields.passwordResetToken;
    if (fields.passwordResetExpires !== undefined) updateData.passwordResetExpires = fields.passwordResetExpires;

    // Update all mirror records
    for (const mirror of mirrorEmployees) {
        await db
            .update(employees)
            .set(updateData)
            .where(eq(employees.id, mirror.id));
    }

    console.log(`Synced auth fields for ${mirrorEmployees.length} mirror employee(s) of ${email}`);
}
