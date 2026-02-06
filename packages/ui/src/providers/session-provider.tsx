import { getNetworkConfig } from "@/shared/config/network";
import { useWallets } from "@privy-io/react-auth";
import { createContext, type ReactNode, useEffect } from "react";

const SessionContext = createContext<undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { chain } = getNetworkConfig();
  const { wallets } = useWallets();

  useEffect(() => {
    async function switchDefaultChain() {
      const connected = wallets?.[0];
      if (!connected) return;

      const chainId = connected.chainId;

      if (chainId !== chain.id.toString()) {
        await connected.switchChain(chain.id);
      }
    }
    switchDefaultChain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  return <SessionContext.Provider value={undefined}>{children}</SessionContext.Provider>;
}
