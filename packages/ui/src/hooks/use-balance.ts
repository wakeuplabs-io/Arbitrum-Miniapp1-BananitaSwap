import { useQuery } from '@tanstack/react-query'
import env from '@/env-parsed'
import { getTotalBalanceUsdc } from '@/lib/tokens'

export type BalanceData = {
	balanceUsd: number
	changePercent: number
}

async function fetchBalance(): Promise<BalanceData> {
	// Simulate brief load when using mock (makes loading state visible in dev)
	if (env.MOCK_API) {
		await new Promise((r) => setTimeout(r, 250))
	}
	return {
		balanceUsd: getTotalBalanceUsdc(),
		changePercent: 0,
	}
}

export function useBalance() {
	const query = useQuery({
		queryKey: ['balance'],
		queryFn: fetchBalance,
		staleTime: 60 * 1000,
	})

	return {
		balanceUsd: query.data?.balanceUsd ?? 0,
		changePercent: query.data?.changePercent ?? 0,
		isLoading: query.isLoading,
		error: query.error,
	}
}
