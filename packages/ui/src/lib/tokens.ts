import type { ApiSwapTokenVenue } from '@/services/tokens-api'
import { getUsdcToken } from "@/hooks/use-tokens"

export type Token = {
	symbol: string
	name: string
	icon: string
	logoUrl?: string
	color: string
	price: number
	change24h: number | undefined // undefined = no 24h data (show "-")
	marketCap: string
	balance?: number
	address?: string
	chainId?: string
	dexId?: string
	/** Router adapter id from GET /tokens; omit when token metadata is DexScreener-only. */
	providerId?: number
	/** All V3 direct venues returned by API (exactInputSingle-capable). */
	swapVenues?: ApiSwapTokenVenue[]
	pairAddress?: string // Pool/pair contract address (for swapping and DexScreener embed)
}

export const USER_HOLDINGS: { token: Token; amount: number }[] = [
	{ token: getUsdcToken(), amount: 150 },
]

/** Total balance in USDC = sum of all holdings valued in USD */
export function getTotalBalanceUsdc(): number {
	return USER_HOLDINGS.reduce((sum, { token, amount }) => sum + amount * token.price, 0)
}