import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:test123@db:5432/mydb",
});

export const db = drizzle(pool, { schema });
