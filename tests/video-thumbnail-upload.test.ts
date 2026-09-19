import assert from 'node:assert/strict'
import test from 'node:test'

import { extractRouterConfig } from 'uploadthing/server'

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test'
process.env.MUX_TOKEN_ID = 'test'
process.env.MUX_TOKEN_SECRET = 'test'
process.env.QSTASH_TOKEN = 'test'

const { ourFileRouter } = await import('../src/app/api/uploadthing/core')

test('manual covers use the default storage ACL without a paid private override', () => {
  const route = extractRouterConfig(ourFileRouter).find(route => route.slug === 'thumbnailUploader')
  assert.ok(route)
  assert.equal(route.config.image?.acl, undefined)
  assert.equal(route.config.image?.maxFileSize, '4MB')
  assert.equal(route.config.image?.maxFileCount, 1)
})
