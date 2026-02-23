import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { QueryProvider } from "./providers/query-provider";
import { LemonMiniappProvider } from "./providers/lemon-miniapp-provider";
import { RouterProvider } from "./providers/router-provider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryProvider>
      <LemonMiniappProvider>
        <RouterProvider />
      </LemonMiniappProvider>
    </QueryProvider>
  </React.StrictMode>
);
