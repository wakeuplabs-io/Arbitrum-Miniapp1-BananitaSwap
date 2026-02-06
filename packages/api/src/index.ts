import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { env } from "./config/env.js";
import { placeholderRouter } from "./routes/placeholder.js";
import { handle } from "hono/aws-lambda";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Routes
app.route("/placeholders", placeholderRouter); // Placeholders

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
