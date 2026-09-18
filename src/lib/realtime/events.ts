import { z } from 'zod'

export const studioChannel = (userId: string) => `studio:user:${userId}`
export const studioEventSchema = z
  .object({
    id: z.uuid(),
    version: z.literal(1),
    type: z.enum(['video.changed', 'generation.changed', 'deletion.changed']),
    videoId: z.uuid(),
    jobId: z.uuid().nullable(),
    kind: z.enum(['title', 'description', 'thumbnail']).nullable(),
  })
  .refine(event => event.type !== 'generation.changed' || (event.jobId !== null && event.kind !== null))
export type StudioEvent = z.infer<typeof studioEventSchema>

export function studioCapability(userId: string) {
  return { [studioChannel(userId)]: ['subscribe'] }
}
