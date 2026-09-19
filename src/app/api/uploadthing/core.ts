import { auth } from '@clerk/nextjs/server'
import { and, eq, isNull } from 'drizzle-orm'
import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { UploadThingError, UTApi } from 'uploadthing/server'
import { z } from 'zod'

import { db } from '@/db'
import { users, videos } from '@/db/schema'
import { replaceVideoThumbnail } from '@/modules/videos/server/services/thumbnails'

const f = createUploadthing()

export const ourFileRouter = {
  bannerUploader: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const { userId: userClerkId } = await auth()

      if (!userClerkId) throw new UploadThingError('Unauthorized')

      const [existingUser] = await db.select().from(users).where(eq(users.clerkId, userClerkId))

      if (!existingUser) throw new UploadThingError('Unauthorized')

      // 更改背景图之前会先将之前的url和key置为空
      if (existingUser.bannerKey) {
        const utapi = new UTApi()
        await utapi.deleteFiles(existingUser.bannerKey)
        await db.update(users).set({ bannerKey: null, bannerUrl: null }).where(eq(users.id, existingUser.id))
      }
      return { userId: existingUser.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await db
        .update(users)
        .set({
          bannerUrl: file.ufsUrl,
          bannerKey: file.key,
        })
        .where(eq(users.id, metadata.userId))
      return { uploadedBy: metadata.userId }
    }),
  thumbnailUploader: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
  })
    .input(
      z.object({
        videoId: z.uuid(),
      })
    )
    .middleware(async ({ input }) => {
      const { userId: userClerkId } = await auth()

      if (!userClerkId) throw new UploadThingError('Unauthorized')

      const [user] = await db.select().from(users).where(eq(users.clerkId, userClerkId))

      if (!user) throw new UploadThingError('Unauthorized')

      const [existingVideo] = await db
        .select({
          thumbnailKey: videos.thumbnailKey,
        })
        .from(videos)
        .where(and(eq(videos.id, input.videoId), eq(videos.userId, user.id), isNull(videos.deletionRequestedAt)))

      if (!existingVideo) throw new UploadThingError('Not found')

      return { userId: user.id, videoId: input.videoId, oldKey: existingVideo.thumbnailKey }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const { attached } = await replaceVideoThumbnail({
        videoId: metadata.videoId,
        userId: metadata.userId,
        expectedKey: metadata.oldKey,
        newKey: file.key,
      })
      return { uploadedBy: metadata.userId, attached }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
