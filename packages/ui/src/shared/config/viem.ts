import { getNetworkConfig } from "./network";
import { createPublicClient, createWalletClient, http } from "viem";

const { chain, rpcUrl } = getNetworkConfig();
export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

export const getWalletClient = (account: `0x${string}`) =>
  createWalletClient({
    chain,
    transport: http(rpcUrl),
    account: account,
  });
