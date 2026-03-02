import type { Context, Next } from 'hono'
import { verifyJwt } from '../lib/jwt.js'

export type AuthVariables = {
  userAddress: string
}

/**
 * Middleware that requires a valid JWT in Authorization: Bearer <token>.
 * On success sets userAddress from token. On failure returns 401.
 */
export async function requireAuth(c: Context<{ Variables: AuthVariables }>, next: Next) {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }
  const payload = await verifyJwt(token)
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
  c.set('userAddress', payload.userAddress)
  return next()
}
