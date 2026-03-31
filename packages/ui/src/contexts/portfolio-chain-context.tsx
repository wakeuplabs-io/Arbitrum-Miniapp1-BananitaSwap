import {
	createContext,
	useContext,
	useState,
	useCallback,
	type ReactNode,
} from 'react'
import type { PortfolioChain } from '@/shared/config/network'
import envParsed from '@/env-parsed'

type PortfolioChainContextType = {
	portfolioChain: PortfolioChain
	setPortfolioChain: (chain: PortfolioChain) => void
}

const PortfolioChainContext = createContext<PortfolioChainContextType | undefined>(
	undefined
)

function getDefaultPortfolioChain(): PortfolioChain {
	const isTestEnv = envParsed.IS_TESTNET
	return isTestEnv ? 'sepolia' : 'mainnet'
}

export function PortfolioChainProvider({ children }: { children: ReactNode }) {
	const [portfolioChain, setPortfolioChainState] = useState<PortfolioChain>(
		getDefaultPortfolioChain
	)
	const setPortfolioChain = useCallback((chain: PortfolioChain) => {
		setPortfolioChainState(chain)
	}, [])

	return (
		<PortfolioChainContext.Provider
			value={{ portfolioChain, setPortfolioChain }}
		>
			{children}
		</PortfolioChainContext.Provider>
	)
}

export function usePortfolioChain(): PortfolioChainContextType {
	const ctx = useContext(PortfolioChainContext)
	if (ctx === undefined) {
		throw new Error('usePortfolioChain must be used within PortfolioChainProvider')
	}
	return ctx
}

/** Returns portfolio chain when inside provider, otherwise undefined (e.g. on swap screen). */
export function usePortfolioChainOptional(): PortfolioChain | undefined {
	const ctx = useContext(PortfolioChainContext)
	return ctx?.portfolioChain
}
