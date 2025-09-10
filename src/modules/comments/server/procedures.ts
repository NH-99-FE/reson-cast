import { TRPCError } from '@trpc/server'
import { and, count, desc, eq, getTableColumns, lt, or } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { comments, users } from '@/db/schema'
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
    .query(async ({ input }) => {
      const { videoId, cursor, limit } = input
      const [totalData, data] = await Promise.all([
        db.select({ count: count() }).from(comments).where(eq(comments.videoId, videoId)),
        db
          .select({
            ...getTableColumns(comments),
            user: users,
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
          .orderBy(desc(comments.updatedAt), desc(comments.id))
          .limit(limit + 1),
      ])

      const hasMore = data.length > limit
      const items = hasMore ? data.slice(0, -1) : data

      const lastItem = items[items.length - 1]
      const nextCursor = hasMore ? { id: lastItem.id, updatedAt: lastItem.updatedAt } : null

      return {
        items,
        nextCursor,
        totalCount: totalData[0].count,
      }
    }),
})
