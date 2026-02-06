/**
 * Get the blockchain explorer URL based on the environment
 * Matches the logic from the UI package
 */
export function getExplorerUrl(): string {
  const env = process.env.NODE_ENV || "development";

  const EXPLORER_BY_ENV: Record<string, string> = {
    development: "https://sepolia.arbiscan.io",
    staging: "https://sepolia.arbiscan.io",
    production: "https://arbiscan.io",
  };

  return EXPLORER_BY_ENV[env] || EXPLORER_BY_ENV.development;
}
