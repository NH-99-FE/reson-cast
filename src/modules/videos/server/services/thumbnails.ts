import { TRPCError } from '@trpc/server'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/db'
import { videoFileCleanup } from '@/db/schema'
import { deleteFiles } from '@/lib/video-media'

import { requireVideo } from './access'
import { replaceThumbnailQuery } from './thumbnail-queries'

export async function pendingFileCleanup(videoId: string) {
  return db
    .select()
    .from(videoFileCleanup)
    .where(and(eq(videoFileCleanup.videoId, videoId), isNull(videoFileCleanup.cleanedAt)))
}

// Failure leaves the key durable. The caller chooses whether cleanup blocks its operation.
export async function cleanupVideoFiles(videoId: string, removeFiles = deleteFiles) {
  const pending = await pendingFileCleanup(videoId)
  for (const file of pending) {
    try {
      await removeFiles([file.key])
      await db.update(videoFileCleanup).set({ cleanedAt: new Date(), error: null }).where(eq(videoFileCleanup.key, file.key))
    } catch {
      await db.update(videoFileCleanup).set({ error: '文件清理失败，请重试' }).where(eq(videoFileCleanup.key, file.key))
    }
  }
  return (await pendingFileCleanup(videoId)).length
}

export async function replaceVideoThumbnail(input: Parameters<typeof replaceThumbnailQuery>[0]) {
  const result = await db.execute<{ attached: boolean; status: string | null }>(replaceThumbnailQuery(input))
  // A cleanup outage must not report an already committed thumbnail change as failed.
  // Even a DB/network interruption here leaves the cleanup record for explicit retry.
  try {
    await cleanupVideoFiles(input.videoId)
  } catch {
    console.error('Thumbnail cleanup deferred', { videoId: input.videoId })
  }
  return result.rows[0]
}

export async function restoreVideoThumbnail(videoId: string, userId: string) {
  const video = await requireVideo(videoId, userId, true)
  if (!video.muxPlaybackId) throw new TRPCError({ code: 'BAD_REQUEST' })
  const { attached } = await replaceVideoThumbnail({ videoId, userId, expectedKey: video.thumbnailKey, newKey: null })
  if (!attached) throw new TRPCError({ code: 'CONFLICT' })
  return requireVideo(videoId, userId, true)
}
