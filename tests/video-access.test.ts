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
