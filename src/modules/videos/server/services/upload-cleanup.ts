import { and, asc, eq, isNotNull, isNull, lt, or } from 'drizzle-orm'

import { db } from '@/db'
import { videos } from '@/db/schema'
import { mux } from '@/lib/mux'
import { isMissing } from '@/lib/video-cleanup'

import { cleanupVideo, requestVideoDeletion } from './deletion'

// A stale local status is only a candidate; Mux must confirm terminal failure.
export function isAbandonedUpload(upload: { status: string; asset_id?: string }) {
  return !upload.asset_id && ['cancelled', 'timed_out', 'errored'].includes(upload.status)
}

export async function runUploadCleanup(now = new Date()) {
  const result = { submitted: 0, recovered: 0, retained: 0, failed: 0 }
  const stale = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const retryBefore = new Date(now.getTime() - 60 * 60 * 1000)
  const rows = await db
    .select()
    .from(videos)
    .where(
      or(
        and(isNull(videos.deletionRequestedAt), isNull(videos.muxAssetId), eq(videos.muxStatus, 'waiting'), lt(videos.createdAt, stale)),
        and(isNotNull(videos.deletionRequestedAt), or(isNotNull(videos.deletionError), lt(videos.deletionRequestedAt, retryBefore)))
      )
    )
    .orderBy(asc(videos.updatedAt), asc(videos.id))
    .limit(10)

  const deadline = Date.now() + 10_000
  const signal = AbortSignal.timeout(10_000)
  for (const video of rows) {
    if (Date.now() >= deadline) break
    try {
      if (video.deletionRequestedAt) {
        // Work is already authorized and persisted, even if workflow dispatch failed.
        await cleanupVideo(video.id, video.deletionRunId ?? undefined, signal)
        result.recovered++
        continue
      }
      if (!video.muxUploadId) {
        result.retained++
        continue
      }
      let abandoned = false
      try {
        const upload = await mux.video.uploads.retrieve(video.muxUploadId, { timeout: 5000, maxRetries: 0, signal })
        abandoned = isAbandonedUpload(upload)
      } catch (error) {
        // A missing upload does not prove that no asset was created. Retain it.
        if (!isMissing(error)) throw error
      }
      if (abandoned) {
        // Recheck local eligibility when recording deletion intent. A callback may
        // have associated an asset while we were querying the provider.
        const [claimed] = await db
          .update(videos)
          .set({ deletionRequestedAt: now })
          .where(
            and(eq(videos.id, video.id), isNull(videos.deletionRequestedAt), isNull(videos.muxAssetId), eq(videos.muxStatus, 'waiting'))
          )
          .returning({ id: videos.id })
        if (claimed) {
          await requestVideoDeletion(video.id)
          result.submitted++
        } else result.retained++
      } else result.retained++
    } catch {
      result.failed++
      console.error('Upload cleanup failed', { videoId: video.id })
    } finally {
      // Rotate the bounded batch so retained rows or provider outages cannot
      // permanently starve other candidates. Never change the media status.
      await db.update(videos).set({ updatedAt: now }).where(eq(videos.id, video.id))
    }
  }
  return result
}
