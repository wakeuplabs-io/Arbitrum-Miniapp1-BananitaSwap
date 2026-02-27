import { EnvSchema } from "./env-schema.js";

const env = {
  RPC_URL: import.meta.env.VITE_RPC_URL,
  NODE_ENV: import.meta.env.NODE_ENV,
  API_URL: import.meta.env.VITE_API_URL,
  USDC_TOKEN_ADDRESS: import.meta.env.VITE_USDC_TOKEN_ADDRESS,
};

const parseResult = EnvSchema.safeParse(env);

if (!parseResult.success) {
  console.error("Environment validation failed:", parseResult.error.format());
  throw new Error(
    `Environment validation failed: ${parseResult.error.issues.map((i) => i.message).join(", ")}`
  );
}

// Ensure API_URL doesn't end with slash to prevent double slashes
if (parseResult.data.API_URL && parseResult.data.API_URL.endsWith("/")) {
  parseResult.data.API_URL = parseResult.data.API_URL.slice(0, -1);
}

export default parseResult.data;
