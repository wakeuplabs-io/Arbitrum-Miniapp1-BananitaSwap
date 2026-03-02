import { getMainnetConfig, getNetworkConfig } from "./network";
import type { PortfolioChain } from "./network";
import { createPublicClient, createWalletClient, http } from "viem";

const appConfig = getNetworkConfig();
export const publicClient = createPublicClient({
  chain: appConfig.chain,
  transport: http(appConfig.rpcUrl),
});

const mainnetConfig = getMainnetConfig();
export const publicClientMainnet = createPublicClient({
  chain: mainnetConfig.chain,
  transport: http(mainnetConfig.rpcUrl),
});

/** Public client for the given chain (portfolio view only). */
export function getPublicClientForChain(chain: PortfolioChain) {
  return chain === "mainnet" ? publicClientMainnet : publicClient;
}

export const getWalletClient = (account: `0x${string}`) =>
  createWalletClient({
    chain: appConfig.chain,
    transport: http(appConfig.rpcUrl),
    account: account,
  });
