import { arbitrum, arbitrumSepolia } from "viem/chains";

import type { Chain } from "viem";
import envParsed from "@/env-parsed";

/** USDC on Arbitrum Sepolia (Circle testnet) */
export const ARBITRUM_SEPOLIA_USDC_ADDRESS =
  "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

/** USDC.e on Arbitrum mainnet */
export const ARBITRUM_MAINNET_USDC_ADDRESS =
  "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8";

export type NetworkConfig = {
  chain: Chain;
  rpcUrl?: string;
  explorerUrl: string;
};

export type PortfolioChain = "sepolia" | "mainnet";

const arbitrumMainnetConfig: NetworkConfig = {
  chain: arbitrum,
  explorerUrl: "https://arbiscan.io",
};

const arbitrumSepoliaConfig: NetworkConfig = {
  chain: arbitrumSepolia,
  explorerUrl: "https://sepolia.arbiscan.io",
};

const NETWORK_BY_ENV: Record<string, NetworkConfig> = {
  development: arbitrumSepoliaConfig,
  staging: arbitrumSepoliaConfig,
  production: arbitrumMainnetConfig,
};

/** App chain: Sepolia for dev/staging (Lemon miniapp), mainnet for production */
export const getNetworkConfig = (): NetworkConfig => {
  const { RPC_URL_SEPOLIA: RPC_URL, NODE_ENV } = envParsed;
  const base = NETWORK_BY_ENV[NODE_ENV];
  return {
    ...base,
    rpcUrl: RPC_URL || base.chain.rpcUrls.default.http[0],
  };
};

/** Mainnet config (DexScreener, swap, and portfolio when viewing mainnet) */
export function getMainnetConfig(): NetworkConfig {
  const { RPC_URL_MAINNET } = envParsed;
  return {
    ...arbitrumMainnetConfig,
    rpcUrl: RPC_URL_MAINNET || arbitrum.rpcUrls.default.http[0],
  };
}

/** Sepolia config (Lemon miniapp wallet, portfolio when viewing Sepolia) */
export function getSepoliaConfig(): NetworkConfig {
  const { RPC_URL_SEPOLIA: RPC_URL } = envParsed;
  return {
    ...arbitrumSepoliaConfig,
    rpcUrl: RPC_URL || arbitrumSepolia.rpcUrls.default.http[0],
  };
}

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
