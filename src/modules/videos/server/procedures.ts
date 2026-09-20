import { TRPCError } from '@trpc/server'
import { and, desc, eq, getTableColumns, isNotNull, isNull, lt, or } from 'drizzle-orm'
import { inArray } from 'drizzle-orm/sql/expressions/conditions'
import { z } from 'zod'

import { db } from '@/db'
import { subscriptions, users, videoReactions, videos, videoUpdateSchema, videoViews } from '@/db/schema'
import { mux } from '@/lib/mux'
import { readyMuxSubtitle } from '@/lib/mux-subtitles'
import { imagePath, muxToken } from '@/lib/video-media'
import { publicVideoCondition, readableVideoCondition, requireVideo, viewerId } from '@/modules/videos/server/services/access'
import { requestVideoDeletion } from '@/modules/videos/server/services/deletion'
import { baseProcedure, createTRPCRouter, protectedProcedure } from '@/trpc/init'

import { getGenerationJob, retryVideoGeneration, startVideoGeneration } from './services/generation'
import { cleanupVideoFiles, pendingFileCleanup, restoreVideoThumbnail } from './services/thumbnails'
import { resumePlaybackRevocation, updateVideo } from './services/update'

export const videosRouter = createTRPCRouter({
  getManySubscribed: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit } = input
      const { id: userId } = ctx.user

      const viewerSubscription = db.$with('viewer_subscription').as(
        db
          .select({
            userId: subscriptions.creatorId,
          })
          .from(subscriptions)
          .where(eq(subscriptions.viewerId, userId))
      )

      const data = await db
        .with(viewerSubscription)
        .select({
          ...getTableColumns(videos),
          user: users,
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: db.$count(videoReactions, and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'like'))),
          dislikeCount: db.$count(videoReactions, and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'dislike'))),
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .innerJoin(viewerSubscription, eq(viewerSubscription.userId, users.id))
        .where(
          and(
            publicVideoCondition(),
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
  getManyTrending: baseProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.uuid(),
            viewCount: z.number(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input }) => {
      const { cursor, limit } = input

      const viewCountSubquery = db.$count(videoViews, eq(videoViews.videoId, videos.id))

      const data = await db
        .select({
          ...getTableColumns(videos),
          user: users,
          viewCount: viewCountSubquery,
          likeCount: db.$count(videoReactions, and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'like'))),
          dislikeCount: db.$count(videoReactions, and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'dislike'))),
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .where(
          and(
            publicVideoCondition(),
            cursor
              ? or(lt(viewCountSubquery, cursor.viewCount), and(eq(viewCountSubquery, cursor.viewCount), lt(videos.id, cursor.id)))
              : undefined
          )
        )
        .orderBy(desc(viewCountSubquery), desc(videos.id))
        .limit(limit + 1)

      // 多取一条，取到的数据长度>limit则说明有下一页
      const hasMore = data.length > limit

      const items = hasMore ? data.slice(0, -1) : data

      const lastItem = items[items.length - 1]

      const nextCursor = hasMore
        ? {
            id: lastItem.id,
            viewCount: lastItem.viewCount,
          }
        : null

      return {
        items,
        nextCursor,
      }
    }),
  getMany: baseProcedure
    .input(
      z.object({
        categoryId: z.uuid().nullish(),
        userId: z.uuid().nullish(),
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
      const { cursor, limit, categoryId, userId } = input
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
            publicVideoCondition(),
            userId ? eq(videos.userId, userId) : undefined,
            categoryId ? eq(videos.categoryId, categoryId) : undefined,
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
  getOne: baseProcedure.input(z.object({ id: z.uuid() })).query(async ({ input, ctx }) => {
    const { clerkUserId } = ctx
    let userId
    const [user] = await db
      .select()
      .from(users)
      .where(inArray(users.clerkId, clerkUserId ? [clerkUserId] : []))
      .limit(1)
    if (user) {
      userId = user.id
    }

    const viewerReactions = db.$with('viewer_reactions').as(
      db
        .select({ videoId: videoReactions.videoId, type: videoReactions.type })
        .from(videoReactions)
        .where(inArray(videoReactions.userId, userId ? [userId] : []))
    )

    const viewerSubscriptions = db.$with('viewer_subscriptions').as(
      db
        .select()
        .from(subscriptions)
        .where(inArray(subscriptions.viewerId, userId ? [userId] : []))
    )

    const [existingVideo] = await db
      .with(viewerReactions, viewerSubscriptions)
      .select({
        ...getTableColumns(videos),
        user: {
          ...getTableColumns(users),
          subscriberCount: db.$count(subscriptions, eq(subscriptions.creatorId, users.id)),
          viewerSubscribed: isNotNull(viewerSubscriptions.viewerId).mapWith(Boolean),
        },
        viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
        likeCount: db.$count(videoReactions, and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'like'))),
        dislikeCount: db.$count(videoReactions, and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, 'dislike'))),
        viewerReaction: viewerReactions.type,
      })
      .from(videos)
      .innerJoin(users, eq(videos.userId, users.id))
      .leftJoin(viewerReactions, eq(viewerReactions.videoId, videos.id))
      .leftJoin(viewerSubscriptions, eq(viewerSubscriptions.creatorId, users.id))
      .where(and(eq(videos.id, input.id), readableVideoCondition(userId)))

    if (!existingVideo) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }
    return existingVideo
  }),
  generateDescription: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(({ ctx, input }) => startVideoGeneration('description', input.id, ctx.user.id)),
  generateTitle: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(({ ctx, input }) => startVideoGeneration('title', input.id, ctx.user.id)),
  getGenerationStatus: protectedProcedure
    .input(z.object({ id: z.uuid(), kind: z.enum(['title', 'description', 'thumbnail']), jobId: z.uuid().optional() }))
    .query(({ ctx, input }) => getGenerationJob(input.id, ctx.user.id, input.kind, input.jobId)),
  retryGeneration: protectedProcedure
    .input(z.object({ jobId: z.uuid() }))
    .mutation(({ ctx, input }) => retryVideoGeneration(input.jobId, ctx.user.id)),
  generateThumbnail: protectedProcedure
    .input(z.object({ id: z.uuid(), prompt: z.string().trim().min(10).max(2000) }))
    .mutation(({ ctx, input }) => startVideoGeneration('thumbnail', input.id, ctx.user.id, input.prompt)),
  getPendingFileCleanup: protectedProcedure.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    await requireVideo(input.id, ctx.user.id, true)
    return { count: (await pendingFileCleanup(input.id)).length }
  }),
  retryFileCleanup: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    await requireVideo(input.id, ctx.user.id, true)
    return { count: await cleanupVideoFiles(input.id) }
  }),
  retryPlaybackRevocation: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    return resumePlaybackRevocation(await requireVideo(input.id, ctx.user.id, true))
  }),
  revalidate: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const { id: userId } = ctx.user
    const [existingVideo] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, input.id), eq(videos.userId, userId), isNull(videos.deletionRequestedAt)))

    if (!existingVideo) {
      throw new TRPCError({ code: 'NOT_FOUND' })
    }

    if (existingVideo.muxPlaybackIdToRevoke) throw new TRPCError({ code: 'CONFLICT', message: '请先点击重试撤销，完成播放权限更新' })

    if (!existingVideo.muxUploadId) {
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }

    // mux上传记录
    const upload = await mux.video.uploads.retrieve(existingVideo.muxUploadId)

    if (!upload?.asset_id) {
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }

    const asset = await mux.video.assets.retrieve(upload.asset_id)

    if (!asset) {
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }

    const playBackId = asset.playback_ids?.find(item => item.policy === 'signed')?.id
    if (!playBackId) throw new TRPCError({ code: 'BAD_REQUEST', message: '视频缺少签名播放 ID' })
    const duration = asset.duration ? Math.round(asset.duration * 1000) : 0

    const [updateVideo] = await db
      .update(videos)
      .set({
        muxStatus: asset.status,
        ...readyMuxSubtitle(asset.tracks),
        muxPlaybackId: playBackId,
        muxAssetId: asset.id,
        duration,
        thumbnailUrl: imagePath(input.id, 'thumbnail'),
        previewUrl: imagePath(input.id, 'preview'),
      })
      .where(
        and(
          eq(videos.id, input.id),
          eq(videos.userId, userId),
          isNull(videos.deletionRequestedAt),
          isNull(videos.muxPlaybackIdToRevoke),
          existingVideo.muxPlaybackId ? eq(videos.muxPlaybackId, existingVideo.muxPlaybackId) : isNull(videos.muxPlaybackId)
        )
      )
      .returning()
    if (!updateVideo) throw new TRPCError({ code: 'CONFLICT', message: '视频状态已变化，请重试' })
    return updateVideo
  }),
  restoreThumbnail: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(({ ctx, input }) => restoreVideoThumbnail(input.id, ctx.user.id)),
  remove: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const [video] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, input.id), eq(videos.userId, ctx.user.id)))
    if (!video) throw new TRPCError({ code: 'NOT_FOUND' })
    await requestVideoDeletion(video.id)
    return { id: video.id }
  }),
  getPlayback: baseProcedure.input(z.object({ id: z.uuid() })).query(async ({ input, ctx }) => {
    const video = await requireVideo(input.id, await viewerId(ctx.clerkUserId))
    if (video.muxPlaybackIdToRevoke || !video.muxPlaybackId || video.muxStatus !== 'ready') return null
    const expiration = `${Math.max(3600, Math.ceil(video.duration / 1000) + 600)}s`
    const [playback, storyboard] = await Promise.all([
      muxToken(video.muxPlaybackId, 'video', expiration),
      muxToken(video.muxPlaybackId, 'storyboard', expiration),
    ])
    return { playbackId: video.muxPlaybackId, tokens: { playback, storyboard } }
  }),
  update: protectedProcedure.input(videoUpdateSchema).mutation(({ ctx, input }) => updateVideo(input, ctx.user.id)),
  create: protectedProcedure.mutation(async ({ ctx }) => {
    const { id: userId } = ctx.user

    const upload = await mux.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: {
        passthrough: `reson-cast:${userId}`,
        playback_policy: ['signed'],
        inputs: [
          {
            generated_subtitles: [
              {
                language_code: 'en',
                name: 'English',
              },
            ],
          },
        ],
      },
    })

    const [video] = await db
      .insert(videos)
      .values({
        userId,
        title: 'Untitled',
        muxStatus: 'waiting',
        muxUploadId: upload.id,
      })
      .returning()

    return {
      video: video,
      url: upload.url,
    }
  }),
})
