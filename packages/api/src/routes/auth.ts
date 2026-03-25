import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { parseSiweMessage } from "viem/siwe";
import { eq, and, gt, or, lt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "../db/client.js";
import { getPublicClientForChainId } from "../config/viem.js";
import { authNonce } from "../db/schema.js";
import { signJwt } from "../lib/jwt.js";
import type { AuthVariables } from "../middleware/auth.js";

export const authRouter = new Hono<{ Variables: AuthVariables }>();

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Deletes expired or used nonces. Run fire-and-forget on auth read/write to avoid unbounded growth.
 */
function cleanupExpiredNonces(): void {
  const now = new Date();
  db.delete(authNonce)
    .where(or(lt(authNonce.expiresAt, now), eq(authNonce.used, true)))
    .catch((e) => console.error("[Auth] Nonce cleanup failed:", e));
}


function generateNonce(): string {
  const nonce = randomBytes(32).toString('hex');
  return nonce;
}

/**
 * POST /auth/nonce
 * Returns a unique nonce for SIWE (min 8 alphanumeric). Store in DB with expiry.
 */
authRouter.post("/nonce", async (c) => {
  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS);

  console.log("[Auth] Nonce requested, generated:", nonce, "expiresAt:", expiresAt.toISOString());

  try {
    await db.insert(authNonce).values({
      nonce,
      expiresAt,
      used: false,
    });
  } catch (e) {
    console.error("[Auth] Nonce insert failed:", e);
    return c.json({ error: "Failed to create nonce" }, 500);
  }
  cleanupExpiredNonces();
  console.log("[Auth] Nonce created successfully");
  return c.json({ nonce });
});

const verifyBodySchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, "Invalid signature"),
  message: z.string().min(1, "Message required"),
  nonce: z.string().min(8, "Nonce required (min 8 chars)"),
});

/**
 * POST /auth/verify
 * Verifies SIWE signature and marks nonce as used. Returns { verified: true } or { verified: false, error }.
 */
authRouter.post(
  "/verify",
  zValidator("json", verifyBodySchema),
  async (c) => {
    const body = c.req.valid("json");

    let parsed: ReturnType<typeof parseSiweMessage>;
    try {
      parsed = parseSiweMessage(body.message);
      if (typeof parsed.chainId !== "number") {
        return c.json({
          verified: false,
          error: "Invalid SIWE message: missing chain ID",
        });
      }
    } catch (e) {
      console.error("[Auth] SIWE parse error:", e);
      return c.json({
        verified: false,
        error: "Invalid SIWE message format",
      });
    }

    const nonceFromMessage = parsed.nonce;
    if (typeof nonceFromMessage !== "string" || nonceFromMessage.length < 8) {
      return c.json({
        verified: false,
        error: "Invalid SIWE message: missing or invalid nonce",
      });
    }
    if (body.nonce !== nonceFromMessage) {
      console.warn(
        "[Auth] nonce mismatch: body.nonce",
        body.nonce,
        "!= message nonce",
        nonceFromMessage,
        "- using message nonce for DB lookup"
      );
    }

    const rows = await db
      .select()
      .from(authNonce)
      .where(
        and(
          eq(authNonce.nonce, nonceFromMessage),
          gt(authNonce.expiresAt, new Date())
        )
      )
      .limit(1);

    if (rows.length === 0) {
      console.warn("[Auth] Verify failed: nonce not found or expired =>", nonceFromMessage);
      return c.json({
        verified: false,
        error: "Nonce not found or expired",
      });
    }
    const row = rows[0];
    if (row.used) {
      console.warn("[Auth] Verify failed: nonce already used");
      return c.json({
        verified: false,
        error: "Nonce already used",
      });
    }

    const chainId = parsed.chainId;

    let valid = false;
    try {
      const client = getPublicClientForChainId(chainId);

      valid = await client.verifySiweMessage({
        address: body.wallet as `0x${string}`,
        message: body.message,
        signature: body.signature as `0x${string}`,
      });
    } catch (e) {
      console.error("[Auth] SIWE verify error:", e);
      return c.json({
        verified: false,
        error: "Signature verification failed",
      });
    }

    if (!valid) {
      console.error("[Auth] /verify: invalid signature");
      return c.json({
        verified: false,
        error: "Invalid signature",
      });
    }

    try {
      await db.update(authNonce).set({ used: true }).where(eq(authNonce.id, row.id));
    } catch (e) {
      console.error("[Auth] Nonce mark-used failed:", e);
      return c.json({ verified: false, error: "Server error" }, 500);
    }
    cleanupExpiredNonces();

    let token: string;
    try {
      token = await signJwt(body.wallet);
    } catch (e) {
      console.error("[Auth] JWT sign failed:", e);
      return c.json({ verified: false, error: "Server error" }, 500);
    }
    return c.json({ verified: true, token });
  }
);