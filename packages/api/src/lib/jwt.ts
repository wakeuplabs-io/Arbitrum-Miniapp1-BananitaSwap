import * as jose from 'jose'
import { env } from '../config/env.js'

const JWT_ISSUER = 'arbitrum-miniapp-api'
const JWT_AUDIENCE = 'arbitrum-miniapp'
const JWT_EXPIRY = '24h'

export type JwtPayload = {
  userAddress: string
  iat: number
  exp: number
  iss: string
  aud: string
}

/**
 * Signs a JWT containing the user address. Use after successful SIWE verify.
 */
export async function signJwt(userAddress: string): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET)
  return await new jose.SignJWT({ userAddress })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secret)
}

/**
 * Verifies a JWT and returns the payload. Returns null if invalid or expired.
 */
export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    const userAddress = payload.userAddress
    if (typeof userAddress !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return null
    }
    return {
      userAddress,
      iat: payload.iat!,
      exp: payload.exp!,
      iss: payload.iss!,
      aud: payload.aud as string,
    }
  } catch {
    return null
  }
}
