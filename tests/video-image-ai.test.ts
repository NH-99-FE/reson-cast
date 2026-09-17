import assert from 'node:assert/strict'
import test from 'node:test'

import { getImageAIConfig, readImageAIResult } from '../src/lib/video-image-ai'

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
