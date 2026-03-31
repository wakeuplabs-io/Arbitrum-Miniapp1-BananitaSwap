import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import eruda from "eruda";

if (import.meta.env.DEV) {
  eruda.init();
}
import { QueryProvider } from "./providers/query-provider";
import { LemonMiniappProvider } from "./providers/lemon-miniapp-provider";
import { RouterProvider } from "./providers/router-provider";
import { PortfolioChainProvider } from "./contexts/portfolio-chain-context";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryProvider>
      <LemonMiniappProvider>
        <PortfolioChainProvider>
          <RouterProvider />
        </PortfolioChainProvider>
      </LemonMiniappProvider>
    </QueryProvider>
  </React.StrictMode>
);
