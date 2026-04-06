import { arbitrum, arbitrumSepolia } from "viem/chains";

import type { Chain } from "viem";
import envParsed from "@/env-parsed";

/** USDC on Arbitrum Sepolia (Circle testnet) */
export const ARBITRUM_SEPOLIA_USDC_ADDRESS =
  "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

/** Native USDC on Arbitrum mainnet */
export const ARBITRUM_MAINNET_USDC_ADDRESS =
  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

/** Bridged USDC.e on Arbitrum One (legacy ERC-20) */
export const ARBITRUM_MAINNET_USDC_E_ADDRESS =
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

export function getPortfolioChainFromEnv(): PortfolioChain {
  return envParsed.IS_TESTNET ? "sepolia" : "mainnet";
}

/** Mainnet config (DexScreener, swap, and portfolio) */
export function getMainnetConfig(): NetworkConfig {
  const { RPC_URL_MAINNET } = envParsed;
  return {
    ...arbitrumMainnetConfig,
    rpcUrl: RPC_URL_MAINNET || arbitrum.rpcUrls.default.http[0],
  };
}

/** Sepolia config (for sepolia-specific reads) */
export function getSepoliaConfig(): NetworkConfig {
  const { RPC_URL_SEPOLIA: RPC_URL } = envParsed;
  return {
    ...arbitrumSepoliaConfig,
    rpcUrl: RPC_URL || arbitrumSepolia.rpcUrls.default.http[0],
  };
}

export function getNetworkConfig(): NetworkConfig {
  const baseConfig =
    getPortfolioChainFromEnv() === "mainnet"
      ? arbitrumMainnetConfig
      : arbitrumSepoliaConfig;
  const rpcUrl =
    getPortfolioChainFromEnv() === "mainnet"
      ? envParsed.RPC_URL_MAINNET || baseConfig.chain.rpcUrls.default.http[0]
      : envParsed.RPC_URL_SEPOLIA || baseConfig.chain.rpcUrls.default.http[0];
  return {
    ...baseConfig,
    rpcUrl,
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
  const { explorerUrl } = getMainnetConfig();
  const { explorerUrl: sepoliaExplorerUrl } = getSepoliaConfig();
  const isSepolia = getPortfolioChainFromEnv() === "sepolia";
  const baseExplorerUrl = isSepolia ? sepoliaExplorerUrl : explorerUrl;
  return `${baseExplorerUrl}/address/${contractAddress}`;
}
