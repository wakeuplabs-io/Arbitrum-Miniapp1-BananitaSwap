import { Button } from '@/components/ui/button'

type AuthLogEntry = {
	id: string
	time: string
	message: string
}

type LemonMiniappContextDebugProps = {
	wallet: string | undefined
	isAuthenticated: boolean
	isInLemonWebView: boolean
	isAuthenticating: boolean
	authLogs: AuthLogEntry[]
	onClearAuthLogs: () => void
}

export function LemonMiniappContextDebug({
	wallet,
	isAuthenticated,
	isInLemonWebView,
	isAuthenticating,
	authLogs,
	onClearAuthLogs,
}: LemonMiniappContextDebugProps) {
	return (
		<div className="px-4 space-y-3">
			<h3 className="text-xs font-display font-semibold uppercase tracking-wide text-muted-foreground">
				LemonMiniapp context
			</h3>
			<div className="grid gap-2">
				<DebugField label="wallet" value={wallet ?? '—'} />
				<DebugField label="isAuthenticated" value={String(isAuthenticated)} />
				<DebugField label="isInLemonWebView" value={String(isInLemonWebView)} />
				<DebugField label="isAuthenticating" value={String(isAuthenticating)} />
			</div>
			<div className="flex flex-col gap-1">
				<div className="flex items-center justify-between">
					<label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
						Auth flow logs
					</label>
					{authLogs.length > 0 && (
						<Button
							type="button"
							variant="ghost"
							size="xs"
							onClick={onClearAuthLogs}
							className="h-6 text-[10px]"
						>
							Clear
						</Button>
					)}
				</div>
				<div className="rounded-lg border border-border bg-muted/50 px-3 py-2 max-h-40 overflow-y-auto font-mono text-[10px] text-foreground space-y-1">
					{authLogs.length === 0 ? (
						<span className="text-muted-foreground">No logs yet.</span>
					) : (
						authLogs.map((entry) => (
							<div key={entry.id} className="flex gap-2 flex-wrap">
								<span className="text-muted-foreground shrink-0">{entry.time}</span>
								<span>{entry.message}</span>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	)
}

function DebugField({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-1">
			<label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
				{label}
			</label>
			<input
				readOnly
				value={value}
				className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-mono text-foreground"
			/>
		</div>
	)
}
