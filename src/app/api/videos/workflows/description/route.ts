import { serve } from '@upstash/workflow/nextjs'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { videos } from '@/db/schema'

interface InputType {
  userId: string
  videoId: string
}

// const DESCRIPTION_SYSTEM_PROMPT = `Your task is to summarize the transcript of a video. Please follow these guidelines:
// - Be brief. Condense the content into a summary that captures the key points and main ideas without losing important details.
// - Avoid jargon or overly complex language unless necessary for the context.
// - Focus on the most critical information, ignoring filler, repetitive statements, or irrelevant tangents.
// - ONLY return the summary, no other text, annotations, or comments.
// - Aim for a summary that is 3-5 sentences long and no more than 200 characters.`;

const DESCRIPTION_SYSTEM_PROMPT = `你的任务是为视频字幕内容生成中文简介。请遵循以下要求：
- 保持简洁。将内容压缩为能够捕捉关键点和主要思想的简介，不丢失重要细节
- 避免使用专业术语或过于复杂的语言，除非上下文需要
- 专注于最关键的信息，忽略填充词、重复陈述或无关的离题内容
- 只返回简介内容，不要添加其他文本、注释或评论
- 简介应为3-5句话，不超过150个中文字符
- 必须使用中文回复`

export const { POST } = serve(async context => {
  const input = context.requestPayload as InputType
  const { userId, videoId } = input

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

  const transcript = await context.run('get-transcript', async () => {
    const trackUrl = `https://stream.mux.com/${video.muxPlaybackId}/text/${video.muxTrackId}.txt`
    const response = await fetch(trackUrl)
    const text = await response.text()
    if (!text) {
      throw new Error('Bad request')
    }
    return text
  })

  const { body } = await context.api.openai.call<{ choices: Array<{ message: { content: string } }> }>('generated-description', {
    baseURL: 'https://api.siliconflow.cn/v1/chat/completions',
    token: process.env.SILICONDLOW_API_KEY!,
    operation: 'chat.completions.create',
    body: {
      model: 'Qwen/QwQ-32B',
      messages: [
        {
          role: 'system',
          content: DESCRIPTION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: transcript,
        },
      ],
    },
  })

  const description = body.choices[0].message.content
  if (!description) {
    throw new Error('Bad request')
  }

  await context.run('update-video', async () => {
    await db
      .update(videos)
      .set({ description: description || video.description })
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId)))
  })
})
