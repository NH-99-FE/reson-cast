import { serve } from '@upstash/workflow/nextjs'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { videos } from '@/db/schema'

interface InputType {
  userId: string
  videoId: string
}

// const TITLE_SYSTEM_PROMPT = `Your task is to generate an SEO-focused title for a YouTube video based on its transcript. Please follow these guidelines:
// - Be concise but descriptive, using relevant keywords to improve discoverability.
// - Highlight the most compelling or unique aspect of the video content.
// - Avoid jargon or overly complex language unless it directly supports searchability.
// - Use action-oriented phrasing or clear value propositions where applicable.
// - Ensure the title is 3-8 words long in chinese and no more than 100 characters.
// - ONLY return the title as plain text. Do not add quotes or any additional formatting.`
const TITLE_SYSTEM_PROMPT = `你的任务是为YouTube视频生成一个简洁有力的中文标题。请遵循以下要求：
- 要突出视频内容的核心价值或最吸引人的点
- 使用简洁有力的词汇，避免冗余
- 优先使用动词开头或包含动作性词汇
- 考虑SEO效果，使用容易搜索的关键词
- 只返回标题文本，不要加引号或其他格式
`

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

  const { body } = await context.api.openai.call<{ choices: Array<{ message: { content: string } }> }>('generated-title', {
    baseURL: 'https://api.siliconflow.cn/v1/chat/completions',
    token: process.env.SILICONDLOW_API_KEY!,
    operation: 'chat.completions.create',
    body: {
      model: 'Qwen/QwQ-32B',
      messages: [
        {
          role: 'system',
          content: TITLE_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: transcript,
        },
      ],
    },
  })

  const title = body.choices[0].message.content
  if (!title) {
    throw new Error('Bad request')
  }

  await context.run('update-video', async () => {
    await db
      .update(videos)
      .set({ title: title || video.title })
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId)))
  })
})
