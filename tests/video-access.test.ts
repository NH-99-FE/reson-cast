import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { getTableColumns } from 'drizzle-orm'

// No credentials or network: exercise the real query builder with a recording transport.
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test'
const { db } = await import('../src/db')
const { videos } = await import('../src/db/schema')
const { requireVideo } = await import('../src/modules/videos/server/services/access')

test('actual video access entrypoint scopes guest and signed-in queries and rejects absent results', async () => {
  const calls: { sql: string; params: unknown[] }[] = []
  const transport = mock.method(db.$client, 'query', async (sql: string, params: unknown[]) => {
    calls.push({ sql, params })
    return { rows: [] }
  })
  try {
    for (const viewer of [undefined, 'owner', 'other']) {
      await assert.rejects(requireVideo('video', viewer), error => (error as { code: string }).code === 'NOT_FOUND')
      const { sql, params } = calls.at(-1)!
      assert.match(sql, /"deletion_requested_at" is null/)
      assert.match(sql, /"visibility" =/)
      assert.ok(params.includes('public') && params.includes('video'))
      if (viewer) {
        assert.match(sql, / or "videos"\."user_id" =/)
        assert.ok(params.includes(viewer))
      } else assert.doesNotMatch(sql, / or /)
    }
  } finally {
    transport.mock.restore()
  }
})

test('owner-only operations reject a readable video owned by someone else', async () => {
  const row = Object.keys(getTableColumns(videos)).map(key => (key === 'userId' ? 'owner' : key === 'id' ? 'video' : null))
  const transport = mock.method(db.$client, 'query', async () => ({ rows: [row] }))
  try {
    assert.equal((await requireVideo('video', 'owner', true)).id, 'video')
    await assert.rejects(requireVideo('video', 'other', true), error => (error as { code: string }).code === 'NOT_FOUND')
  } finally {
    transport.mock.restore()
  }
})

test('public Mux thumbnail route checks only public non-deleted videos and rejects noncanonical requests before querying', async () => {
  process.env.MUX_TOKEN_ID = 'test'
  process.env.MUX_TOKEN_SECRET = 'test'
  const { GET } = await import('../src/app/api/public/video-mux-thumbnails/[videoId]/[version]/[width]/route')
  const videoId = '00000000-0000-4000-8000-000000000002'
  const params = { videoId, version: '6d7578', width: '640' }
  const path = `/api/public/video-mux-thumbnails/${videoId}/6d7578/640`
  const calls: { sql: string; params: unknown[] }[] = []
  const transport = mock.method(db.$client, 'query', async (sql: string, params: unknown[]) => {
    calls.push({ sql, params })
    return { rows: [] }
  })
  try {
    const response = await GET(new Request(`https://example.test${path}`, { headers: { Cookie: 'owner-session' } }), {
      params: Promise.resolve(params),
    })
    assert.equal(response.status, 404)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.match(calls[0].sql, /"deletion_requested_at" is null/)
    assert.match(calls[0].sql, /"visibility" =/)
    assert.doesNotMatch(calls[0].sql, / or /)
    assert.ok(calls[0].params.includes('public') && calls[0].params.includes(videoId))
    for (const suffix of ['?token=forged', '?width=1280', '/']) {
      assert.equal((await GET(new Request(`https://example.test${path}${suffix}`), { params: Promise.resolve(params) })).status, 404)
    }
    for (const invalid of [{ width: '99999' }, { version: 'not-hex' }, { videoId: 'invalid' }]) {
      const input = { ...params, ...invalid }
      const request = new Request(`https://example.test/api/public/video-mux-thumbnails/${input.videoId}/${input.version}/${input.width}`)
      assert.equal((await GET(request, { params: Promise.resolve(input) })).status, 404)
    }
    assert.equal(calls.length, 1)
  } finally {
    transport.mock.restore()
  }
})
