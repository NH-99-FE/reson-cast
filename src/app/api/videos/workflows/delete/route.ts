import { serve } from '@upstash/workflow/nextjs'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { videos } from '@/db/schema'
import { authenticatedWorkflow } from '@/lib/workflow-auth'
import { cleanupVideo } from '@/modules/videos/server/services/deletion'

const inputSchema = z.object({ videoId: z.uuid(), runId: z.uuid() })
const { POST: workflowPost } = serve(
  async context => {
    const input = inputSchema.parse(context.requestPayload)
    await context.run('delete-video-resources', () => cleanupVideo(input.videoId, input.runId))
  },
  {
    failureFunction: async ({ context }) => {
      const input = inputSchema.parse(context.requestPayload)
      await db
        .update(videos)
        .set({ deletionError: '资源清理失败，请重试' })
        .where(and(eq(videos.id, input.videoId), eq(videos.deletionRunId, input.runId)))
    },
  }
)

export const POST = authenticatedWorkflow(workflowPost)
