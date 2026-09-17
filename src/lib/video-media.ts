import { UTApi } from 'uploadthing/server'

import { mux } from '@/lib/mux'

export const imagePath = (id: string, kind: 'thumbnail' | 'preview') => `/api/videos/${id}/image/${kind}`
export async function muxToken(id: string, type: 'video' | 'thumbnail' | 'gif' | 'storyboard', expiration = '15m') {
  if (!process.env.MUX_SIGNING_KEY_ID || !process.env.MUX_SIGNING_PRIVATE_KEY) throw new Error('Mux signing keys are not configured')
  return mux.jwt.signPlaybackId(id, {
    type,
    expiration,
    keyId: process.env.MUX_SIGNING_KEY_ID,
    keySecret: process.env.MUX_SIGNING_PRIVATE_KEY,
  })
}
export async function muxImage(id: string, kind: 'thumbnail' | 'preview') {
  const token = await muxToken(id, kind === 'thumbnail' ? 'thumbnail' : 'gif', '1m')
  return `https://image.mux.com/${id}/${kind === 'thumbnail' ? 'thumbnail.jpg' : 'animated.gif'}?token=${token}`
}
export async function deleteFiles(keys: (string | null | undefined)[]) {
  const files = keys.filter((key): key is string => !!key)
  if (!files.length) return
  const result = await new UTApi().deleteFiles(files)
  if (!result.success) throw new Error('File cleanup failed')
}
