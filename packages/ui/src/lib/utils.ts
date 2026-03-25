import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉'

function toSubscript(n: number): string {
	if (n <= 9) return SUBSCRIPT_DIGITS[n]
	return String(n)
		.split('')
		.map((d) => SUBSCRIPT_DIGITS[parseInt(d, 10)])
		.join('')
}

/**
 * Format token price for display. Uses DexScreener-style subscript notation for
 * very small values (e.g. $0.0₄4904 for 0.00004904, $0.0₁₀5418 for 5.4e-11).
 */
export function formatPrice(price: number): string {
	if (!Number.isFinite(price) || price <= 0) return '$0'
	if (price >= 0.001) {
		if (price >= 1000)
			return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
		if (price < 1) return `$${price.toFixed(4)}`
		return `$${price.toFixed(2)}`
	}

	// Compact DexScreener-style: $0.0ₙXXXX (subscript = count of leading zeros)
	const [mantissa, exp] = price.toExponential(4).split('e').map(Number)
	const leadingZeros = Math.abs(exp) - 1
	const sig = Math.round(mantissa * 1000)
		.toString()
		.padStart(4, '0')
		.slice(0, 4)
	const subscript = toSubscript(leadingZeros)
	return `$0.0${subscript}${sig}`
}

/**
 * Format token amount for compact display (e.g. in portfolio list).
 * Truncates to avoid long decimal strings like "0.001671329823159021".
 */
export function formatTokenAmount(amount: number): string {
	if (!Number.isFinite(amount) || amount <= 0) return '0'
	if (amount >= 1000) return amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
	if (amount >= 1) return amount.toFixed(3)
	if (amount >= 0.01) return amount.toFixed(4)
	if (amount >= 0.0001) return amount.toFixed(5)
	if (amount >= 0.00001) return amount.toFixed(6)
	return amount.toExponential(2)
}
