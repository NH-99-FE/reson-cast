import { TRPCError } from '@trpc/server'
import { and, desc, eq, getTableColumns, lt, or } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { users, videoReactions, videos, videoViews } from '@/db/schema'
import { baseProcedure, createTRPCRouter, protectedProcedure } from '@/trpc/init'

export const suggestionRouter = createTRPCRouter({
  getOne: protectedProcedure.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const { id: userId } = ctx.user
    const { id } = input
    const [video] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, id), eq(videos.userId, userId)))

    if (!video) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    return video
  }),
  getMany: baseProcedure
    .input(
      z.object({
        videoId: z.uuid(),
        cursor: z
          .object({
            id: z.uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input }) => {
      const { videoId, cursor, limit } = input

      const [existingVideo] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1)

      if (!existingVideo) throw new TRPCError({ code: 'NOT_FOUND' })

      const data = await db
        .select({
          ...getTableColumns(videos),
          user: users,
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: db.$count(videoReactions, and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'like'))),
          dislikeCount: db.$count(videoReactions, and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'dislike'))),
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .where(
          and(
            existingVideo.categoryId ? eq(videos.categoryId, existingVideo.categoryId) : undefined,
            cursor
              ? or(lt(videos.updatedAt, cursor.updatedAt), and(eq(videos.updatedAt, cursor.updatedAt), lt(videos.id, cursor.id)))
              : undefined
          )
        )
        .orderBy(desc(videos.updatedAt), desc(videos.id))
        .limit(limit + 1)

      // 多取一条，取到的数据长度>limit则说明有下一页
      const hasMore = data.length > limit

      const items = hasMore ? data.slice(0, -1) : data

      const lastItem = items[items.length - 1]

      const nextCursor = hasMore
        ? {
            id: lastItem.id,
            updatedAt: lastItem.updatedAt,
          }
        : null

      return {
        items,
        nextCursor,
      }
    }),
})
