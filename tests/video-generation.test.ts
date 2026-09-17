import assert from 'node:assert/strict'
import test from 'node:test'

import type { NeonQueryFunction } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

import { saveGeneratedVideo } from '../src/modules/videos/server/services/legacy-generation-save'

const id = 'a4bde311-19f3-4d77-9c55-69a43f5c2168'
test('writeback uses one conditional UPDATE scoped to owner, video and the exact field baseline', async () => {
  for (const kind of ['title', 'description'] as const) {
    for (const expected of ['original', '', null]) {
      const calls: { sql: string; params: unknown[] }[] = []
      const client = (async (sql: string, params: unknown[]) => {
        calls.push({ sql, params })
        return { rows: [[id]] }
      }) as unknown as NeonQueryFunction<false, false>
      const result = await saveGeneratedVideo(drizzle(client), { videoId: id, userId: 'owner' }, kind, expected, 'generated')
      assert.equal(result.status, 'completed')
      assert.equal(calls.length, 1)
      const { sql, params } = calls[0]
      const [set, where] = sql.split(' where ')
      assert.match(set, new RegExp(`"${kind}" =`))
      assert.doesNotMatch(set, new RegExp(`"${kind === 'title' ? 'description' : 'title'}" =`))
      assert.match(set, /"updated_at" =/)
      assert.match(where, /"videos"\."id" =/)
      assert.match(where, /"videos"\."user_id" =/)
      assert.match(where, /"deletion_requested_at" is null/)
      assert.match(where, new RegExp(`"${kind}" ${expected === null ? 'is null' : '='}`))
      assert.ok(params.includes(id) && params.includes('owner') && params.includes('generated'))
      if (expected !== null) assert.equal(params.at(-1), expected)
    }
  }
})

test('no matched row is a conflict; database errors propagate instead of marking success', async () => {
  const empty = (async () => ({ rows: [] })) as unknown as NeonQueryFunction<false, false>
  assert.deepEqual(await saveGeneratedVideo(drizzle(empty), { videoId: id, userId: 'owner' }, 'title', 'old', 'new'), {
    status: 'conflict',
  })
  const broken = (async () => {
    throw new Error('offline')
  }) as unknown as NeonQueryFunction<false, false>
  await assert.rejects(saveGeneratedVideo(drizzle(broken), { videoId: id, userId: 'owner' }, 'title', 'old', 'new'))
})
