import { z } from "zod";

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
    API_URL: z.string().url().optional().default("http://localhost:9999/api"),
    RPC_URL: z.string().url().optional(),
    USDC_TOKEN_ADDRESS: z.string(),
  })
  ;

export type Env = z.infer<typeof EnvSchema>;
