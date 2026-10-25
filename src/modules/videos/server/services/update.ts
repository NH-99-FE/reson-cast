import { TRPCError } from '@trpc/server'
import { and, eq, isNull } from 'drizzle-orm'
import type { z } from 'zod'

import { db } from '@/db'
import { videos, type videoSaveSchema } from '@/db/schema'
import { mux } from '@/lib/mux'
import { completePlaybackRevocation } from '@/lib/video-playback'

import { requireVideo } from './access'
import { updateVideoQuery } from './update-queries'

// Retry only the recorded old ID. Concurrent retries cannot revoke the replacement.
export async function resumePlaybackRevocation(video: typeof videos.$inferSelect) {
  if (!video.muxPlaybackIdToRevoke || !video.muxAssetId) return video
  const assetId = video.muxAssetId
  const oldId = video.muxPlaybackIdToRevoke
  await completePlaybackRevocation(oldId, {
    revoke: id => mux.video.assets.deletePlaybackId(assetId, id),
    create: () => mux.video.assets.createPlaybackId(assetId, { policy: 'signed' }),
    commit: async id => {
      const [updated] = await db
        .update(videos)
        .set({ muxPlaybackId: id, muxPlaybackIdToRevoke: null })
        .where(and(eq(videos.id, video.id), eq(videos.muxPlaybackIdToRevoke, oldId), isNull(videos.deletionRequestedAt)))
        .returning({ id: videos.id })
      return !!updated
    },
  })
  return requireVideo(video.id, video.userId, true)
}

export async function updateVideo(input: z.infer<typeof videoSaveSchema>, userId: string) {
  if (!input.id) {
    throw new TRPCError({ code: 'BAD_REQUEST' })
  }

  const existing = await requireVideo(input.id, userId, true)
  if (existing.muxPlaybackIdToRevoke && input.visibility === 'public') {
    throw new TRPCError({ code: 'CONFLICT', message: '请先重试完成播放权限撤销，再公开视频' })
  }
  const { adoptedGenerationJobs, ...values } = input
  const adoptions = (['title', 'description'] as const).flatMap(kind => {
    const id = adoptedGenerationJobs?.[kind]
    if (!id) return []
    if (values[kind] === undefined) throw new TRPCError({ code: 'BAD_REQUEST', message: '采用生成结果时必须同时保存对应字段' })
    return [{ id, kind }]
  })
  const [updatedVideo] = await updateVideoQuery(values, existing, adoptions)
  if (!updatedVideo) {
    throw new TRPCError({ code: 'CONFLICT', message: '视频或生成结果已变化，请刷新后重试' })
  }
  // Content, adoption and revocation intent are committed before external calls.
  // If Mux fails, return the saved row so the UI can show the pending-revocation action.
  if (updatedVideo.muxPlaybackIdToRevoke) {
    try {
      return await resumePlaybackRevocation(updatedVideo)
    } catch {
      return updatedVideo
    }
  }
  return updatedVideo
}
