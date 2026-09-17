import { sql } from 'drizzle-orm'

import type { VideoAIKind } from '@/lib/video-ai'

/** One statement commits both content and task result; a replay returns the stored result. */
export function finishTextGenerationQuery(jobId: string, kind: VideoAIKind, content: string) {
  const column = sql.identifier(kind)
  return sql`
    WITH job AS MATERIALIZED (
      SELECT * FROM video_generation_jobs WHERE id = ${jobId}::uuid AND kind = ${kind} FOR UPDATE
    ), saved AS (
      UPDATE videos v SET ${column} = ${content}, updated_at = now()
      FROM job j WHERE v.id = j.video_id AND v.user_id = j.user_id
        AND v.deletion_requested_at IS NULL AND j.status IN ('queued', 'running')
        AND v.${column} IS NOT DISTINCT FROM j.expected_value
      RETURNING v.id
    ), finished AS (
      UPDATE video_generation_jobs j
      SET status = CASE WHEN EXISTS (SELECT 1 FROM saved) THEN 'completed' ELSE 'conflict' END,
          result = ${content}, error = NULL, finished_at = now()
      FROM job WHERE j.id = job.id AND job.status IN ('queued', 'running')
      RETURNING j.status, j.result
    )
    SELECT status, result FROM finished
    UNION ALL SELECT status, result FROM job WHERE status NOT IN ('queued', 'running')
  `
}
