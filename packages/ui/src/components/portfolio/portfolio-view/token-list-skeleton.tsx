export function TokenListSkeleton() {
	return (
		<div className="flex flex-col gap-4">
			{Array.from({ length: 3 }).map((_, index) => (
				<div
					key={index}
					className="flex items-center gap-4 py-4 px-4 rounded-3xl bg-card border-2 border-border w-full animate-pulse"
				>
					<div className="w-10 h-10 rounded-full bg-muted shrink-0" />
					<div className="flex flex-col min-w-0 flex-1 gap-2">
						<div className="h-4 w-24 bg-muted rounded" />
						<div className="h-3 w-16 bg-muted rounded" />
					</div>
					<div className="flex flex-col items-end shrink-0 mr-1 gap-2">
						<div className="h-4 w-20 bg-muted rounded" />
						<div className="h-3 w-16 bg-muted rounded" />
					</div>
					<div className="flex flex-col gap-1.5 shrink-0">
						<div className="h-8 w-16 bg-muted rounded-full" />
						<div className="h-8 w-16 bg-muted rounded-full" />
					</div>
				</div>
			))}
		</div>
	)
}
