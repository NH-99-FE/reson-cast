import assert from 'node:assert/strict'
import { test } from 'node:test'

import { type CleanupProvider, type CleanupResources, cleanupResources } from '../src/lib/video-cleanup'
import { authenticatedWorkflow } from '../src/lib/workflow-auth'

const resources: CleanupResources = { muxUploadId: 'upload', muxAssetId: null, thumbnailKey: 'cover', previewKey: 'preview' }
function fixture(overrides: Partial<CleanupProvider> = {}) {
  const calls: string[] = []
  const provider: CleanupProvider = {
    upload: async () => ({ status: 'asset_created', asset_id: 'asset' }),
    cancelUpload: async () => {
      calls.push('cancel')
    },
    deleteAsset: async id => {
      calls.push(`asset:${id}`)
    },
    deleteFiles: async keys => {
      calls.push(`files:${keys.join(',')}`)
    },
    ...overrides,
  }
  return { calls, provider }
}
test('cleanup discovers an asset even before the created webhook has stored its ID', async () => {
  const { provider, calls } = fixture()
  await cleanupResources(resources, provider)
  assert.deepEqual(calls, ['asset:asset', 'files:cover,preview'])
})
test('cancel an unfinished upload before deleting its files', async () => {
  let cancelled = false
  const { provider, calls } = fixture({
    upload: async () => ({ status: cancelled ? 'cancelled' : 'waiting' }),
    cancelUpload: async () => {
      cancelled = true
    },
  })
  await cleanupResources(resources, provider)
  assert.equal(cancelled, true)
  assert.deepEqual(calls, ['files:cover,preview'])
})
test('asset creation racing cancellation is discovered and cleaned', async () => {
  let read = 0
  const { provider, calls } = fixture({
    upload: async () => (++read === 1 ? { status: 'waiting' } : { status: 'asset_created', asset_id: 'late-asset' }),
    cancelUpload: async () => {
      throw { status: 409 }
    },
  })
  await cleanupResources(resources, provider)
  assert.deepEqual(calls, ['asset:late-asset', 'files:cover,preview'])
})
test('failed cancellation does not silently abandon an active upload', async () => {
  const { provider, calls } = fixture({
    upload: async () => ({ status: 'waiting' }),
    cancelUpload: async () => {
      throw new Error('network')
    },
  })
  await assert.rejects(cleanupResources(resources, provider), /network/)
  assert.deepEqual(calls, [])
})
test('retry after image cleanup failed accepts the now-missing asset', async () => {
  let removed = false
  let attempts = 0
  const { provider } = fixture({
    deleteAsset: async () => {
      if (removed) throw { status: 404 }
      removed = true
    },
    deleteFiles: async () => {
      if (++attempts === 1) throw new Error('storage unavailable')
    },
  })
  await assert.rejects(cleanupResources(resources, provider), /storage unavailable/)
  await cleanupResources(resources, provider)
  assert.equal(attempts, 2)
})
test('authorization/provider failures propagate instead of pretending the asset was deleted', async () => {
  const { provider, calls } = fixture({
    deleteAsset: async () => {
      throw { status: 401 }
    },
  })
  await assert.rejects(cleanupResources(resources, provider), error => (error as { status: number }).status === 401)
  assert.deepEqual(calls, [])
})
test('duplicate resource IDs are deleted only once and missing uploads do not block stored assets', async () => {
  const a = fixture()
  await cleanupResources({ ...resources, muxAssetId: 'asset' }, a.provider)
  assert.deepEqual(a.calls, ['asset:asset', 'files:cover,preview'])
  const b = fixture({
    upload: async () => {
      throw { status: 404 }
    },
  })
  await cleanupResources({ ...resources, muxAssetId: 'saved-asset' }, b.provider)
  assert.deepEqual(b.calls, ['asset:saved-asset', 'files:cover,preview'])
})
test('workflow fails closed with missing signing keys', async () => {
  const saved = [process.env.QSTASH_CURRENT_SIGNING_KEY, process.env.QSTASH_NEXT_SIGNING_KEY]
  let called = false
  const scheduled: unknown[] = []
  try {
    delete process.env.QSTASH_CURRENT_SIGNING_KEY
    delete process.env.QSTASH_NEXT_SIGNING_KEY
    const post = authenticatedWorkflow(
      async () => {
        called = true
        return new Response('OK')
      },
      callback => {
        scheduled.push(callback)
      }
    )
    assert.equal((await post(new Request('https://example.test'))).status, 503)
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'current'
    assert.equal((await post(new Request('https://example.test'))).status, 503)
    assert.equal(called, false)
    process.env.QSTASH_NEXT_SIGNING_KEY = 'next'
    assert.equal((await post(new Request('https://example.test'))).status, 401)
    assert.equal(scheduled.length, 0)
    assert.equal((await post(new Request('https://example.test', { headers: { 'upstash-signature': 'sdk-verifies-this' } }))).status, 200)
    assert.equal(scheduled.length, 1)
  } finally {
    for (const [index, key] of ['QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY'].entries()) {
      if (saved[index] === undefined) delete process.env[key]
      else process.env[key] = saved[index]
    }
  }
})
