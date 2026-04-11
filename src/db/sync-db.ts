import pg from "pg";
import { config } from "../config";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.database.url,
  max: config.database.poolSize,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
});

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
  const result = await pool.query(text, params);
  return (result.rows[0] as T) || null;
}

export async function execute(text: string, params?: unknown[]): Promise<number> {
  const result = await pool.query(text, params);
  return result.rowCount || 0;
}

export async function getClient() {
  return pool.connect();
}