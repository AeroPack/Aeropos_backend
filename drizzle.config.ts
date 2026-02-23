import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/drizzle",
  dbCredentials: {
    host: "localhost",
    port: 5432,
    database: "mydb",
    user: "postgres",
    password: "test123",
    ssl: false,
  },
});
