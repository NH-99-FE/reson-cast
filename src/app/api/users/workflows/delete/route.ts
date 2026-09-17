import { serve } from '@upstash/workflow/nextjs'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { users, videos } from '@/db/schema'
import { deleteFiles } from '@/lib/video-media'
import { authenticatedWorkflow } from '@/lib/workflow-auth'
import { cleanupVideo } from '@/modules/videos/server/services/deletion'

const { POST: workflowPost } = serve(async context => {
  const { userId } = z.object({ userId: z.uuid() }).parse(context.requestPayload)
  const data = await context.run('load-user-resources', async () => {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    const items = await db.select({ id: videos.id }).from(videos).where(eq(videos.userId, userId))
    return { bannerKey: user?.bannerKey, videoIds: items.map(item => item.id) }
  })
  for (const id of data.videoIds) await context.run(`delete-video-${id}`, () => cleanupVideo(id))
  await context.run('delete-user', async () => {
    await deleteFiles([data.bannerKey])
    await db.delete(users).where(eq(users.id, userId))
  })
})

export const POST = authenticatedWorkflow(workflowPost)
