import { db } from "./index";
import { customers } from "./schema";
import { eq, and } from "drizzle-orm";

// Walk-in customer identifier
const WALK_IN_CUSTOMER_NAME = "Walk-in Customer";

/**
 * Initialize the database with required default data
 * Note: With multi-company architecture, walk-in customers are created per company
 * This function is kept for backward compatibility but doesn't create walk-in customers
 */
export async function initializeDatabase() {
    try {
        console.log("Initializing database...");
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
