import type { WorkflowContext } from '@upstash/workflow'
import { serve } from '@upstash/workflow/nextjs'
import { z } from 'zod'

import { db } from '@/db'
import { createVideoAIRequest, readVideoAIResult, type VideoAIKind, type VideoAIResponse } from '@/lib/video-ai'
import { muxToken } from '@/lib/video-media'
import { authenticatedWorkflow } from '@/lib/workflow-auth'
import { requireVideo } from '@/modules/videos/server/services/access'
import { saveGeneratedVideo } from '@/modules/videos/server/services/legacy-generation-save'

import { beginGeneration, failGeneration, finishTextGeneration, isGenerationActive } from './generation'

export const videoGenerationInput = z.object({ userId: z.uuid(), videoId: z.uuid(), jobId: z.uuid().optional() })
export const thumbnailGenerationInput = videoGenerationInput.extend({ prompt: z.string().trim().min(10).max(2000) })

export const textGenerationInput = videoGenerationInput.extend({ expectedValue: z.string().nullable().optional() })

export function getGenerationVideo<T extends z.infer<typeof videoGenerationInput>>(context: WorkflowContext, schema: z.ZodType<T>) {
  // context.call callbacks carry a provider response during the SDK's authorization probe.
  // Reach the first step before inspecting the payload; normal runs persist the parsed input.
  return context.run('get-video', async () => {
    const generationInput = schema.parse(context.requestPayload)
    const video = await requireVideo(generationInput.videoId, generationInput.userId, true)
    return { ...video, generationInput }
  })
}

async function getTranscript(video: { muxPlaybackId: string | null; muxTrackId: string | null }) {
  if (!video.muxPlaybackId || !video.muxTrackId) throw new Error('视频字幕尚未就绪')
  const token = await muxToken(video.muxPlaybackId, 'video')
  const trackUrl = `https://stream.mux.com/${video.muxPlaybackId}/text/${video.muxTrackId}.txt?token=${token}`
  const response = await fetch(trackUrl, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`字幕请求失败（HTTP ${response.status}）`)
  const text = await response.text()
  if (!text.trim()) throw new Error('视频字幕为空')
  return text
}

/** Keep side effects in workflow steps so QStash can replay completed steps safely. */
export function createVideoTextWorkflow(kind: VideoAIKind) {
  const { POST } = serve(
    async context => {
      const video = await getGenerationVideo(context, textGenerationInput)
      // Older runs already persisted get-video without generationInput.
      const input = video.generationInput ?? textGenerationInput.parse(context.requestPayload)
      const job = input.jobId
        ? await context.run('start-job', () => beginGeneration(input.jobId!, input.videoId, input.userId, kind))
        : null
      if (job && !isGenerationActive(job.status)) return { status: job.status }
      if (input.jobId && !job) throw new Error('生成任务不存在')
      const transcript = await context.run('get-transcript', () => getTranscript(video))
      const { status, body } = await context.call<VideoAIResponse>(`generated-${kind}`, createVideoAIRequest(kind, transcript))
      const content = readVideoAIResult(status, body)
      // Old in-flight tasks use their persisted get-video snapshot as the baseline.
      const expectedValue = input.expectedValue === undefined ? video[kind] : input.expectedValue
      const result = await context.run('update-video', async () =>
        input.jobId
          ? await finishTextGeneration(input.jobId, kind, content)
          : await saveGeneratedVideo(db, input, kind, expectedValue, content)
      )
      return result ?? { status: 'completed' as const } // already-completed legacy step
    },
    {
      failureFunction: async ({ context }) => {
        const input = textGenerationInput.parse(context.requestPayload)
        if (input.jobId) await failGeneration(input.jobId)
      },
    }
  )
  return authenticatedWorkflow(POST)
}
