import envParsed from '@/env-parsed'
import { ROUTER_PROVIDER_ID_DEFAULT } from './router-provider-ids'
import { getPortfolioChainFromEnv, type PortfolioChain } from './network'
import { getAddress, isAddress, parseAbi, type Address } from 'viem'

export type ChainKey = PortfolioChain

export const routerAbi = parseAbi([
	// Swap execution
	'function buy(address token, uint256 usdc_amount, uint256 min_token_out, uint8 provider_id, uint256 deadline) returns (uint256)',
	'function sell(address token, uint256 token_amount, uint256 min_usdc_out, uint8 provider_id, uint256 deadline) returns (uint256)',

	// Minimal read helpers (useful for validating config in the future)
	'function getUsdc() view returns (address)',
	'function getFeeBps() view returns (uint256)',
	'function getAdapter(uint8 id) view returns (address)',
])

type EnvContractConfig = {
	VITE_ROUTER_ADDRESS_SEPOLIA?: string
	VITE_ROUTER_ADDRESS_MAINNET?: string
}

function getContractEnv(): EnvContractConfig {
	return envParsed as unknown as EnvContractConfig
}

function parseEnvAddress(raw: string | undefined, label: string): Address {
	if (!raw) {
		throw new Error(`Missing ${label}. Set it in ${'ui/.env.example'} and your .env.`)
	}

	if (!isAddress(raw)) {
		throw new Error(`Invalid address for ${label}: ${raw}`)
	}

	return getAddress(raw)
}

export function getActiveChainKey(): ChainKey {
	return getPortfolioChainFromEnv()
}

export function getRouterAddressByNetwork(network: ChainKey): Address {
	const env = getContractEnv()
	const label =
		network === 'mainnet' ? 'VITE_ROUTER_ADDRESS_MAINNET' : 'VITE_ROUTER_ADDRESS_SEPOLIA'

	const raw = network === 'mainnet' ? env.VITE_ROUTER_ADDRESS_MAINNET : env.VITE_ROUTER_ADDRESS_SEPOLIA
	return parseEnvAddress(raw, label)
}

export function getDefaultProviderId(): number {
	return ROUTER_PROVIDER_ID_DEFAULT
}

