import { db } from "./index";
import { customers } from "./schema";
import { eq, and } from "drizzle-orm";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

// Walk-in customer identifier
const WALK_IN_CUSTOMER_NAME = "Walk-in Customer";

/**
 * Initialize the database with required schema and default data
 * Runs create-schema.sql to ensure all tables exist (uses IF NOT EXISTS)
 */
export async function initializeDatabase() {
    try {
        console.log("Initializing database...");

        // Run schema creation SQL
        const schemaPath = path.join(process.cwd(), "migrations", "create-schema.sql");
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, "utf-8");
            const pool = new Pool({
                connectionString: process.env.DATABASE_URL || "postgresql://postgres:test123@db:5432/mydb",
            });
            await pool.query(schemaSql);
            await pool.end();
            console.log("Database schema verified/created successfully");
        } else {
            console.warn("Warning: migrations/create-schema.sql not found, skipping schema creation");
        }

        console.log("Database initialization complete");
    } catch (error) {
        console.error("Error initializing database:", error);
        throw error;
    }
}

/**
 * Get or create the walk-in customer ID for a specific company
 * This function should be called when creating invoices with null customerId
 */
export async function getWalkInCustomerId(companyId: number): Promise<number> {
    // Check if walk-in customer exists for this company
    const [walkInCustomer] = await db
        .select()
        .from(customers)
        .where(
            and(
                eq(customers.name, WALK_IN_CUSTOMER_NAME),
                eq(customers.companyId, companyId)
            )
        );

    if (walkInCustomer) {
        return walkInCustomer.id;
    }

    // Create walk-in customer for this company
    const [createdCustomer] = await db.insert(customers).values({
        name: WALK_IN_CUSTOMER_NAME,
        companyId: companyId,
        phone: null,
        email: null,
        address: null,
        creditLimit: 0.0,
        currentBalance: 0.0,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    }).returning();

    console.log(`✓ Walk-in customer created for company ${companyId} (ID: ${createdCustomer.id})`);
    return createdCustomer.id;
}
