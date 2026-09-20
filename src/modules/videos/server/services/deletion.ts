import { randomUUID } from 'node:crypto'

import { and, eq, isNotNull, isNull, or } from 'drizzle-orm'

import { db } from '@/db'
import { videos } from '@/db/schema'
import { mux } from '@/lib/mux'
import { cleanupResources } from '@/lib/video-cleanup'
import { deleteFiles } from '@/lib/video-media'
import { workflow } from '@/lib/workflow'

import { cleanupVideoFiles } from './thumbnails'

export async function requestVideoDeletion(videoId: string) {
  const runId = randomUUID()
  const [claimed] = await db
    .update(videos)
    .set({ deletionRequestedAt: new Date(), deletionRunId: runId, deletionError: null })
    .where(and(eq(videos.id, videoId), or(isNull(videos.deletionRunId), isNotNull(videos.deletionError))))
    .returning()
  const video = claimed ?? (await db.select().from(videos).where(eq(videos.id, videoId)))[0]
  if (!video) return
  try {
    if (!process.env.UPSTASH_WORKFLOW_URL) throw new Error('Workflow URL is not configured')
    await workflow.trigger({
      url: `${process.env.UPSTASH_WORKFLOW_URL}/api/videos/workflows/delete`,
      workflowRunId: `delete-${video.deletionRunId}`,
      body: { videoId, runId: video.deletionRunId },
      retries: 3,
    })
  } catch (error) {
    await db
      .update(videos)
      .set({ deletionError: '删除任务提交失败，请重试' })
      .where(and(eq(videos.id, videoId), eq(videos.deletionRunId, video.deletionRunId!)))
    throw error
  }
}
export async function cleanupVideo(videoId: string, runId?: string, signal?: AbortSignal) {
  const condition = and(eq(videos.id, videoId), isNotNull(videos.deletionRequestedAt), runId ? eq(videos.deletionRunId, runId) : undefined)
  const [video] = await db.select().from(videos).where(condition)
  if (!video) return
  signal?.throwIfAborted()
  // Maintenance has a short shared deadline; workflows retain their SDK defaults.
  const options = signal ? { signal, timeout: 5000, maxRetries: 0 } : undefined
  const removeFiles = (keys: (string | null | undefined)[]) => deleteFiles(keys, signal)
  await cleanupResources(video, {
    upload: id => mux.video.uploads.retrieve(id, options),
    cancelUpload: id => mux.video.uploads.cancel(id, options),
    deleteAsset: id => mux.video.assets.delete(id, options),
    deleteFiles: removeFiles,
  })
  signal?.throwIfAborted()
  if (await cleanupVideoFiles(videoId, removeFiles)) throw new Error('旧封面尚未清理完成')
  signal?.throwIfAborted()
  await db.delete(videos).where(condition)
}
