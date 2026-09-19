import { qstashScheduleOrigin } from '@/lib/qstash'

export const GENERATION_CLEANUP_PATH = '/api/videos/maintenance/generation-jobs'

export function createGenerationCleanupSchedule(environment: string | undefined, baseUrl: string | undefined) {
  const origin = qstashScheduleOrigin(environment, baseUrl)
  return {
    destination: `${origin}${GENERATION_CLEANUP_PATH}`,
    // QStash cron is UTC: 03:15 UTC / 11:15 Asia/Shanghai, once per day.
    cron: '15 3 * * *',
    scheduleId: `video-generation-cleanup-${environment}`,
    retries: 0,
  }
}
