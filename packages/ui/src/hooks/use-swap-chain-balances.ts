import { useQuery } from '@tanstack/react-query'
import { formatUnits, parseAbi, type Address } from 'viem'
import { getPublicClientForChain } from '@/shared/config/viem'
import { useLemonMiniapp } from '@/providers/lemon-miniapp-provider'
import {
	ARBITRUM_MAINNET_USDC_ADDRESS,
	ARBITRUM_SEPOLIA_USDC_ADDRESS,
	type PortfolioChain,
} from '@/shared/config/network'

const ERC20_ABI = parseAbi([
	'function balanceOf(address owner) view returns (uint256)',
	'function decimals() view returns (uint8)',
])

async function fetchErc20BalanceHuman(
	chain: PortfolioChain,
	walletAddress: Address,
	tokenAddress: Address
): Promise<number> {
	const client = getPublicClientForChain(chain)
	const results = await client.multicall({
		contracts: [
			{
				address: tokenAddress,
				abi: ERC20_ABI,
				functionName: 'balanceOf',
				args: [walletAddress],
			},
			{ address: tokenAddress, abi: ERC20_ABI, functionName: 'decimals' },
		],
		allowFailure: true,
	})
	const balRes = results[0]
	const decRes = results[1]
	if (balRes.status !== 'success') return 0
	const decimals = decRes.status === 'success' ? Number(decRes.result) : 18
	return parseFloat(formatUnits(balRes.result, decimals))
}

/** Single-token USDC balance for swap / home (one multicall). */
export function useUsdcBalance(chain: PortfolioChain = 'mainnet') {
	const { wallet } = useLemonMiniapp()
	const tokenAddress = (
		chain === 'mainnet' ? ARBITRUM_MAINNET_USDC_ADDRESS : ARBITRUM_SEPOLIA_USDC_ADDRESS
	) as Address

	return useQuery({
		queryKey: ['usdc-balance', wallet, chain],
		queryFn: async () => {
			if (!wallet) return 0
			return fetchErc20BalanceHuman(chain, wallet as Address, tokenAddress)
		},
		enabled: !!wallet,
		staleTime: 30 * 1000,
	})
}

/** ERC-20 balance for one address (e.g. sell token on swap). */
export function useErc20BalanceOnChain(
	tokenAddress: string | undefined,
	chain: PortfolioChain = 'mainnet'
) {
	const { wallet } = useLemonMiniapp()
	const addr = tokenAddress as Address | undefined

	return useQuery({
		queryKey: ['erc20-balance', wallet, chain, tokenAddress?.toLowerCase() ?? ''],
		queryFn: async () => {
			if (!wallet || !addr) return 0
			return fetchErc20BalanceHuman(chain, wallet as Address, addr)
		},
		enabled: !!wallet && !!addr,
		staleTime: 30 * 1000,
	})
}
