export type Token = {
	symbol: string
	name: string
	icon: string
	logoUrl: string
	color: string
	price: number
	change24h: number
	marketCap: string
	balance?: number
}

export const TOKENS: Token[] = [
	{
		symbol: 'USDC',
		name: 'USD Coin',
		icon: 'usdc',
		logoUrl: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
		color: '#2775CA',
		price: 1.0,
		change24h: 0,
		marketCap: '$32B',
		balance: 150,
	},
	{
		symbol: 'ETH',
		name: 'Ethereum',
		icon: 'eth',
		logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
		color: '#627EEA',
		price: 2650.42,
		change24h: 1.85,
		marketCap: '$318B',
		balance: 0.0075,
	},
	{
		symbol: 'WBTC',
		name: 'Wrapped Bitcoin',
		icon: 'wbtc',
		logoUrl: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
		color: '#F09242',
		price: 100000,
		change24h: -0.267,
		marketCap: '$1990B',
	},
	{
		symbol: 'ARB',
		name: 'Arbitrum',
		icon: 'arb',
		logoUrl: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
		color: '#213147',
		price: 1.12,
		change24h: 3.42,
		marketCap: '$4.3B',
		balance: 25.0,
	},
	{
		symbol: 'SOL',
		name: 'Solana',
		icon: 'sol',
		logoUrl: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
		color: '#9945FF',
		price: 230.95,
		change24h: 1.02,
		marketCap: '$110B',
	},
	{
		symbol: 'BONK',
		name: 'Bonk',
		icon: 'bonk',
		logoUrl: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg',
		color: '#F2A52B',
		price: 0.0000394,
		change24h: -0.243,
		marketCap: '$3.7B',
	},
]

/** Set to true to show all empty states (tokens, avatar). Set to false to restore normal view. */
export const DEV_SHOW_EMPTY_STATES = false

const NORMAL_HOLDINGS: { token: Token; amount: number }[] = [
	{ token: TOKENS[0], amount: 150 },
]

export const USER_HOLDINGS: { token: Token; amount: number }[] = DEV_SHOW_EMPTY_STATES
	? []
	: NORMAL_HOLDINGS

/** Total balance in USDC = sum of all holdings valued in USD */
export function getTotalBalanceUsdc(): number {
	return USER_HOLDINGS.reduce((sum, { token, amount }) => sum + amount * token.price, 0)
}