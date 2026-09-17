import Mux from '@mux/mux-node'
import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

import { createVideoAIRequest, readVideoAIResult, type VideoAIKind } from '../src/lib/video-ai'

config({ path: '.env', quiet: true })

// Opt in explicitly: this reads the latest video's subtitles and makes two billable API calls.
if (process.env.RUN_AI_TEST !== '1') throw new Error('Set RUN_AI_TEST=1 to test DeepSeek with the latest video subtitles')

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  const [video] =
    await sql`select mux_playback_id, mux_track_id from videos where deletion_requested_at is null order by created_at desc limit 1`
  if (!video?.mux_playback_id || !video?.mux_track_id) throw new Error('最新视频字幕尚未就绪')
  const mux = new Mux({ tokenId: process.env.MUX_TOKEN_ID, tokenSecret: process.env.MUX_TOKEN_SECRET })
  const token = await mux.jwt.signPlaybackId(video.mux_playback_id, {
    type: 'video',
    expiration: '10m',
    keyId: process.env.MUX_SIGNING_KEY_ID,
    keySecret: process.env.MUX_SIGNING_PRIVATE_KEY,
  })
  const response = await fetch(`https://stream.mux.com/${video.mux_playback_id}/text/${video.mux_track_id}.txt?token=${token}`, {
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`字幕请求失败：HTTP ${response.status}`)
  const transcript = await response.text()
  console.log(`字幕读取成功：${transcript.length} 字符`)
  for (const kind of ['title', 'description'] as VideoAIKind[]) {
    const request = createVideoAIRequest(kind, transcript)
    const result = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(60000),
    })
    const content = readVideoAIResult(result.status, await result.json())
    console.log(JSON.stringify({ kind, status: result.status, model: request.body.model, content }))
  }
  console.log('验证成功；未修改数据库或视频内容。此脚本不经过 QStash。')
}

main().catch(error => {
  // Never print raw SDK/fetch errors: they may carry request credentials.
  console.error('验证失败：', error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, '[URL]') : 'Unknown error')
  process.exitCode = 1
})
