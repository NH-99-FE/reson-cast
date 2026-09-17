import { auth } from '@clerk/nextjs/server'
import { TRPCError } from '@trpc/server'
import { UTApi } from 'uploadthing/server'
import { z } from 'zod'

import { muxImage } from '@/lib/video-media'
import { requireVideo, viewerId } from '@/modules/videos/server/services/access'

export const dynamic = 'force-dynamic'
const noStore = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie, Authorization',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
}
export async function GET(_request: Request, { params }: { params: Promise<{ videoId: string; kind: string }> }) {
  const input = z.object({ videoId: z.uuid(), kind: z.enum(['thumbnail', 'preview']) }).safeParse(await params)
  if (!input.success) return new Response(null, { status: 404, headers: noStore })
  try {
    const { userId } = await auth()
    const video = await requireVideo(input.data.videoId, await viewerId(userId))
    const key = input.data.kind === 'thumbnail' ? video.thumbnailKey : video.previewKey
    let url: string
    if (key) url = (await new UTApi().generateSignedURL(key, { expiresIn: 60 })).ufsUrl
    else if (video.muxPlaybackId) url = await muxImage(video.muxPlaybackId, input.data.kind)
    else return new Response(null, { status: 404, headers: noStore })
    const result = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
    if (!result.ok) return new Response(null, { status: 502, headers: noStore })
    return new Response(result.body, { headers: { ...noStore, 'Content-Type': result.headers.get('content-type') ?? 'image/jpeg' } })
  } catch (error) {
    if (error instanceof TRPCError && error.code === 'NOT_FOUND') return new Response(null, { status: 404, headers: noStore })
    console.error('Video image failed', error)
    return new Response(null, { status: 500, headers: noStore })
  }
}
