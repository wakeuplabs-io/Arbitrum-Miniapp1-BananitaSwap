/**
 * Swap / quote amount strings: same rules as UI (comma or dot decimal; no mixed or repeated separators).
 * Keep parsing aligned with packages/ui/src/lib/swap-amount-input.ts when changing behavior.
 */

import { z } from 'zod'

const ARABIC_DECIMAL = /[\u066B\u066C]/g

function normalizeSeparatorAliases(raw: string): string {
	return raw
		.replace(/\uFF0C/g, ',')
		.replace(/[\uFF0E\u3002\u00B7\u2219]/g, '.')
		.replace(ARABIC_DECIMAL, '.')
}

function stripToAllowedChars(raw: string): string {
	return normalizeSeparatorAliases(raw).replace(/[^0-9.,]/g, '')
}

function countChar(s: string, ch: string): number {
	let n = 0
	for (let i = 0; i < s.length; i++) {
		if (s[i] === ch) n++
	}
	return n
}

function hasMixedDecimalSeparators(s: string): boolean {
	return s.includes(',') && s.includes('.')
}

export type SwapAmountParseFailureCode = 'empty' | 'invalid_format' | 'mixed_separators'

export type SwapAmountParseResult =
	| { ok: true; value: number; normalizedDotString: string }
	| { ok: false; code: SwapAmountParseFailureCode }

/**
 * Parse a swap amount from user or query input after trimming.
 * Use normalizedDotString for consistent downstream decimal representation (e.g. logs, BigInt helpers).
 */
export function parseSwapAmountString(raw: string): SwapAmountParseResult {
	const trimmed = raw.trim()
	const cleaned = stripToAllowedChars(trimmed)

	if (!cleaned) {
		return trimmed.length > 0 ? { ok: false, code: 'invalid_format' } : { ok: false, code: 'empty' }
	}

	if (hasMixedDecimalSeparators(cleaned)) {
		return { ok: false, code: 'mixed_separators' }
	}

	const dots = countChar(cleaned, '.')
	const commas = countChar(cleaned, ',')
	if (dots > 1 || commas > 1) {
		return { ok: false, code: 'invalid_format' }
	}

	const normalizedDotString = cleaned.replace(/,/g, '.')
	const value = Number.parseFloat(normalizedDotString)
	if (!Number.isFinite(value)) {
		return { ok: false, code: 'invalid_format' }
	}

	return { ok: true, value, normalizedDotString }
}

const swapAmountErrorMessages: Record<SwapAmountParseFailureCode, string> = {
	empty: 'Amount is required.',
	invalid_format: 'Enter a valid amount.',
	mixed_separators: 'Use either a comma or a dot as the decimal separator, not both.',
}

export function swapAmountParseErrorMessage(code: SwapAmountParseFailureCode): string {
	return swapAmountErrorMessages[code]
}

/**
 * Positive finite amount from a string (query/body). Output type is number after parse.
 * Use in route validators, e.g. z.object({ amount: zPositiveSwapAmountFromString }).
 */
export const zPositiveSwapAmountFromString = z.string().transform((val, ctx) => {
	const parsed = parseSwapAmountString(val)
	if (!parsed.ok) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: swapAmountParseErrorMessage(parsed.code),
		})
		return z.NEVER
	}
	if (parsed.value <= 0) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Amount must be greater than zero.',
		})
		return z.NEVER
	}
	return parsed.value
})
