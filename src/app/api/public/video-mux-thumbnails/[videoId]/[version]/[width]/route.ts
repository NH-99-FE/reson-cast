import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { videos } from '@/db/schema'
import { publicMuxThumbnailResponse } from '@/lib/video-image-response'
import { muxImage } from '@/lib/video-media'
import { publicVideoCondition } from '@/modules/videos/server/services/access'

export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{ videoId: string; version: string; width: string }> }) {
  try {
    const input = await params
    const url = new URL(request.url)
    if (url.search || url.pathname !== `/api/public/video-mux-thumbnails/${input.videoId.toLowerCase()}/${input.version}/${input.width}`) {
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    }
    return await publicMuxThumbnailResponse(input, {
      publicVideo: async id =>
        (
          await db
            .select({ thumbnailKey: videos.thumbnailKey, muxPlaybackId: videos.muxPlaybackId })
            .from(videos)
            .where(and(eq(videos.id, id), publicVideoCondition()))
            .limit(1)
        )[0],
      signMux: muxImage,
    })
  } catch {
    return new Response(null, { status: 502, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
