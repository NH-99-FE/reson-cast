import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { serve } from '@upstash/workflow/nextjs'

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test'
process.env.MUX_TOKEN_ID = 'test'
process.env.MUX_TOKEN_SECRET = 'test'
process.env.QSTASH_TOKEN = 'test'
const { getGenerationVideo, textGenerationInput, thumbnailGenerationInput } = await import('../src/modules/videos/server/services/generation-workflow')

// This is the context.call callback envelope, not the initial user/video payload.
const callbackRequest = () =>
  new Request('https://example.test/workflow', {
    method: 'POST',
    headers: { 'Upstash-Workflow-Callback': 'true', 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 503, body: btoa('provider retry'), maxRetries: 3, retried: 1 }),
  })

test('SDK callback authorization reproduces the failure when parsing before the first step', async () => {
  const warning = mock.method(console, 'warn', () => {})
  try {
    const { POST } = serve(
      async context => {
        textGenerationInput.parse(context.requestPayload)
        await context.run('get-video', () => null)
      },
      { env: { QSTASH_TOKEN: 'test' }, onError: () => {} }
    )
    assert.equal((await POST(callbackRequest())).status, 500)
  } finally {
    warning.mock.restore()
  }
})

test('text and thumbnail callbacks reach the first step without parsing the callback envelope', async () => {
  const warning = mock.method(console, 'warn', () => {})
  try {
    for (const schema of [textGenerationInput, thumbnailGenerationInput]) {
      let continued = false
      const { POST } = serve(
        async context => {
          await getGenerationVideo<{ userId: string; videoId: string }>(context, schema)
          continued = true
        },
        { env: { QSTASH_TOKEN: 'test' }, onError: () => {} }
      )
      const response = await POST(callbackRequest())
      assert.equal(response.status, 200)
      assert.equal(continued, false, 'callback must be handled by the SDK, without executing database/AI work')
    }
  } finally {
    warning.mock.restore()
  }
})
