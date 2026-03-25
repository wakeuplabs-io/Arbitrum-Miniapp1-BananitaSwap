import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
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
})

/**
 * GET /tokens
 * Returns USDC-paired tokens on Arbitrum from Camelot v2/v3 + Uniswap v3 subgraphs.
 * Query params: camelotOnly, uniswapOnly
 */
tokensRouter.get('/', zValidator('query', querySchema), async (c) => {
	const { camelotOnly, uniswapOnly } = c.req.valid('query')

	try {
		const result = await fetchUsdcPairedTokens({
			camelotOnly: camelotOnly ?? false,
			uniswapOnly: uniswapOnly ?? false,
		})
		return c.json(result)
	} catch (error) {
		console.error('[Tokens] Fetch failed:', error)
		const msg = error instanceof Error ? error.message : 'Failed to fetch tokens'
		return c.json({ error: msg }, 500)
	}
})
