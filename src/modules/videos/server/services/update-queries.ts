import { and, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { z } from 'zod'

import { db } from '@/db'
import { videoGenerationJobs, videos, type videoUpdateSchema } from '@/db/schema'

/** Build one statement for content, adoption and playback revocation intent. */
export function updateVideoQuery(
  values: z.infer<typeof videoUpdateSchema>,
  existing: typeof videos.$inferSelect,
  adoptions: { id: string; kind: 'title' | 'description' }[]
) {
  const hidePublicPlayback =
    values.visibility === 'private' && existing.visibility === 'public' && existing.muxAssetId && existing.muxPlaybackId
  // Match finishTextGeneration's job -> video lock order. Validate every requested
  // adoption inside the statement so stale/foreign/dismissed jobs cannot save any fields.
  const jobs = db.$with('adoption_jobs').as(
    db
      .select({ id: videoGenerationJobs.id })
      .from(videoGenerationJobs)
      .where(
        and(
          eq(videoGenerationJobs.videoId, existing.id),
          eq(videoGenerationJobs.userId, existing.userId),
          eq(videoGenerationJobs.status, 'conflict'),
          isNotNull(videoGenerationJobs.result),
          inArray(videoGenerationJobs.resolution, ['pending', 'adopted']),
          adoptions.length
            ? or(...adoptions.map(({ id, kind }) => and(eq(videoGenerationJobs.id, id), eq(videoGenerationJobs.kind, kind))))
            : sql`false`
        )
      )
      .orderBy(videoGenerationJobs.id)
      .for('update')
  )
  const save = db
    .update(videos)
    .set({
      ...Object.fromEntries(Object.entries(values).filter(([key, value]) => key !== 'id' && value !== undefined)),
      ...(hidePublicPlayback ? { muxPlaybackId: null, muxPlaybackIdToRevoke: existing.muxPlaybackId } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(videos.id, existing.id),
        eq(videos.userId, existing.userId),
        isNull(videos.deletionRequestedAt),
        existing.muxPlaybackIdToRevoke
          ? eq(videos.muxPlaybackIdToRevoke, existing.muxPlaybackIdToRevoke)
          : isNull(videos.muxPlaybackIdToRevoke),
        eq(videos.visibility, existing.visibility),
        existing.muxPlaybackId ? eq(videos.muxPlaybackId, existing.muxPlaybackId) : isNull(videos.muxPlaybackId),
        adoptions.length ? sql`(select count(*) from ${jobs}) = ${adoptions.length}` : undefined
      )
    )
    .returning()
  if (!adoptions.length) return save

  const saved = db.$with('saved_video').as(save)
  const resolved = db.$with('resolved_jobs').as(
    db
      .update(videoGenerationJobs)
      .set({ resolution: 'adopted' })
      .where(
        and(
          inArray(videoGenerationJobs.id, db.select({ id: jobs.id }).from(jobs)),
          eq(videoGenerationJobs.resolution, 'pending'),
          sql`exists (select 1 from ${saved})`
        )
      )
      .returning({ id: videoGenerationJobs.id })
  )
  return db.with(jobs, saved, resolved).select().from(saved)
}
