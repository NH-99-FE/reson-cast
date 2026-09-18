import { auth } from '@clerk/nextjs/server'
import { UTApi } from 'uploadthing/server'

import { videoImageResponse } from '@/lib/video-image-response'
import { muxImage } from '@/lib/video-media'
import { requireVideo, viewerId } from '@/modules/videos/server/services/access'

export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{ videoId: string; kind: string }> }) {
  return videoImageResponse(
    { ...(await params), width: new URL(request.url).searchParams.get('width') ?? undefined },
    {
      readableVideo: async id => {
        const { userId } = await auth()
        return requireVideo(id, await viewerId(userId))
      },
      signFile: async (key, expiresIn) => (await new UTApi().generateSignedURL(key, { expiresIn })).ufsUrl,
      signMux: muxImage,
    }
  )
}
