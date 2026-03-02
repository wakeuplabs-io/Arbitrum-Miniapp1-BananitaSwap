import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

// placeholder table
export const placeholder = pgTable(
  "plcaeholder",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
  },
);

/** SIWE auth nonces: unique per request, expire after short TTL, single-use */
export const authNonce = pgTable("auth_nonce", {
  id: serial("id").primaryKey(),
  nonce: text("nonce").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
