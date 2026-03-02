import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { env } from "./config/env.js";
import { placeholderRouter } from "./routes/placeholder.js";
import { authRouter } from "./routes/auth.js";
import { handle } from "hono/aws-lambda";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

const api = new Hono();
api.route("/placeholders", placeholderRouter);
api.route("/auth", authRouter);

// For AWS Lambda
export const handler = handle(app);

// Start server if development
if (process.env.NODE_ENV === "development") {
  const port = env.PORT;

  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`🚀 Server is running on http://localhost:${info.port}`);
    }
  );
}
