import { studioChannel, studioEventSchema } from './events'
import { retryDelay } from './queries'

export interface OutboxRow extends Record<string, unknown> {
  id: string
  user_id: string
  video_id: string
  type: string
  version: number
  job_id: string | null
  kind: string | null
  attempts: number
}
export async function deliverEvent(
  row: OutboxRow,
  io: {
    publish: (channel: string, data: ReturnType<typeof studioEventSchema.parse>) => Promise<unknown>
    acknowledge: () => Promise<unknown>
    fail: (delay: number, error: string) => Promise<unknown>
  }
) {
  try {
    const event = studioEventSchema.parse({
      id: row.id,
      version: row.version,
      type: row.type,
      videoId: row.video_id,
      jobId: row.job_id,
      kind: row.kind,
    })
    await io.publish(studioChannel(row.user_id), event)
    await io.acknowledge()
    return true
  } catch {
    // Do not persist provider errors which may contain credentials or request contents.
    await io.fail(retryDelay(row.attempts + 1), 'Realtime publish or acknowledgement failed')
    return false
  }
}
