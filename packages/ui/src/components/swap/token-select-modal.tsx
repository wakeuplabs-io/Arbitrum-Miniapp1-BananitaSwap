import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import {
	Dialog,
	DialogContent,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TokenIcon } from './token-icon'
import { TOKENS } from '@/lib/tokens'
import type { Token } from '@/lib/tokens'

type TokenSelectModalProps = {
	onClose: () => void
	onSelect?: (token: Token) => void
	excludeSymbol?: string
	navigateToDetailOnSelect?: boolean
}

export function TokenSelectModal({
	onClose,
	onSelect,
	excludeSymbol,
	navigateToDetailOnSelect = false,
}: TokenSelectModalProps) {
	const navigate = useNavigate()
	const [query, setQuery] = useState('')

	function handleSelectToken(token: Token) {
		if (navigateToDetailOnSelect) {
			onClose()
			navigate({ to: '/token/$symbol', params: { symbol: token.symbol } })
		} else if (onSelect) {
			onSelect(token)
			onClose()
		}
	}

	const filteredTokens = TOKENS.filter((t) => {
		if (excludeSymbol && t.symbol === excludeSymbol) return false
		if (!query) return true
		return (
			t.symbol.toLowerCase().includes(query.toLowerCase()) ||
			t.name.toLowerCase().includes(query.toLowerCase())
		)
	})

	function formatPrice(price: number) {
		if (price < 0.001) return `$${price.toFixed(7)}`
		if (price < 1) return `$${price.toFixed(4)}`
		if (price >= 1000)
			return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
		return `$${price.toFixed(2)}`
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent fullScreen showCloseButton={false} className="overflow-hidden">
				<div className="flex flex-1 flex-col overflow-hidden">
					<div className="px-4 pt-6 pb-4">
						<div className="flex items-center gap-3 rounded-full border-2 border-border bg-card px-4 py-3 shadow-sm">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={onClose}
								aria-label="Back"
								className="shrink-0 rounded-full hover:!bg-muted hover:!text-foreground focus-visible:!ring-0 focus-visible:!ring-offset-0 active:!bg-muted"
							>
								<ArrowLeft className="w-5 h-5 text-muted-foreground" />
							</Button>
							<Input
								type="search"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search by name or address"
								aria-label="Search tokens"
								className="border-0 bg-transparent text-sm font-sans text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
								autoFocus
							/>
						</div>
					</div>

					<div className="px-4 pb-3">
						<h3 className="text-base font-display font-bold uppercase tracking-wide text-foreground">
							Whitelist Tokens
						</h3>
					</div>

					<div className="flex-1 overflow-y-auto px-4 pb-6 stagger-slide-up">
						{filteredTokens.map((token) => (
							<button
								key={token.symbol}
								type="button"
								onClick={() => handleSelectToken(token)}
								className="flex w-full items-center gap-3 px-3 py-4 rounded-2xl transition-colors hover:bg-muted/50 active:bg-muted tap-scale"
							>
								<TokenIcon
									symbol={token.symbol}
									color={token.color}
									logoUrl={token.logoUrl}
									size={40}
								/>
								<div className="flex min-w-0 flex-1 flex-col items-start">
									<span className="text-sm font-display font-semibold text-foreground">
										{token.symbol}
									</span>
									<span className="text-xs font-sans text-muted-foreground">
										{token.marketCap} Market Cap
									</span>
								</div>
								<div className="flex shrink-0 flex-col items-end">
									<span className="text-sm numeric font-semibold text-foreground">
										{formatPrice(token.price)}
									</span>
									<span
										className={`text-xs numeric ${
											token.change24h >= 0 ? 'text-success' : 'text-destructive'
										}`}
									>
										{token.change24h >= 0 ? '+' : ''}
										{token.change24h.toFixed(3)}%
									</span>
								</div>
							</button>
						))}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
