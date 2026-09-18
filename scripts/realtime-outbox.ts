import 'dotenv/config'

import { Client } from '@upstash/qstash'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'

import { replayEvent } from '../src/lib/realtime/queries'

const db = drizzle(process.env.DATABASE_URL!)
const [command, id] = process.argv.slice(2)
if (command === 'schedule') {
  const base = process.env.UPSTASH_WORKFLOW_URL?.replace(/\/+$/, '')
  if (!base || !process.env.QSTASH_TOKEN) throw new Error('Configure QSTASH_TOKEN and UPSTASH_WORKFLOW_URL')
  const result = await new Client({ token: process.env.QSTASH_TOKEN }).schedules.create({
    destination: `${base}/api/realtime/dispatch`,
    cron: '* * * * *',
    scheduleId: 'studio-realtime-outbox',
    retries: 3,
  })
  console.info('Outbox scanner configured', result)
} else if (command === 'replay' && id && /^[0-9a-f-]{36}$/i.test(id)) {
  const result = await db.execute(replayEvent(id))
  console.info('Requeued events:', result.rows.length)
} else if (command === 'status') {
  const result = await db.execute(sql`SELECT id, type, created_at, attempts, next_attempt_at, failed_at, last_error
    FROM realtime_outbox WHERE sent_at IS NULL ORDER BY created_at LIMIT 100`)
  console.table(result.rows)
} else {
  throw new Error('Usage: pnpm exec tsx scripts/realtime-outbox.ts schedule | status | replay <event UUID>')
}
