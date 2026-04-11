import { Pool } from "pg";
import fs from "fs";
import path from "path";

export async function runMigrations() {
  console.log("Running sync migrations...");
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:test123@localhost:5435/mydb",
  });

  try {
    const migrationFiles = [
      "001_sync_core.sql",
    ];

    for (const file of migrationFiles) {
      console.log(`Applying ${file}...`);
      try {
        const sqlPath = path.join(process.cwd(), "migrations", file);
        const sql = fs.readFileSync(sqlPath, "utf-8");
        const statements = sql.split(";").filter((s: string) => s.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            await pool.query(statement);
          }
        }
        
        console.log(`✓ ${file} applied successfully`);
      } catch (error) {
        console.error(`Error applying ${file}:`, error);
      }
    }
    
    console.log("Sync migrations complete!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pool.end();
  }
}

runMigrations().catch(console.error);