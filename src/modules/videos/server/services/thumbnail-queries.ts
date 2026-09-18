import { sql } from 'drizzle-orm'

/** The old key is queued in the SAME statement that replaces it. No external I/O here. */
export function replaceThumbnailQuery(input: {
  videoId: string
  userId: string
  expectedKey: string | null
  newKey: string | null
  jobId?: string
}) {
  const { videoId, userId, expectedKey, newKey, jobId } = input
  return sql`
    WITH job AS MATERIALIZED (
      SELECT * FROM video_generation_jobs WHERE id = ${jobId ?? null}::uuid AND kind = 'thumbnail' FOR UPDATE
    ), current_video AS MATERIALIZED (
      SELECT * FROM videos WHERE id = ${videoId}::uuid AND user_id = ${userId}::uuid FOR UPDATE
    ), saved AS (
      UPDATE videos v SET thumbnail_key = ${newKey}, thumbnail_url = ${`/api/videos/${videoId}/image/thumbnail?v=${encodeURIComponent(newKey ?? 'mux')}`}
      FROM current_video c
      WHERE v.id = c.id AND c.deletion_requested_at IS NULL
        AND c.thumbnail_key IS NOT DISTINCT FROM ${expectedKey}::text
        AND (${newKey}::text IS NULL OR NOT EXISTS (SELECT 1 FROM video_file_cleanup WHERE key = ${newKey}))
        AND (${jobId ?? null}::uuid IS NULL OR EXISTS (
          SELECT 1 FROM job WHERE video_id = v.id AND user_id = v.user_id AND status IN ('queued', 'running')
        ))
      RETURNING v.id
    ), outcome AS (
      SELECT EXISTS (SELECT 1 FROM saved) OR EXISTS (
        SELECT 1 FROM current_video WHERE thumbnail_key IS NOT DISTINCT FROM ${newKey}::text
          AND deletion_requested_at IS NULL
      ) AS attached
    ), cleanup AS (
      INSERT INTO video_file_cleanup (key, video_id, user_id)
      SELECT c.thumbnail_key, ${videoId}::uuid, ${userId}::uuid FROM current_video c
      WHERE EXISTS (SELECT 1 FROM saved) AND c.thumbnail_key IS NOT NULL
        AND c.thumbnail_key IS DISTINCT FROM ${newKey}::text
      UNION
      SELECT ${newKey}::text, ${videoId}::uuid, ${userId}::uuid
      WHERE ${newKey}::text IS NOT NULL AND NOT (SELECT attached FROM outcome)
      ON CONFLICT (key) DO NOTHING
    ), finished AS (
      UPDATE video_generation_jobs j
      SET status = CASE WHEN (SELECT attached FROM outcome) THEN 'completed' ELSE 'conflict' END,
          result = ${newKey}, error = NULL, finished_at = now()
      FROM job WHERE j.id = job.id AND job.status IN ('queued', 'running')
      RETURNING j.status
    )
    SELECT attached, COALESCE((SELECT status FROM finished), (SELECT status FROM job)) AS status FROM outcome
  `
}
