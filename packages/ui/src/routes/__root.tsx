import { createRootRoute, Outlet } from "@tanstack/react-router";

function RootComponent() {
	return (
		<div className="min-h-screen flex flex-col relative overflow-x-hidden">
			<div className="relative flex flex-col min-h-screen flex-1">
				<main className="flex flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
					{/* Left empty space - visible on desktop only */}
					<div
						className="flex-1 min-w-0 hidden md:block bg-[#FAFAFA]"
						aria-hidden
					/>
					{/* Center: mobile-first content (max 430px) */}
					<div className="w-full max-w-[430px] min-w-0 shrink-0 flex flex-col overflow-hidden bg-background">
						<Outlet />
					</div>
					{/* Right empty space - visible on desktop only, shows body pattern */}
					<div
						className="flex-1 min-w-0 hidden md:block"
						aria-hidden
					/>
				</main>
			</div>
		</div>
	)
}

export const Route = createRootRoute({
	component: RootComponent,
});
