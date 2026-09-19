import assert from 'node:assert/strict'
import test from 'node:test'

import { createImageAIRequest, getImageAIConfig, readImageAIResult } from '../src/lib/video-image-ai'

test('thumbnail requests use 1K landscape images and Agnes URL output', () => {
  const config = {
    IMAGE_AI_API_URL: 'https://apihub.agnes-ai.com/v1/images/generations',
    IMAGE_AI_API_KEY: 'test-image-key',
    IMAGE_AI_MODEL: 'agnes-image-2.5-flash',
  }
  const saved = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]))
  try {
    Object.assign(process.env, config)
    const request = createImageAIRequest('生成一张简洁的视频封面')
    assert.equal(request.url, config.IMAGE_AI_API_URL)
    assert.equal(request.method, 'POST')
    assert.deepEqual(request.headers, {
      Authorization: `Bearer ${config.IMAGE_AI_API_KEY}`,
      'Content-Type': 'application/json',
    })
    assert.deepEqual(request.body, {
      model: config.IMAGE_AI_MODEL,
      prompt: '生成一张简洁的视频封面',
      size: '1K',
      ratio: '16:9',
      extra_body: { response_format: 'url' },
    })
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('missing image configuration does not fall back to the text provider', () => {
  const saved = process.env.IMAGE_AI_API_KEY
  try {
    delete process.env.IMAGE_AI_API_KEY
    assert.throws(() => getImageAIConfig(), /尚未配置/)
  } finally {
    if (saved === undefined) delete process.env.IMAGE_AI_API_KEY
    else process.env.IMAGE_AI_API_KEY = saved
  }
})

test('accept supported image URL responses and reject errors or unsupported results before uploading', () => {
  const url = 'https://example.com/image.png'
  assert.equal(readImageAIResult(200, { data: [{ url }] }), url)
  assert.equal(readImageAIResult(200, { images: [{ url }] }), url)
  assert.throws(() => readImageAIResult(402, {}), /HTTP 402/)
  assert.throws(() => readImageAIResult(200, {}), /未返回图片 URL/)
  assert.throws(() => readImageAIResult(200, { data: [{ url: 'file:///tmp/image.png' }] }), /HTTPS/)
})
