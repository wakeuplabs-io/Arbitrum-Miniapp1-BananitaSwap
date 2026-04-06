import { z } from "zod";
import { isAddress } from "viem";

// Environment schema - pure validation rules without side effects
export const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "staging", "production"], {
        errorMap: () => ({
          message: "NODE_ENV must be 'development', 'staging', or 'production'",
        }),
      })
      .default("development"),
    IS_TESTNET: z.boolean().default(false),
    API_URL: z.string().url().optional().default("http://localhost:3000"),
    RPC_URL_SEPOLIA: z.string().url().optional(),
    RPC_URL_MAINNET: z.string().url().optional(),

    // Router (Rust/Stylus) addresses per network
    VITE_ROUTER_ADDRESS_SEPOLIA: z
      .string()
      .optional()
      .refine((v) => v === undefined || isAddress(v), {
        message: "VITE_ROUTER_ADDRESS_SEPOLIA must be a valid address",
      }),
    VITE_ROUTER_ADDRESS_MAINNET: z
      .string()
      .optional()
      .refine((v) => v === undefined || isAddress(v), {
        message: "VITE_ROUTER_ADDRESS_MAINNET must be a valid address",
      }),
  });

export type Env = z.infer<typeof EnvSchema>;
