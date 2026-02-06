import { createRootRoute, Outlet } from "@tanstack/react-router";
import React from "react";

const TanStackRouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null // Render nothing in production
    : React.lazy(() =>
      /* eslint-disable indent */
      import("@tanstack/router-devtools").then((res) => ({
        default: res.TanStackRouterDevtools,
      }))
    );

function RootComponent() {


  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="relative flex flex-col min-h-screen">
        <main className="flex flex-1 min-h-0 overflow-auto">
          <Outlet />
        </main>
        <TanStackRouterDevtools />
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
