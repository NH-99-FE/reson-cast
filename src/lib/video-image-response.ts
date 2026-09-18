import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { thumbnailVersion } from './video-image-source'

const noStore = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie, Authorization',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
}

interface ImageAccess {
  readableVideo: (id: string) => Promise<{ thumbnailKey: string | null; previewKey: string | null; muxPlaybackId: string | null }>
  signFile: (key: string, expiresIn: number) => Promise<string>
  signMux: (id: string, kind: 'thumbnail' | 'preview', width: 640 | 1280) => Promise<string>
}

export async function videoImageResponse(params: { videoId: string; kind: string; width?: string }, access: ImageAccess) {
  const input = z
    .object({ videoId: z.uuid(), kind: z.enum(['thumbnail', 'preview']), width: z.enum(['640', '1280']).default('1280') })
    .safeParse(params)
  if (!input.success) return new Response(null, { status: 404, headers: noStore })
  try {
    const video = await access.readableVideo(input.data.videoId)
    const key = input.data.kind === 'thumbnail' ? video.thumbnailKey : video.previewKey
    let url: string
    if (key) url = await access.signFile(key, 60)
    else if (video.muxPlaybackId) url = await access.signMux(video.muxPlaybackId, input.data.kind, input.data.width === '640' ? 640 : 1280)
    else return new Response(null, { status: 404, headers: noStore })
    // Each new request checks current visibility; the signed target lasts 60 seconds.
    return new Response(null, { status: 307, headers: { ...noStore, Location: url } })
  } catch (error) {
    if (error instanceof TRPCError && error.code === 'NOT_FOUND') return new Response(null, { status: 404, headers: noStore })
    console.error('Video image failed', error)
    return new Response(null, { status: 500, headers: noStore })
  }
}

/** Cookie-independent source for the optimizer. Never falls back to owner access. */
export async function publicThumbnailResponse(
  params: { videoId: string; version: string },
  access: {
    publicVideo: (id: string) => Promise<{ thumbnailKey: string | null } | undefined>
    signFile: ImageAccess['signFile']
    fetchImage?: typeof fetch
  }
) {
  const input = z
    .object({
      videoId: z.uuid(),
      version: z
        .string()
        .regex(/^[0-9a-f]+$/)
        .max(512),
    })
    .safeParse(params)
  if (!input.success) return new Response(null, { status: 404, headers: noStore })
  const video = await access.publicVideo(input.data.videoId)
  if (!video?.thumbnailKey || thumbnailVersion(video.thumbnailKey) !== input.data.version) {
    return new Response(null, { status: 404, headers: noStore })
  }
  const url = await access.signFile(video.thumbnailKey, 60)
  const result = await (access.fetchImage ?? fetch)(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  const contentType = result.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  // Match the uploader's image category; SVG is sandboxed and served as an attachment.
  if (!result.ok || !contentType || !/^image\/[a-z0-9.+-]+$/.test(contentType)) {
    await result.body?.cancel()
    return new Response(null, { status: 502, headers: noStore })
  }
  // The source itself is never cached; only the optimizer's derived images are cached.
  return new Response(result.body, { headers: { ...noStore, 'Content-Type': contentType, 'Content-Disposition': 'attachment' } })
}
