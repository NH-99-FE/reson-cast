import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { commentReactions } from '@/db/schema'
import { createTRPCRouter, protectedProcedure } from '@/trpc/init'

export const commentReactionsRouter = createTRPCRouter({
  like: protectedProcedure.input(z.object({ commentId: z.uuid() })).mutation(async ({ input, ctx }) => {
    const { commentId } = input
    const { id: userId } = ctx.user
    const [existVideoReaction] = await db
      .select()
      .from(commentReactions)
      .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.userId, userId)))
      .limit(1)

    if (existVideoReaction?.type === 'like') {
      const [deleteVideoReaction] = await db
        .delete(commentReactions)
        .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.userId, userId)))
        .returning()
      return deleteVideoReaction
    }
    const [createVideoReaction] = await db
      .insert(commentReactions)
      .values({ userId, commentId, type: 'like' })
      .onConflictDoUpdate({
        target: [commentReactions.userId, commentReactions.commentId],
        set: { type: 'like' },
      })
      .returning()
    return createVideoReaction
  }),
  dislike: protectedProcedure.input(z.object({ commentId: z.uuid() })).mutation(async ({ input, ctx }) => {
    const { commentId } = input
    const { id: userId } = ctx.user
    const [existVideoReaction] = await db
      .select()
      .from(commentReactions)
      .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.userId, userId)))
      .limit(1)

    if (existVideoReaction?.type === 'dislike') {
      const [deleteVideoReaction] = await db
        .delete(commentReactions)
        .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.userId, userId)))
        .returning()
      return deleteVideoReaction
    }
    const [createVideoReaction] = await db
      .insert(commentReactions)
      .values({ userId, commentId, type: 'dislike' })
      .onConflictDoUpdate({
        target: [commentReactions.userId, commentReactions.commentId],
        set: { type: 'dislike' },
      })
      .returning()
    return createVideoReaction
  }),
})
