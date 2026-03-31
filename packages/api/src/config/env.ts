import { config } from "dotenv";
import path from "node:path";
import { z } from "zod";

// Get the root directory of the project
const rootDir = process.cwd();

// Cargar variables de entorno desde múltiples fuentes
// Prioridad: .env.local > .env > .env.defaults
config({ path: path.resolve(rootDir, ".env.defaults") });
config({ path: path.resolve(rootDir, ".env") });
config({ path: path.resolve(rootDir, ".env.local") });

const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(["development", "production", "staging"]).default("development"),
    MAINNET_RPC_URL: z.string().url(),
    SEPOLIA_RPC_URL: z.string().url(),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    PINATA_JWT: z.string().min(1).optional(),
    IS_TESTNET: z.boolean().default(false),
  })

export type Env = z.infer<typeof envSchema>;

const { data, error } = envSchema.safeParse(process.env);

if (error) {
  console.error("❌ Invalid environment variables:");
  console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env: Env = data!;
