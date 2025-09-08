import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { videoReactions } from '@/db/schema'
import { createTRPCRouter, protectedProcedure } from '@/trpc/init'

export const videoReactionsRouter = createTRPCRouter({
  like: protectedProcedure.input(z.object({ videoId: z.uuid() })).mutation(async ({ input, ctx }) => {
    const { videoId } = input
    const { id: userId } = ctx.user
    const [existVideoReaction] = await db
      .select()
      .from(videoReactions)
      .where(and(eq(videoReactions.videoId, videoId), eq(videoReactions.userId, userId)))
      .limit(1)

    if (existVideoReaction?.type === 'like') {
      const [deleteVideoReaction] = await db
        .delete(videoReactions)
        .where(and(eq(videoReactions.videoId, videoId), eq(videoReactions.userId, userId)))
        .returning()
      return deleteVideoReaction
    }
    const [createVideoReaction] = await db
      .insert(videoReactions)
      .values({ userId, videoId, type: 'like' })
      .onConflictDoUpdate({
        target: [videoReactions.userId, videoReactions.videoId],
        set: { type: 'like' },
      })
      .returning()
    return createVideoReaction
  }),
  dislike: protectedProcedure.input(z.object({ videoId: z.uuid() })).mutation(async ({ input, ctx }) => {
    const { videoId } = input
    const { id: userId } = ctx.user
    const [existVideoReaction] = await db
      .select()
      .from(videoReactions)
      .where(and(eq(videoReactions.videoId, videoId), eq(videoReactions.userId, userId)))
      .limit(1)

    if (existVideoReaction?.type === 'dislike') {
      const [deleteVideoReaction] = await db
        .delete(videoReactions)
        .where(and(eq(videoReactions.videoId, videoId), eq(videoReactions.userId, userId)))
        .returning()
      return deleteVideoReaction
    }
    const [createVideoReaction] = await db
      .insert(videoReactions)
      .values({ userId, videoId, type: 'dislike' })
      .onConflictDoUpdate({
        target: [videoReactions.userId, videoReactions.videoId],
        set: { type: 'dislike' },
      })
      .returning()
    return createVideoReaction
  }),
})
