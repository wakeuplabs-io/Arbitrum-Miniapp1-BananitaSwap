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
			<div className="relative flex flex-col min-h-screen flex-1">
				<main className="flex flex-1 min-h-0 overflow-auto">
					{/* Left empty space - visible on desktop only */}
					<div
						className="flex-1 min-w-0 hidden md:block bg-[#FAFAFA]"
						aria-hidden
					/>
					{/* Center: mobile-first content (max 430px) */}
					<div className="w-full max-w-[430px] shrink-0 flex flex-col min-h-0 bg-background">
						<Outlet />
					</div>
					{/* Right empty space - visible on desktop only, shows body pattern */}
					<div
						className="flex-1 min-w-0 hidden md:block"
						aria-hidden
					/>
				</main>
				<TanStackRouterDevtools />
			</div>
		</div>
	)
}

export const Route = createRootRoute({
  component: RootComponent,
});
