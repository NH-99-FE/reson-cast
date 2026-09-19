import 'dotenv/config'

import { Client } from '@upstash/qstash'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'

import { replayEvent } from '../src/lib/realtime/queries'
import { createOutboxSchedule } from '../src/lib/realtime/schedule'

const [command, id] = process.argv.slice(2)
if (command === 'schedule') {
  const schedule = createOutboxSchedule(id, process.env.UPSTASH_WORKFLOW_URL)
  if (!process.env.QSTASH_TOKEN) throw new Error('Configure QSTASH_TOKEN')
  const result = await new Client({ token: process.env.QSTASH_TOKEN }).schedules.create(schedule)
  console.info('Outbox scanner configured', {
    ...result,
    destination: schedule.destination,
    cron: schedule.cron,
    retries: schedule.retries,
  })
} else if (command === 'replay' && id && /^[0-9a-f-]{36}$/i.test(id)) {
  const db = drizzle(process.env.DATABASE_URL!)
  const result = await db.execute(replayEvent(id))
  console.info('Requeued events:', result.rows.length)
} else if (command === 'status') {
  const db = drizzle(process.env.DATABASE_URL!)
  const result = await db.execute(sql`SELECT id, type, created_at, attempts, next_attempt_at, failed_at, last_error
    FROM realtime_outbox WHERE sent_at IS NULL ORDER BY created_at LIMIT 100`)
  console.table(result.rows)
} else {
  throw new Error('Usage: pnpm exec tsx scripts/realtime-outbox.ts schedule <production|development> | status | replay <event UUID>')
}
