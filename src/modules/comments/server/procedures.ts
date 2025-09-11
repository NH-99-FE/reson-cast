import { TRPCError } from '@trpc/server'
import { and, count, desc, eq, getTableColumns, isNotNull, isNull, lt, or } from 'drizzle-orm'
import { inArray } from 'drizzle-orm/sql/expressions/conditions'
import { z } from 'zod'

import { db } from '@/db'
import { commentReactions, comments, users, videos } from '@/db/schema'
import { baseProcedure, createTRPCRouter, protectedProcedure } from '@/trpc/init'

export const commentsRouter = createTRPCRouter({
  remove: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input, ctx }) => {
    const { id } = input
    const { id: userId } = ctx.user

    // 先查询评论和对应的视频信息
    const [commentWithVideo] = await db
      .select({
        commentId: comments.id,
        commentUserId: comments.userId,
        videoUserId: videos.userId,
      })
      .from(comments)
      .innerJoin(videos, eq(comments.videoId, videos.id))
      .where(eq(comments.id, id))

    if (!commentWithVideo) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }

    // 检查权限：评论作者 OR 视频作者
    const isCommentAuthor = commentWithVideo.commentUserId === userId
    const isVideoOwner = commentWithVideo.videoUserId === userId

    if (!isCommentAuthor && !isVideoOwner) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }

    const [deleteComment] = await db.delete(comments).where(eq(comments.id, id)).returning()

    return deleteComment
  }),
  create: protectedProcedure
    .input(
      z.object({
        videoId: z.uuid(),
        parentId: z.uuid().nullish(),
        value: z.string().min(1, '评论不能为空').max(200, '评论不能超过200字符'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { videoId, value, parentId } = input
      const { id: userId } = ctx.user

      const [existingComment] = await db
        .select()
        .from(comments)
        .where(inArray(comments.id, parentId ? [parentId] : []))

      if (!existingComment && parentId) throw new TRPCError({ code: 'NOT_FOUND' })

      if (existingComment?.parentId && parentId) {
        throw new TRPCError({ code: 'BAD_REQUEST' })
      }

      const [createComment] = await db.insert(comments).values({ userId, videoId, parentId, value }).returning()
      return createComment
    }),
  getMany: baseProcedure
    .input(
      z.object({
        videoId: z.uuid(),
        parentId: z.uuid().nullish(),
        cursor: z.object({ id: z.uuid(), updatedAt: z.date() }).nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { parentId, videoId, cursor, limit } = input
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

      const replies = db.$with('replies').as(
        db
          .select({
            parentId: comments.parentId,
            count: count(comments.id).as('count'),
          })
          .from(comments)
          .where(isNotNull(comments.parentId))
          .groupBy(comments.parentId)
      )

      const videoOwner = db.$with('video_owners').as(
        db
          .select({
            videoId: videos.id,
            ownerClerkId: users.clerkId,
          })
          .from(videos)
          .innerJoin(users, eq(videos.userId, users.id))
      )

      const [totalData, data] = await Promise.all([
        db.select({ count: count() }).from(comments).where(eq(comments.videoId, videoId)),
        db
          .with(viewerReactions, replies, videoOwner)
          .select({
            ...getTableColumns(comments),
            user: users,
            viewerReaction: viewerReactions.type,
            replyCount: replies.count,
            likeCount: db.$count(commentReactions, and(eq(commentReactions.type, 'like'), eq(commentReactions.commentId, comments.id))),
            dislikeCount: db.$count(
              commentReactions,
              and(eq(commentReactions.type, 'dislike'), eq(commentReactions.commentId, comments.id))
            ),
            videoOwnerClerkId: videoOwner.ownerClerkId,
          })
          .from(comments)
          .where(
            and(
              eq(comments.videoId, videoId),
              parentId ? eq(comments.parentId, parentId) : isNull(comments.parentId),
              cursor
                ? or(lt(comments.updatedAt, cursor.updatedAt), and(eq(comments.updatedAt, cursor.updatedAt), lt(comments.id, cursor.id)))
                : undefined
            )
          )
          .innerJoin(users, eq(comments.userId, users.id))
          .leftJoin(viewerReactions, eq(viewerReactions.commentId, comments.id))
          .leftJoin(replies, eq(comments.id, replies.parentId))
          .leftJoin(videoOwner, eq(videoOwner.videoId, comments.videoId))
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
