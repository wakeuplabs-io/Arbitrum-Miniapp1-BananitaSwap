/**
 * Auth API for Lemon Mini App SIWE flow.
 * @see https://lemoncash.mintlify.app/functions/authenticate
 */
import envParsed from '@/env-parsed'

/**
 * Fetches a unique nonce from the backend for SIWE.
 * Nonce must be at least 8 alphanumeric characters.
 */
export async function fetchNonce(): Promise<string> {
  const res = await fetch(`${envParsed.API_URL}/auth/nonce`, { method: 'POST' })
  if (!res.ok) {
    throw new Error(`Failed to get nonce: ${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  const nonce = json?.nonce
  if (typeof nonce !== 'string' || nonce.length < 8) {
    throw new Error('Invalid nonce from backend')
  }
  return nonce
}

/**
 * Generates a fallback nonce when backend is unavailable (e.g. dev).
 * Should be replaced by backend nonce in production.
 */
export function generateFallbackNonce(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < 16; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export type VerifyPayload = {
  wallet: string
  signature: string
  message: string
  nonce: string
}

export type VerifyResult = { verified: boolean; error?: string }

/**
 * Verifies SIWE signature on the backend.
 */
export async function verifySignature(payload: VerifyPayload): Promise<VerifyResult> {
  const res = await fetch(`${envParsed.API_URL}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    return { verified: false, error: `${res.status} ${res.statusText}` }
  }
  const json = await res.json()
  return {
    verified: !!json?.verified,
    error: json?.error,
  }
}
