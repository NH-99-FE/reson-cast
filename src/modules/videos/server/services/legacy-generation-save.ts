import { and, eq, isNull } from 'drizzle-orm'

import type { db } from '@/db'
import { videos } from '@/db/schema'
import type { VideoAIKind } from '@/lib/video-ai'

export async function saveGeneratedVideo(
  database: typeof db,
  input: { videoId: string; userId: string },
  kind: VideoAIKind,
  expectedValue: string | null,
  content: string
) {
  const [updated] = await database
    .update(videos)
    .set({ [kind]: content, updatedAt: new Date() })
    .where(
      and(
        eq(videos.id, input.videoId),
        eq(videos.userId, input.userId),
        isNull(videos.deletionRequestedAt),
        expectedValue === null ? isNull(videos[kind]) : eq(videos[kind], expectedValue)
      )
    )
    .returning({ id: videos.id })
  return { status: updated ? ('completed' as const) : ('conflict' as const) }
}
