import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { videoViews } from '@/db/schema'
import { requireVideo } from '@/modules/videos/server/services/access'
import { createTRPCRouter, protectedProcedure } from '@/trpc/init'

export const videoViewsRouter = createTRPCRouter({
  create: protectedProcedure.input(z.object({ videoId: z.uuid() })).mutation(async ({ input, ctx }) => {
    const { videoId } = input
    const { id: userId } = ctx.user
    await requireVideo(videoId, userId)
    const [existVideoView] = await db
      .select()
      .from(videoViews)
      .where(and(eq(videoViews.videoId, videoId), eq(videoViews.userId, userId)))

    if (existVideoView) {
      return existVideoView
    }

    const [createVideoView] = await db.insert(videoViews).values({ userId, videoId }).returning()

    return createVideoView
  }),
})
