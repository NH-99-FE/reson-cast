import { db } from '@/db'
import { videos } from '@/db/schema'
import { mux } from '@/lib/mux'
import { createTRPCRouter, protectedProcedure } from '@/trpc/init'

export const videosRouter = createTRPCRouter({
  create: protectedProcedure.mutation(async ({ ctx }) => {
    const { id: userId } = ctx.user

    const upload = await mux.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: {
        passthrough: userId,
        playback_policy: ['public'],
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
