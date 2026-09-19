import { sql } from 'drizzle-orm'

import type { videoGenerationJobs } from '@/db/schema'

type GenerationJob = typeof videoGenerationJobs.$inferSelect

export type GenerationCleanupIdRow = { id: string }
export type GenerationCleanupSummaryRow = { eligible: string; oldest_finished_at: Date | null }
export type GenerationCleanupHealthRow = {
  stale_queued: string
  stale_running: string
  oldest_stale_at: Date | null
  missing_finished_at: string
}
export type GenerationCleanupSampleRow = {
  id: string
  video_id: string
  kind: GenerationJob['kind']
  status: Extract<GenerationJob['status'], 'completed' | 'failed' | 'conflict'>
  created_at: Date
  finished_at: Date
}
export type GenerationCleanupPlanRow = { 'QUERY PLAN': unknown }

export const GENERATION_CLEANUP_BATCH_SIZE = 500

// Use the same (created_at DESC, id DESC) ordering as getGenerationJob.
// The newer row can have ANY status, including an active or conflicted task.
function eligible(cutoff: string) {
  return sql`j.status IN ('completed', 'failed', 'conflict')
    AND j.finished_at IS NOT NULL AND j.finished_at < ${cutoff}::timestamp
    AND EXISTS (
      SELECT 1 FROM video_generation_jobs newer
      WHERE newer.video_id = j.video_id AND newer.kind = j.kind
        AND (newer.created_at, newer.id) > (j.created_at, j.id)
    )`
}

export function generationCleanupCandidates(cutoff: string) {
  // LIMIT bounds selected/deleted rows, not rows scanned or sorted.
  return sql<GenerationCleanupIdRow>`SELECT j.id FROM video_generation_jobs j
    WHERE ${eligible(cutoff)}
    ORDER BY j.finished_at, j.id
    LIMIT ${GENERATION_CLEANUP_BATCH_SIZE}`
}

export function deleteGenerationBatch(cutoff: string) {
  return sql<GenerationCleanupIdRow>`WITH candidates AS MATERIALIZED (
      ${generationCleanupCandidates(cutoff)} FOR UPDATE OF j SKIP LOCKED
    )
    DELETE FROM video_generation_jobs j USING candidates c
    WHERE j.id = c.id RETURNING j.id`
}

export function generationCleanupPreview(cutoff: string) {
  return sql<GenerationCleanupSummaryRow>`SELECT count(*)::text AS eligible, min(j.finished_at) AS oldest_finished_at
    FROM video_generation_jobs j WHERE ${eligible(cutoff)}`
}

export function generationCleanupSample(cutoff: string) {
  return sql<GenerationCleanupSampleRow>`SELECT j.id, j.video_id, j.kind, j.status, j.created_at, j.finished_at
    FROM video_generation_jobs j WHERE ${eligible(cutoff)}
    ORDER BY j.finished_at, j.id LIMIT 20`
}

export function generationCleanupHealth(staleCutoff: string) {
  return sql<GenerationCleanupHealthRow>`SELECT
      count(*) FILTER (WHERE status = 'queued' AND created_at < ${staleCutoff}::timestamp)::text AS stale_queued,
      count(*) FILTER (WHERE status = 'running' AND created_at < ${staleCutoff}::timestamp)::text AS stale_running,
      min(created_at) FILTER (WHERE status IN ('queued', 'running') AND created_at < ${staleCutoff}::timestamp) AS oldest_stale_at,
      count(*) FILTER (WHERE status IN ('completed', 'failed', 'conflict') AND finished_at IS NULL)::text AS missing_finished_at
    FROM video_generation_jobs
    WHERE status IN ('queued', 'running') OR finished_at IS NULL`
}
