import { arbitrum, arbitrumSepolia } from "viem/chains";

import type { Chain } from "viem";
import envParsed from "@/env-parsed";

export type NetworkConfig = {
  chain: Chain;
  rpcUrl?: string;
  // network: "base" | "base-sepolia";
  explorerUrl: string;
};

export const getNetworkConfig = (): NetworkConfig => {
  const { RPC_URL, NODE_ENV } = envParsed;
  const networkConfig = NETWORK_BY_ENV[NODE_ENV];

  networkConfig.rpcUrl = RPC_URL || networkConfig.chain.rpcUrls.default.http[0];
  return networkConfig;
};

const arbitrumSepoliaNetworkConfig: NetworkConfig = {
  chain: arbitrumSepolia,
  // network: "arbitrum-sepolia",
  explorerUrl: "https://sepolia.arbiscan.io",
};

const arbitrumNetworkConfig: NetworkConfig = {
  chain: arbitrum,
  // network: "arbitrum",
  explorerUrl: "https://arbiscan.io",
};

const NETWORK_BY_ENV: Record<string, NetworkConfig> = {
  development: arbitrumSepoliaNetworkConfig,
  production: arbitrumNetworkConfig,
  staging: arbitrumSepoliaNetworkConfig,
};

export const getShortAddress = (address: string) => {
  return address?.slice(0, 6).concat("...").concat(address?.slice(-4));
};

/**
 * Builds the explorer URL for a contract address
 * @param contractAddress - The contract address to build the URL for
 * @returns The full explorer URL for the contract address
 */
export function buildContractExplorerUrl(contractAddress: string): string {
  const { explorerUrl } = getNetworkConfig();
  return `${explorerUrl}/address/${contractAddress}`;
}

export type TokenAddresses = {
  USDC: string;
  USDT: string;
};

/**
 * Get token addresses from environment variables
 * @returns Token addresses object with USDC and USDT
 */
export function getTokenAddresses(): TokenAddresses {
  const { USDC_TOKEN_ADDRESS, USDT_TOKEN_ADDRESS } = envParsed;
  return {
    USDC: USDC_TOKEN_ADDRESS,
    USDT: USDT_TOKEN_ADDRESS,
  };
}
