import { serve } from '@upstash/workflow/nextjs'
import { UTApi } from 'uploadthing/server'

import { createImageAIRequest, type ImageAIResponse, readImageAIResult } from '@/lib/video-image-ai'
import { authenticatedWorkflow } from '@/lib/workflow-auth'
import { beginGeneration, failGeneration, isGenerationActive } from '@/modules/videos/server/services/generation'
import { getGenerationVideo, thumbnailGenerationInput } from '@/modules/videos/server/services/generation-workflow'
import { replaceVideoThumbnail } from '@/modules/videos/server/services/thumbnails'

const { POST: workflowPost } = serve(
  async context => {
    const video = await getGenerationVideo(context, thumbnailGenerationInput)
    const input = video.generationInput ?? thumbnailGenerationInput.parse(context.requestPayload)
    const { userId, videoId, prompt } = input
    const job = input.jobId ? await context.run('start-job', () => beginGeneration(input.jobId!, videoId, userId, 'thumbnail')) : null
    if (job && !isGenerationActive(job.status)) return { status: job.status }
    if (input.jobId && !job) throw new Error('生成任务不存在')
    const { status, body } = await context.call<ImageAIResponse>('generate-thumbnail', createImageAIRequest(prompt))
    const imageUrl = readImageAIResult(status, body)
    const upload = await context.run('upload-thumbnail', async () => {
      const { data, error } = await new UTApi().uploadFilesFromUrl(imageUrl, { acl: 'private' })
      if (error || !data) throw new Error('生成的封面上传失败')
      return data
    })
    return context.run('update-video', () =>
      replaceVideoThumbnail({
        videoId,
        userId,
        expectedKey: job ? job.expectedValue : video.thumbnailKey,
        newKey: upload.key,
        jobId: input.jobId,
      })
    )
  },
  {
    failureFunction: async ({ context }) => {
      const input = thumbnailGenerationInput.parse(context.requestPayload)
      if (input.jobId) await failGeneration(input.jobId)
    },
  }
)

export const POST = authenticatedWorkflow(workflowPost)
