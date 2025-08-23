import { serve } from '@upstash/workflow/nextjs'
import { and, eq } from 'drizzle-orm'
import { UTApi } from 'uploadthing/server'

import { db } from '@/db'
import { videos } from '@/db/schema'

interface InputType {
  userId: string
  videoId: string
  prompt: string
}

export const { POST } = serve(async context => {
  const input = context.requestPayload as InputType
  const { userId, videoId, prompt } = input
  const utapi = new UTApi()

  // 获取视频
  const video = await context.run('get-video', async () => {
    const [existingVideo] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId)))
    if (!existingVideo) {
      throw new Error('Not found')
    }
    return existingVideo
  })

  const { body } = await context.call<{ images: Array<{ url: string }> }>('generate-thumbnail', {
    url: 'https://api.siliconflow.cn/v1/images/generations',
    method: 'POST',
    body: {
      model: 'Kwai-Kolors/Kolors',
      prompt,
      image_size: '1792x1024',
    },
    headers: {
      Authorization: `Bearer ${process.env.SILICONDLOW_API_KEY}`,
    },
  })

  const tempThumbnailUrl = body.images[0].url

  if (!tempThumbnailUrl) {
    throw new Error('Bad request')
  }

  await context.run('cleanup-thumbnail', async () => {
    if (video.thumbnailKey) {
      await utapi.deleteFiles(video.thumbnailKey)
      await db
        .update(videos)
        .set({
          thumbnailKey: null,
          thumbnailUrl: null,
        })
        .where(and(eq(videos.id, videoId), eq(videos.userId, userId)))
    }
  })

  const uploadtempThumbnail = await context.run('upload-thumbnailUrl', async () => {
    const { data, error } = await utapi.uploadFilesFromUrl(tempThumbnailUrl)
    if (error) {
      throw new Error('Bad request')
    }
    return data
  })

  await context.run('update-video', async () => {
    await db
      .update(videos)
      .set({ thumbnailUrl: uploadtempThumbnail.url, thumbnailKey: uploadtempThumbnail.key })
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId)))
  })
})
