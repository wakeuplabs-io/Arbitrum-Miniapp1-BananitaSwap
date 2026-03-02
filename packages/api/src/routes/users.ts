import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { userProfile } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import type { AuthVariables } from '../middleware/auth.js'
import { uploadToIpfs } from '../services/ipfs.js'

export const usersRouter = new Hono<{ Variables: AuthVariables }>()

/**
 * POST /users/profile/picture
 * Uploads a profile picture (multipart form field "picture"), pins to IPFS, saves URL to DB for the authenticated user.
 * Uses userAddress from token metadata on context.
 */
usersRouter.post('/profile/picture', requireAuth, async (c) => {
  const userAddress = c.get('userAddress')
  const body = await c.req.parseBody()
  const file = body['picture'] ?? body['file']
  if (!file || typeof file === 'string') {
    return c.json({ error: 'Missing or invalid file. Send a multipart field "picture".' }, 400)
  }

  const data = await file.arrayBuffer().then((ab) => Buffer.from(ab))
  const mimetype = file.type || 'application/octet-stream'
  const name = file.name ?? undefined

  let profileImageUrl: string
  try {
    profileImageUrl = await uploadToIpfs({ data, mimetype, name })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed'
    return c.json({ error: msg }, 400)
  }

  try {
    await db
      .insert(userProfile)
      .values({
        userAddress,
        profileImageUrl,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfile.userAddress,
        set: { profileImageUrl, updatedAt: new Date() },
      })
  } catch (e) {
    console.error('[Users] Profile update failed:', e)
    return c.json({ error: 'Failed to save profile' }, 500)
  }

  return c.json({ profileImageUrl })
})

/**
 * DELETE /users/profile/picture
 * Clears the profile picture for the authenticated user.
 */
usersRouter.delete('/profile/picture', requireAuth, async (c) => {
  const userAddress = c.get('userAddress')
  try {
    await db
      .insert(userProfile)
      .values({
        userAddress,
        profileImageUrl: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfile.userAddress,
        set: { profileImageUrl: null, updatedAt: new Date() },
      })
  } catch (e) {
    console.error('[Users] Profile picture clear failed:', e)
    return c.json({ error: 'Failed to clear profile picture' }, 500)
  }
  return c.json({ profileImageUrl: null })
})

/**
 * GET /users/profile
 * Returns the authenticated user's profile (including profile picture URL).
 * Uses userAddress from token metadata on context.
 */
usersRouter.get('/profile', requireAuth, async (c) => {
  const userAddress = c.get('userAddress')
  const rows = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.userAddress, userAddress))
    .limit(1)

  const profile = rows[0] ?? null
  return c.json({
    userAddress,
    profileImageUrl: profile?.profileImageUrl ?? null,
    updatedAt: profile?.updatedAt ?? null,
  })
})
