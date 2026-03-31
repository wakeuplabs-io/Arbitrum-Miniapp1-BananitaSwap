import { getMainnetConfig, getSepoliaConfig } from "./network";
import type { PortfolioChain } from "./network";
import { createPublicClient, createWalletClient, http } from "viem";

const mainnetConfig = getMainnetConfig();
export const publicClient = createPublicClient({
  chain: mainnetConfig.chain,
  transport: http(mainnetConfig.rpcUrl),
});

const sepoliaConfig = getSepoliaConfig();
export const publicClientSepolia = createPublicClient({
  chain: sepoliaConfig.chain,
  transport: http(sepoliaConfig.rpcUrl),
});

/** Public client for the given chain (portfolio view only). */
export function getPublicClientForChain(chain: PortfolioChain) {
  return chain === "mainnet" ? publicClient : publicClientSepolia;
}

export const getWalletClient = (account: `0x${string}`) =>
  createWalletClient({
    chain: mainnetConfig.chain,
    transport: http(mainnetConfig.rpcUrl),
    account: account,
  });
