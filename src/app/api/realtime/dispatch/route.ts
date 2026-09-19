import { randomUUID } from 'node:crypto'

import { sql } from 'drizzle-orm'

import { db } from '@/db'
import { verifyQStashRequest } from '@/lib/qstash'
import { deliverEvent, type OutboxRow } from '@/lib/realtime/delivery'
import { acknowledgeEvent, claimEvents, failEvent } from '@/lib/realtime/queries'
import { realtimeServer, wakeOutbox } from '@/lib/realtime/server'

export const maxDuration = 60
export async function POST(request: Request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
  const base = process.env.UPSTASH_WORKFLOW_URL?.replace(/\/+$/, '')
  if (!currentSigningKey || !nextSigningKey || !base) {
    return new Response('Dispatch unavailable', { status: 503 })
  }
  if (!(await verifyQStashRequest(request, currentSigningKey, nextSigningKey, `${base}/api/realtime/dispatch`))) {
    return new Response('Unauthorized', { status: 401 })
  }
  const token = randomUUID()
  const { rows } = await db.execute<OutboxRow>(claimEvents(token))
  // Bound request duration: 50 concurrent requests, each with a 10-second provider timeout.
  const results = await Promise.allSettled(
    rows.map(row =>
      deliverEvent(row, {
        publish: (channel, event) => realtimeServer().channels.get(channel).publish({ name: event.type, data: event }),
        acknowledge: () => db.execute(acknowledgeEvent(row.id, token)),
        fail: (delay, error) => db.execute(failEvent(row.id, token, delay, error)),
      })
    )
  )
  await db.execute(sql`DELETE FROM realtime_outbox WHERE id IN (
    SELECT id FROM realtime_outbox WHERE sent_at < now() - interval '7 days' LIMIT 1000
  )`)
  const { rows: metrics } = await db.execute(sql`SELECT
    count(*) FILTER (WHERE sent_at IS NULL AND failed_at IS NULL) AS pending,
    min(created_at) FILTER (WHERE sent_at IS NULL AND failed_at IS NULL) AS oldest_pending_at,
    count(*) FILTER (WHERE failed_at IS NOT NULL) AS failed,
    coalesce(sum(attempts), 0) AS retries FROM realtime_outbox`)
  console.info('Outbox dispatch', { claimed: rows.length, metrics: metrics[0] })
  if (rows.length === 50) await wakeOutbox()
  if (results.some(result => result.status === 'rejected')) return new Response('Retry dispatch', { status: 503 })
  return Response.json({ processed: rows.length })
}
