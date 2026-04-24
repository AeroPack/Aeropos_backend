import { PoolClient } from "pg";
import { getClient } from "./sync-db";

/**
 * Executes a callback within a database transaction.
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and client release.
 * 
 * @example
 * const result = await withTransaction(async (tx) => {
 *   await tx.query("INSERT INTO ...");
 *   return { success: true };
 * });
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  const startTime = Date.now();
  
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    
    const duration = Date.now() - startTime;
    if (duration > 100) {
      console.log(`[DB][TX] Transaction completed in ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    
    const duration = Date.now() - startTime;
    console.error(`[DB][TX] Transaction failed after ${duration}ms:`, error);
    
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Executes a read-only operation with a client from the pool.
 * Use this for queries that don't need transactions.
 */
export async function withClient<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}