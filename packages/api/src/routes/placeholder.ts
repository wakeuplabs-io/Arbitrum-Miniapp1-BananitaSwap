import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/client.js";
import { placeholder } from "../db/schema.js";

export const placeholderRouter = new Hono();
/**
 * Get a placeholder (mocked)
 */
placeholderRouter.get("/", async (c) => {
  // Return a mocked placeholder
  const mockedPlaceholder = {
    id: 1,
    name: "Mocked Placeholder",
    createdAt: new Date().toISOString(),
  };

  return c.json(mockedPlaceholder);
});

/**
 * Create a placeholder
 */
const createPlaceholderSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

placeholderRouter.post(
  "/",
  zValidator("json", createPlaceholderSchema),
  async (c) => {
    const body = c.req.valid("json");

    try {
      const newPlaceholder = await db.insert(placeholder).values({
        name: body.name,
      });

      return c.json(newPlaceholder);
    } catch (error) {
      console.error("[Placeholder] Error creating placeholder:", error);
      return c.json(
        {
          error: "Error creating placeholder",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);
