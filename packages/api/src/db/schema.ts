import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

/** SIWE auth nonces: unique per request, expire after short TTL, single-use */
export const authNonce = pgTable("auth_nonce", {
  id: serial("id").primaryKey(),
  nonce: text("nonce").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** User profile data keyed by wallet address */
export const userProfile = pgTable("user_profile", {
  userAddress: text("user_address").primaryKey(),
  profileImageUrl: text("profile_image_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
