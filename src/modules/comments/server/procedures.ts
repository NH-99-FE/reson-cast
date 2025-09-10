import { TRPCError } from '@trpc/server'
import { and, count, desc, eq, getTableColumns, lt, or } from 'drizzle-orm'
import { inArray } from 'drizzle-orm/sql/expressions/conditions'
import { z } from 'zod'

import { db } from '@/db'
import { commentReactions, comments, users } from '@/db/schema'
import { baseProcedure, createTRPCRouter, protectedProcedure } from '@/trpc/init'

export const commentsRouter = createTRPCRouter({
  remove: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input, ctx }) => {
    const { id } = input
    const { id: userId } = ctx.user

    const [deleteComment] = await db
      .delete(comments)
      .where(and(eq(comments.id, id), eq(comments.userId, userId)))
      .returning()

    if (!deleteComment) throw new TRPCError({ code: 'NOT_FOUND' })
    return deleteComment
  }),
  create: protectedProcedure
    .input(z.object({ videoId: z.uuid(), value: z.string().min(1, '评论不能为空').max(200, '评论不能超过200字符') }))
    .mutation(async ({ input, ctx }) => {
      const { videoId, value } = input
      const { id: userId } = ctx.user

      const [createComment] = await db.insert(comments).values({ userId, videoId, value }).returning()
      return createComment
    }),
  getMany: baseProcedure
    .input(
      z.object({ videoId: z.uuid(), cursor: z.object({ id: z.uuid(), updatedAt: z.date() }).nullish(), limit: z.number().min(1).max(100) })
    )
    .query(async ({ input, ctx }) => {
      const { videoId, cursor, limit } = input
      const { clerkUserId } = ctx

      let userId

      const [user] = await db
        .select()
        .from(users)
        .where(inArray(users.clerkId, clerkUserId ? [clerkUserId] : []))
      if (user) {
        userId = user.id
      }
      const viewerReactions = db.$with('viewer_reactions').as(
        db
          .select({
            commentId: commentReactions.commentId,
            type: commentReactions.type,
          })
          .from(commentReactions)
          .where(inArray(commentReactions.userId, userId ? [userId] : []))
      )

      const [totalData, data] = await Promise.all([
        db.select({ count: count() }).from(comments).where(eq(comments.videoId, videoId)),
        db
          .with(viewerReactions)
          .select({
            ...getTableColumns(comments),
            user: users,
            viewerReaction: viewerReactions.type,
            likeCount: db.$count(commentReactions, and(eq(commentReactions.type, 'like'), eq(commentReactions.commentId, comments.id))),
            dislikeCount: db.$count(
              commentReactions,
              and(eq(commentReactions.type, 'dislike'), eq(commentReactions.commentId, comments.id))
            ),
          })
          .from(comments)
          .where(
            and(
              eq(comments.videoId, videoId),
              cursor
                ? or(lt(comments.updatedAt, cursor.updatedAt), and(eq(comments.updatedAt, cursor.updatedAt), lt(comments.id, cursor.id)))
                : undefined
            )
          )
          .innerJoin(users, eq(comments.userId, users.id))
          .leftJoin(viewerReactions, eq(viewerReactions.commentId, comments.id))
          .orderBy(desc(comments.updatedAt), desc(comments.id))
          .limit(limit + 1),
      ])

      const hasMore = data.length > limit
      const items = hasMore ? data.slice(0, -1) : data

      const lastItem = items.length > 0 ? items[items.length - 1] : null
      const nextCursor =
        hasMore && lastItem
          ? {
              id: lastItem.id,
              updatedAt: lastItem.updatedAt,
            }
          : null
      return {
        items,
        nextCursor,
        totalCount: totalData[0].count,
      }
    }),
})
