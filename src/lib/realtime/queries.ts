import { sql } from 'drizzle-orm'

export function claimEvents(token: string) {
  return sql`
    WITH candidates AS (
      SELECT id FROM realtime_outbox
      WHERE sent_at IS NULL AND failed_at IS NULL AND next_attempt_at <= now()
        AND (lease_until IS NULL OR lease_until < now())
      ORDER BY next_attempt_at, created_at LIMIT 50 FOR UPDATE SKIP LOCKED
    )
    UPDATE realtime_outbox o SET lease_token = ${token}::uuid, lease_until = now() + interval '2 minutes'
    FROM candidates c WHERE o.id = c.id RETURNING o.*
  `
}
export function acknowledgeEvent(id: string, token: string) {
  return sql`UPDATE realtime_outbox SET sent_at = now(), lease_until = NULL, lease_token = NULL, last_error = NULL
    WHERE id = ${id}::uuid AND lease_token = ${token}::uuid AND sent_at IS NULL`
}
export function retryDelay(attempt: number, random = Math.random()) {
  return Math.min(900, 2 ** Math.min(attempt, 10) * (0.75 + random * 0.5))
}
export function failEvent(id: string, token: string, delay: number, error: string) {
  return sql`UPDATE realtime_outbox SET attempts = attempts + 1,
    next_attempt_at = now() + ${delay} * interval '1 second',
    failed_at = CASE WHEN attempts + 1 >= 20 THEN now() ELSE NULL END,
    lease_until = NULL, lease_token = NULL, last_error = ${error}
    WHERE id = ${id}::uuid AND lease_token = ${token}::uuid AND sent_at IS NULL`
}
export function replayEvent(id: string) {
  return sql`UPDATE realtime_outbox SET attempts = 0, failed_at = NULL, last_error = NULL,
    lease_until = NULL, lease_token = NULL, next_attempt_at = now()
    WHERE id = ${id}::uuid AND failed_at IS NOT NULL AND sent_at IS NULL RETURNING id`
}
