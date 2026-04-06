import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { applySwapTokenAllowlist, isSwapTokenAllowlistEnabledFromEnv } from '../services/token-allowlist-filter.js'
import { fetchUsdcPairedTokens } from '../services/tokens.js'

export const tokensRouter = new Hono()

const querySchema = z.object({
	camelotOnly: z
		.string()
		.optional()
		.transform((v) => v === 'true' || v === '1'),
	uniswapOnly: z
		.string()
		.optional()
		.transform((v) => v === 'true' || v === '1'),
	allowlist: z
		.string()
		.optional()
		.transform((v) => {
			if (v === undefined) return undefined
			if (v === 'true' || v === '1') return true
			if (v === 'false' || v === '0') return false
			return undefined
		}),
})

/**
 * GET /tokens
 * Returns USDC-paired tokens (V3 direct pools only) from Camelot v3 + Uniswap v3 subgraphs, aligned with router USDC and Uniswap fee tier.
 * Query params: camelotOnly, uniswapOnly, allowlist (optional; env TOKENS_APPLY_SWAP_ALLOWLIST when omitted).
 */
tokensRouter.get('/', zValidator('query', querySchema), async (c) => {
	const { camelotOnly, uniswapOnly, allowlist: allowlistOverride } = c.req.valid('query')

	try {
		let result = await fetchUsdcPairedTokens({
			camelotOnly: camelotOnly ?? false,
			uniswapOnly: uniswapOnly ?? false,
		})
		const useAllowlist =
			allowlistOverride !== undefined ? allowlistOverride : isSwapTokenAllowlistEnabledFromEnv()

		if (useAllowlist) {
			const filtered = applySwapTokenAllowlist(result)
			if (filtered.tokens.length === 0 && result.tokens.length > 0) {
				console.warn(
					'[Tokens] Allowlist enabled but matched 0 tokens; falling back to unfiltered list'
				)
			} else {
				result = filtered
			}
		}
		return c.json(result)
	} catch (error) {
		console.error('[Tokens] Fetch failed:', error)
		const msg = error instanceof Error ? error.message : 'Failed to fetch tokens'
		return c.json({ error: msg }, 500)
	}
})
