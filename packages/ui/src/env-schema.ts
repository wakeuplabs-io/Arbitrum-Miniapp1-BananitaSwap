import { z } from "zod";

// Environment schema - pure validation rules without side effects
// When MOCK_API is true, API_URL is not required (UI works standalone for flow validation)
export const EnvSchema = z
  .object({
    API_URL: z.string().url().optional().default("http://localhost:9999/api"),
    MOCK_API: z
      .string()
      .optional()
      .default("true")
      .transform((v) => v === "true" || v === "1"),
    NODE_ENV: z
      .enum(["development", "staging", "production"], {
        errorMap: () => ({
          message: "NODE_ENV must be 'development', 'staging', or 'production'",
        }),
      })
      .default("development"),
    RPC_URL: z.string().url().optional(),
    USDC_TOKEN_ADDRESS: z.string().optional().default("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"),
  })
  ;

export type Env = z.infer<typeof EnvSchema>;
