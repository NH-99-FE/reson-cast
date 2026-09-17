import { TRPCError } from '@trpc/server'
import { and, eq, isNull } from 'drizzle-orm'
import type { z } from 'zod'

import { db } from '@/db'
import { videos, type videoUpdateSchema } from '@/db/schema'
import { mux } from '@/lib/mux'
import { completePlaybackRevocation } from '@/lib/video-playback'

import { requireVideo } from './access'

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

export async function updateVideo(input: z.infer<typeof videoUpdateSchema>, userId: string) {
  if (!input.id) {
    throw new TRPCError({ code: 'BAD_REQUEST' })
  }

  let existing = await requireVideo(input.id, userId, true)
  if (existing.muxPlaybackIdToRevoke && input.visibility === 'public') {
    throw new TRPCError({ code: 'CONFLICT', message: '请先重试完成播放权限撤销，再公开视频' })
  }
  if (input.visibility === 'private' && existing.visibility === 'public' && existing.muxAssetId && existing.muxPlaybackId) {
    const [claimed] = await db
      .update(videos)
      .set({ visibility: 'private', muxPlaybackId: null, muxPlaybackIdToRevoke: existing.muxPlaybackId })
      .where(
        and(
          eq(videos.id, input.id),
          eq(videos.visibility, 'public'),
          eq(videos.muxPlaybackId, existing.muxPlaybackId),
          isNull(videos.muxPlaybackIdToRevoke),
          isNull(videos.deletionRequestedAt)
        )
      )
      .returning()
    if (!claimed) throw new TRPCError({ code: 'CONFLICT', message: '视频状态已变化，请重试' })
    existing = claimed
  }
  if (existing.muxPlaybackIdToRevoke) {
    try {
      existing = await resumePlaybackRevocation(existing)
    } catch {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '视频已隐藏，旧播放权限撤销尚未完成，请重试' })
    }
  }
  const [updatedVideo] = await db
    .update(videos)
    .set({
      ...Object.fromEntries(Object.entries(input).filter(([key, value]) => key !== 'id' && value !== undefined)),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(videos.id, input.id),
        eq(videos.userId, userId),
        isNull(videos.deletionRequestedAt),
        isNull(videos.muxPlaybackIdToRevoke),
        eq(videos.visibility, existing.visibility),
        existing.muxPlaybackId ? eq(videos.muxPlaybackId, existing.muxPlaybackId) : isNull(videos.muxPlaybackId)
      )
    )
    .returning()
  if (!updatedVideo) {
    throw new TRPCError({ code: 'CONFLICT', message: '视频状态已变化，请重试' })
  }
  return updatedVideo
}
