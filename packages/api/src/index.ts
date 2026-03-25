import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { tokensRouter } from "./routes/tokens.js";
import { handle } from "hono/aws-lambda";
import type { AuthVariables } from "./middleware/auth.js";

const app = new Hono<{ Variables: AuthVariables }>();

// Middleware
app.use("*", logger());
app.use("*", cors());

app.route("/auth", authRouter);
app.route("/users", usersRouter);
app.route("/tokens", tokensRouter);

// For AWS Lambda
export const handler = handle(app);

// Start server if development
if (env.NODE_ENV === "development") {
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
