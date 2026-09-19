import { qstashScheduleOrigin } from '../qstash'

export function createOutboxSchedule(environment: string | undefined, baseUrl: string | undefined) {
  const origin = qstashScheduleOrigin(environment, baseUrl)
  return {
    destination: `${origin}/api/realtime/dispatch`,
    cron: '*/10 * * * *',
    // Keep the existing ID for production; development must never overwrite it.
    scheduleId: environment === 'production' ? 'studio-realtime-outbox' : 'studio-realtime-outbox-development',
    // Later scans recover pending events without retrying an offline endpoint between scans.
    retries: 0,
  }
}
