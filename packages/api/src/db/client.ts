import { sql as drizzleSql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import {
  drizzle as drizzleNeon,
  NeonHttpDatabase,
} from "drizzle-orm/neon-http";
import { env } from "../config/env.js";
import * as schema from "./schema.js";
import {
  drizzle as drizzleNode,
  NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let db:
  | NodePgDatabase<Record<string, never> | typeof schema>
  | NeonHttpDatabase<typeof schema>;
let pool: Pool;

if (env.NODE_ENV === "development") {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  db = drizzleNode(pool, { schema });
} else {
  const sql = neon(process.env.DATABASE_URL!);
  db = drizzleNeon(sql, { schema });
}

// Test connection on startup
db.execute(drizzleSql`SELECT 1`)
  .then(() => console.log("✅ Database connected successfully"))
  .catch((error: any) => console.error("❌ Database connection failed:", error));

// Graceful shutdown
// For local PostgreSQL, we need to close the pool connection
// Neon serverless manages connections automatically, so no explicit disconnect needed
process.on("SIGINT", async () => {
  if (pool) {
    console.log("🔄 Closing database pool...");
    await pool.end();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  if (pool) {
    console.log("🔄 Closing database pool...");
    await pool.end();
  }
  process.exit(0);
});


export { db };
