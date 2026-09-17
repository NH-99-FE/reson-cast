import assert from 'node:assert/strict'
import test from 'node:test'

import { createVideoAIRequest, getVideoAIConfig, readVideoAIResult } from '../src/lib/video-ai'

test('DeepSeek configuration and request use the configured model without leaking to an arbitrary host', () => {
  const saved = { API_KEY: process.env.API_KEY, AI_API_URL: process.env.AI_API_URL, MODEL_ID: process.env.MODEL_ID }
  try {
    process.env.API_KEY = 'test-key'
    process.env.AI_API_URL = 'https://api.deepseek.com/v1/'
    process.env.MODEL_ID = ''
    const request = createVideoAIRequest('title', '视频字幕')
    assert.equal(request.url, 'https://api.deepseek.com/v1/chat/completions')
    assert.equal(request.body.model, 'deepseek-flash')
    assert.equal(request.body.thinking.type, 'disabled')
    process.env.MODEL_ID = 'deepseek-v4-pro'
    assert.equal(getVideoAIConfig().model, 'deepseek-v4-pro')
    process.env.AI_API_URL = 'https://example.com'
    assert.throws(() => getVideoAIConfig(), /AI_API_URL/)
    process.env.API_KEY = ''
    assert.throws(() => getVideoAIConfig(), /API_KEY/)
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('AI errors, missing choices, empty or truncated results cannot be written to the video', () => {
  assert.throws(() => readVideoAIResult(402, {}), /HTTP 402/)
  assert.throws(() => readVideoAIResult(200, {}), /未完整/)
  assert.throws(() => readVideoAIResult(200, { choices: [{ finish_reason: 'length', message: { content: 'partial' } }] }), /未完整/)
  assert.throws(() => readVideoAIResult(200, { choices: [{ finish_reason: 'stop', message: { content: '  ' } }] }), /为空/)
  assert.equal(readVideoAIResult(200, { choices: [{ finish_reason: 'stop', message: { content: ' 标题 ' } }] }), '标题')
})
