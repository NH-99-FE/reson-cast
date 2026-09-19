import { randomUUID } from 'node:crypto'

import { TRPCError } from '@trpc/server'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db'
import { videoGenerationJobs } from '@/db/schema'
import { getVideoAIConfig, type VideoAIKind } from '@/lib/video-ai'
import { getImageAIConfig } from '@/lib/video-image-ai'
import { workflow } from '@/lib/workflow'

import { requireVideo } from './access'
import { finishTextGenerationQuery } from './generation-queries'

export type GenerationKind = typeof videoGenerationJobs.$inferSelect.kind
export type GenerationJob = typeof videoGenerationJobs.$inferSelect
export const isGenerationActive = (status: GenerationJob['status']) => status === 'queued' || status === 'running'

// A transport outcome, never a persisted task status. Pruned tasks must not be
// recreated or treated as legacy (jobId-less) writes when their callbacks arrive.
export function ignoredGenerationJob(jobId: string) {
  console.info('Generation callback ignored', { jobId, reason: 'job_missing' })
  return { outcome: 'ignored' as const, reason: 'job_missing' as const, status: null, result: null }
}

function workflowUrl(kind: GenerationKind) {
  const base = process.env.UPSTASH_WORKFLOW_URL?.replace(/\/+$/, '')
  if (!base) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Workflow URL 尚未配置' })
  return `${base}/api/videos/workflows/${kind}`
}

export async function getGenerationJob(videoId: string, userId: string, kind: GenerationKind, jobId?: string) {
  await requireVideo(videoId, userId, true)
  const [job] = await db
    .select()
    .from(videoGenerationJobs)
    .where(
      and(
        eq(videoGenerationJobs.videoId, videoId),
        eq(videoGenerationJobs.userId, userId),
        eq(videoGenerationJobs.kind, kind),
        jobId ? eq(videoGenerationJobs.id, jobId) : undefined
      )
    )
    .orderBy(desc(videoGenerationJobs.createdAt), desc(videoGenerationJobs.id))
    .limit(1)
  return job ?? null
}

async function dispatchGeneration(job: GenerationJob) {
  if (job.status !== 'queued') return job
  try {
    await workflow.trigger({
      url: workflowUrl(job.kind),
      // Upstash adds the wfr_ prefix; reuse the persisted ID after ambiguous failures.
      workflowRunId: job.workflowRunId.replace(/^wfr_/, ''),
      body: { jobId: job.id, userId: job.userId, videoId: job.videoId, expectedValue: job.expectedValue, prompt: job.prompt },
      retries: 3,
    })
    await db
      .update(videoGenerationJobs)
      .set({ error: null })
      .where(and(eq(videoGenerationJobs.id, job.id), eq(videoGenerationJobs.status, 'queued')))
  } catch {
    // A lost response does not prove non-delivery. Keep this job active and retry its same ID.
    await db
      .update(videoGenerationJobs)
      .set({ error: '任务提交未确认，可重新提交' })
      .where(and(eq(videoGenerationJobs.id, job.id), eq(videoGenerationJobs.status, 'queued')))
  }
  const [current] = await db.select().from(videoGenerationJobs).where(eq(videoGenerationJobs.id, job.id))
  return current ?? job
}

export async function startVideoGeneration(kind: GenerationKind, videoId: string, userId: string, prompt?: string) {
  const video = await requireVideo(videoId, userId, true)
  try {
    if (kind === 'thumbnail') getImageAIConfig()
    else {
      getVideoAIConfig()
      if (!video.muxPlaybackId || !video.muxTrackId) throw new Error('视频字幕尚未就绪，请稍后重试')
    }
    workflowUrl(kind)
  } catch (error) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: error instanceof Error ? error.message : '生成服务尚未配置' })
  }
  const id = randomUUID()
  const inserted = await db.execute<{ id: string }>(sql`
    INSERT INTO video_generation_jobs (id, video_id, user_id, kind, workflow_run_id, expected_value, prompt)
    SELECT ${id}::uuid, id, user_id, ${kind}, ${`wfr_generation-${id}`},
      ${kind === 'thumbnail' ? sql`thumbnail_key` : sql.identifier(kind)}, ${prompt ?? null}
    FROM videos WHERE id = ${videoId}::uuid AND user_id = ${userId}::uuid AND deletion_requested_at IS NULL
    ON CONFLICT (video_id, kind) WHERE status IN ('queued', 'running') DO NOTHING RETURNING id
  `)
  const [job] = await db
    .select()
    .from(videoGenerationJobs)
    .where(
      and(
        eq(videoGenerationJobs.videoId, videoId),
        eq(videoGenerationJobs.userId, userId),
        eq(videoGenerationJobs.kind, kind),
        inserted.rows[0] ? eq(videoGenerationJobs.id, inserted.rows[0].id) : inArray(videoGenerationJobs.status, ['queued', 'running'])
      )
    )
    .limit(1)
  if (!job) throw new TRPCError({ code: 'CONFLICT', message: '视频或任务状态已变化，请重试' })
  return dispatchGeneration(job)
}

export async function retryVideoGeneration(jobId: string, userId: string) {
  const [job] = await db
    .select()
    .from(videoGenerationJobs)
    .where(and(eq(videoGenerationJobs.id, jobId), eq(videoGenerationJobs.userId, userId)))
  if (!job) throw new TRPCError({ code: 'NOT_FOUND' })
  await requireVideo(job.videoId, userId, true)
  if (job.status !== 'queued') return job
  return dispatchGeneration(job)
}

export async function beginGeneration(jobId: string, videoId: string, userId: string, kind: GenerationKind) {
  const [job] = await db
    .update(videoGenerationJobs)
    .set({ status: 'running', error: null })
    .where(
      and(
        eq(videoGenerationJobs.id, jobId),
        eq(videoGenerationJobs.videoId, videoId),
        eq(videoGenerationJobs.userId, userId),
        eq(videoGenerationJobs.kind, kind),
        inArray(videoGenerationJobs.status, ['queued', 'running'])
      )
    )
    .returning()
  return job ?? getGenerationJob(videoId, userId, kind, jobId)
}

export async function finishTextGeneration(jobId: string, kind: VideoAIKind, content: string) {
  const result = await db.execute<{ status: GenerationJob['status']; result: string | null }>(
    finishTextGenerationQuery(jobId, kind, content)
  )
  return result.rows[0] ?? ignoredGenerationJob(jobId)
}

export async function failGeneration(jobId: string) {
  await db
    .update(videoGenerationJobs)
    .set({ status: 'failed', error: '生成失败，请重新生成', finishedAt: new Date() })
    .where(and(eq(videoGenerationJobs.id, jobId), inArray(videoGenerationJobs.status, ['queued', 'running'])))
}
