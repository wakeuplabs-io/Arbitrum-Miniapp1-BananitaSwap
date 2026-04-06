import type { Address, PublicClient } from 'viem'
import { routerAbi } from '@/shared/config/contracts'
import {
	ROUTER_PROVIDER_ID_CAMELOT,
	ROUTER_PROVIDER_ID_DEFAULT,
	ROUTER_PROVIDER_ID_UNISWAP,
} from '@/shared/config/router-provider-ids'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * Picks the first `provider_id` with a non-zero adapter on the router.
 * Order: preferred → Uniswap → Camelot → default (so Camelot-listed tokens still swap when
 * only the Uniswap adapter is registered on-chain, which matches current deploy scripts).
 */
export async function resolveRouterProviderId(
	publicClient: PublicClient,
	routerAddress: Address,
	preferredId: number
): Promise<{ providerId: number; adapterAddress: Address }> {
	const order = [
		...new Set([
			preferredId,
			ROUTER_PROVIDER_ID_UNISWAP,
			ROUTER_PROVIDER_ID_CAMELOT,
			ROUTER_PROVIDER_ID_DEFAULT,
		]),
	]

	for (const id of order) {
		const adapterAddress = (await publicClient.readContract({
			address: routerAddress,
			abi: routerAbi,
			functionName: 'getAdapter',
			args: [id],
		})) as Address

		if (adapterAddress.toLowerCase() !== ZERO_ADDRESS) {
			return { providerId: id, adapterAddress }
		}
	}

	throw new Error(
		`No swap adapter registered on router ${routerAddress} (tried provider ids: ${order.join(', ')})`
	)
}
