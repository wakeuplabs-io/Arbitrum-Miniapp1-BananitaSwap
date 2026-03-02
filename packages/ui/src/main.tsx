import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { QueryProvider } from "./providers/query-provider";
import { LemonMiniappProvider } from "./providers/lemon-miniapp-provider";
import { RouterProvider } from "./providers/router-provider";
import { PortfolioChainProvider } from "./contexts/portfolio-chain-context";
import { MockTokenStateProvider } from "./contexts/mock-token-state";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryProvider>
      <LemonMiniappProvider>
        <PortfolioChainProvider>
          <MockTokenStateProvider>
            <RouterProvider />
          </MockTokenStateProvider>
        </PortfolioChainProvider>
      </LemonMiniappProvider>
    </QueryProvider>
  </React.StrictMode>
);
