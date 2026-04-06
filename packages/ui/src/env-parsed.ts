import { EnvSchema } from "./env-schema.js";

const env = {
  RPC_URL_SEPOLIA: import.meta.env.VITE_RPC_URL_SEPOLIA,
  RPC_URL_MAINNET: import.meta.env.VITE_RPC_URL_MAINNET,
  NODE_ENV: import.meta.env.NODE_ENV,
  API_URL: import.meta.env.VITE_API_URL,
  IS_TESTNET: import.meta.env.VITE_IS_TESTNET === "true",

  VITE_ROUTER_ADDRESS_SEPOLIA: import.meta.env.VITE_ROUTER_ADDRESS_SEPOLIA,
  VITE_ROUTER_ADDRESS_MAINNET: import.meta.env.VITE_ROUTER_ADDRESS_MAINNET,
};

const parseResult = EnvSchema.safeParse(env);
console.log('parseResult', parseResult)

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
