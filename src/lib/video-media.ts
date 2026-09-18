import { UTApi } from 'uploadthing/server'

import { mux } from '@/lib/mux'

export const imagePath = (id: string, kind: 'thumbnail' | 'preview') => `/api/videos/${id}/image/${kind}`
export async function muxToken(
  id: string,
  type: 'video' | 'thumbnail' | 'gif' | 'storyboard',
  expiration = '15m',
  params?: Record<string, string>
) {
  if (!process.env.MUX_SIGNING_KEY_ID || !process.env.MUX_SIGNING_PRIVATE_KEY) throw new Error('Mux signing keys are not configured')
  return mux.jwt.signPlaybackId(id, {
    type,
    expiration,
    keyId: process.env.MUX_SIGNING_KEY_ID,
    keySecret: process.env.MUX_SIGNING_PRIVATE_KEY,
    params,
  })
}
export async function muxImage(id: string, kind: 'thumbnail' | 'preview', width: 640 | 1280 = 1280) {
  // Mux requires image transformations inside the signed claims, not the URL.
  const params: Record<string, string> = kind === 'thumbnail' ? { width: String(width) } : { width: '480', fps: '8' }
  const token = await muxToken(id, kind === 'thumbnail' ? 'thumbnail' : 'gif', '1m', params)
  return `https://image.mux.com/${id}/${kind === 'thumbnail' ? 'thumbnail.webp' : 'animated.gif'}?token=${token}`
}
export async function deleteFiles(keys: (string | null | undefined)[]) {
  const files = keys.filter((key): key is string => !!key)
  if (!files.length) return
  const result = await new UTApi().deleteFiles(files)
  if (!result.success) throw new Error('File cleanup failed')
}
