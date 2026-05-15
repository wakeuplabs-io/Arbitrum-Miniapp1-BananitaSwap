/**
 * Swap amount text fields: accept comma or dot as decimal separator (mobile keyboards),
 * normalize to a numeric value internally; reject mixed / multiple separators.
 */

export const MAX_SWAP_INPUT_DECIMALS = 10
export const MAX_SELL_PERCENT_OF_BALANCE = 0.9999

const ARABIC_DECIMAL = /[\u066B\u066C]/g

/**
 * Some mobile keyboards send fullwidth or locale punctuation instead of ASCII , / .
 * Normalize to ASCII before stripping unknown characters.
 */
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

/**
 * Sanitize live keyboard input: keep digits and at most one decimal separator.
 * Stops before a second separator of any kind. Rejects mixed comma+dot (returns previous).
 */
export function sanitizeSwapAmountInput(raw: string, previous: string): string {
	const cleaned = stripToAllowedChars(raw)
	if (hasMixedDecimalSeparators(cleaned)) {
		return previous
	}

	let out = ''
	let sepSeen = false
	for (const ch of cleaned) {
		if (ch >= '0' && ch <= '9') {
			out += ch
			continue
		}
		if (ch === '.' || ch === ',') {
			if (sepSeen) {
				break
			}
			out += ch
			sepSeen = true
		}
	}
	return out
}

/**
 * Normalize display string to a single dot for parseFloat / APIs (comma → dot).
 */
export function normalizedSwapAmountDotString(display: string): string {
	return stripToAllowedChars(display).replace(/,/g, '.')
}

/**
 * Parse sanitized swap amount to a number. Empty or incomplete (e.g. "-" only) → 0.
 * Uses the same alias normalization as live input so mobile / fullwidth commas parse correctly.
 */
export function parseSwapAmountToNumber(display: string): number {
	const trimmed = display.trim()
	if (!trimmed) {
		return 0
	}
	const normalized = stripToAllowedChars(trimmed)
	if (!normalized) {
		return 0
	}
	if (hasMixedDecimalSeparators(normalized)) {
		return NaN
	}
	const dots = countChar(normalized, '.')
	const commas = countChar(normalized, ',')
	if (dots > 1 || commas > 1 || (dots === 1 && commas === 1)) {
		return NaN
	}
	const n = Number.parseFloat(normalized.replace(/,/g, '.'))
	return Number.isFinite(n) ? n : NaN
}

function floorToDecimals(value: number, decimals: number): number {
	if (!Number.isFinite(value) || value <= 0) return 0
	const multiplier = Math.pow(10, decimals)
	return Math.floor(value * multiplier) / multiplier
}

function toNonExponentialString(value: number): string {
	if (!Number.isFinite(value)) return ''
	return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 })
}

/**
 * Format amount for input display: floor to max decimals, trim trailing zeros, no exponential notation.
 */
export function formatAmountForInput(value: number, maxDecimals: number = MAX_SWAP_INPUT_DECIMALS): string {
	if (!Number.isFinite(value) || value <= 0) return ''
	const floored = floorToDecimals(value, maxDecimals)
	const str = toNonExponentialString(floored)
	// Trim trailing zeros after decimal point
	return str.replace(/\.?0+$/, '')
}

export const SWAP_AMOUNT_ERROR_MIXED_SEPARATORS =
	'Use either a comma or a dot as the decimal separator, not both.'

export const SWAP_AMOUNT_ERROR_INVALID = 'Enter a valid amount.'

/** Non-null when the current field text cannot be parsed as a single-decimal amount. */
export function getSwapAmountFormatError(display: string): string | null {
	const trimmed = display.trim()
	if (!trimmed) {
		return null
	}
	const normalized = stripToAllowedChars(trimmed)
	if (!normalized) {
		return SWAP_AMOUNT_ERROR_INVALID
	}
	if (hasMixedDecimalSeparators(normalized)) {
		return SWAP_AMOUNT_ERROR_MIXED_SEPARATORS
	}
	const dots = countChar(normalized, '.')
	const commas = countChar(normalized, ',')
	if (dots > 1 || commas > 1) {
		return SWAP_AMOUNT_ERROR_INVALID
	}
	const n = Number.parseFloat(normalized.replace(/,/g, '.'))
	if (!Number.isFinite(n)) {
		return SWAP_AMOUNT_ERROR_INVALID
	}
	return null
}
