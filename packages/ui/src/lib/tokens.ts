import { getUsdcToken } from "@/hooks/use-tokens"

export type Token = {
	symbol: string
	name: string
	icon: string
	logoUrl?: string
	color: string
	price: number
	change24h: number
	marketCap: string
	balance?: number
	address?: string
	chainId?: string
	dexId?: string
	pairAddress?: string // Pool/pair contract address (for swapping and DexScreener embed)
}

export const USER_HOLDINGS: { token: Token; amount: number }[] = [
	{ token: getUsdcToken(), amount: 150 },
]

/** Total balance in USDC = sum of all holdings valued in USD */
export function getTotalBalanceUsdc(): number {
	return USER_HOLDINGS.reduce((sum, { token, amount }) => sum + amount * token.price, 0)
}