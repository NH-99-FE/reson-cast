import { and, eq } from 'drizzle-orm'
import { UTApi } from 'uploadthing/server'

import { db } from '@/db'
import { videos } from '@/db/schema'
import { publicThumbnailResponse } from '@/lib/video-image-response'
import { publicVideoCondition } from '@/modules/videos/server/services/access'

export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{ videoId: string; version: string }> }) {
  try {
    const input = await params
    const url = new URL(request.url)
    if (url.search || url.pathname !== `/api/public/video-thumbnails/${input.videoId.toLowerCase()}/${input.version}`) {
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    }
    return await publicThumbnailResponse(input, {
      publicVideo: async id =>
        (
          await db
            .select({ thumbnailKey: videos.thumbnailKey })
            .from(videos)
            .where(and(eq(videos.id, id), publicVideoCondition()))
            .limit(1)
        )[0],
      signFile: async (key, expiresIn) => (await new UTApi().generateSignedURL(key, { expiresIn })).ufsUrl,
    })
  } catch {
    return new Response(null, { status: 502, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
