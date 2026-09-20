import 'dotenv/config'

import { Client } from '@upstash/qstash'

import { qstashScheduleOrigin } from '../src/lib/qstash'

async function main() {
  const [command, environment, extra] = process.argv.slice(2)
  if (command !== 'schedule' || extra) throw new Error('Usage: pnpm jobs:uploads schedule <production|development>')
  const origin = qstashScheduleOrigin(environment, process.env.UPSTASH_WORKFLOW_URL)
  if (!process.env.QSTASH_TOKEN) throw new Error('Configure QSTASH_TOKEN')
  const result = await new Client({ token: process.env.QSTASH_TOKEN }).schedules.create({
    destination: `${origin}/api/videos/maintenance/uploads`,
    cron: '30 3 * * *',
    scheduleId: `video-upload-cleanup-${environment}`,
    retries: 0,
  })
  console.info('Upload cleanup schedule configured', { scheduleId: result.scheduleId })
}
main().catch(() => {
  console.error('Upload cleanup scheduling failed. Usage: pnpm jobs:uploads schedule <production|development>; check QStash configuration.')
  process.exitCode = 1
})
