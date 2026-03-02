import { env } from '../config/env.js'

const PINATA_V3_UPLOAD_URL = 'https://uploads.pinata.cloud/v3/files'
const GATEWAY_BASE = 'https://gateway.pinata.cloud/ipfs'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

/**
 * Uploads a file to IPFS via Pinata V3 API (org:files:write). Returns the public gateway URL.
 * Throws if PINATA_JWT is not configured.
 */
export async function uploadToIpfs(
  file: { data: Buffer; mimetype: string; name?: string }
): Promise<string> {
  if (!env.PINATA_JWT?.trim()) {
    throw new Error('IPFS uploads are not configured (PINATA_JWT is not set)')
  }
  if (!ALLOWED_TYPES.includes(file.mimetype as (typeof ALLOWED_TYPES)[number])) {
    throw new Error(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`)
  }
  if (file.data.length > MAX_SIZE_BYTES) {
    throw new Error(`File too large. Max size: ${MAX_SIZE_BYTES / 1024 / 1024} MB`)
  }

  const formData = new FormData()
  const blob = new Blob([new Uint8Array(file.data)], { type: file.mimetype })
  const fileName = file.name ?? `profile-${Date.now()}.${file.mimetype.split('/')[1] ?? 'bin'}`
  formData.append('file', blob, fileName)
  formData.append('network', 'public')

  const res = await fetch(PINATA_V3_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PINATA_JWT}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[IPFS] Pinata error:', res.status, text)
    throw new Error(`IPFS upload failed: ${res.status}`)
  }

  const json = (await res.json()) as { data?: { cid?: string } }
  const cid = json.data?.cid
  if (!cid || typeof cid !== 'string') {
    throw new Error('IPFS upload failed: no CID returned')
  }

  return `${GATEWAY_BASE}/${cid}`
}
