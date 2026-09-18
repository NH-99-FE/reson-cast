import assert from 'node:assert/strict'
import { test } from 'node:test'

import { matchesStudioQuery } from '../src/lib/realtime/cache'
import { studioCapability, type StudioEvent, studioEventSchema } from '../src/lib/realtime/events'

const id = '00000000-0000-4000-8000-000000000001'
const event: StudioEvent = { id, videoId: id, jobId: id, kind: 'title', type: 'generation.changed', version: 1 }
const query = (path: string, videoId = id, kind = 'title') => ({ queryKey: [path.split('.'), { input: { id: videoId, kind } }] })
test('cache mapping is scoped to studio and affected video/kind', () => {
  assert.ok(matchesStudioQuery(query('studio.getMany'), [event]))
  assert.ok(matchesStudioQuery(query('studio.getOne'), [event]))
  assert.ok(matchesStudioQuery(query('videos.getGenerationStatus'), [event]))
  assert.ok(!matchesStudioQuery(query('videos.getGenerationStatus', id, 'description'), [event]))
  assert.ok(!matchesStudioQuery(query('studio.getOne', 'other'), [event]))
  assert.ok(!matchesStudioQuery(query('videos.getPlayback'), [event]))
  assert.ok(matchesStudioQuery(query('videos.getGenerationStatus', id, 'description')))
})
test('capability grants only own studio subscription; invalid events are rejected', () => {
  assert.deepEqual(studioCapability(id), { [`studio:user:${id}`]: ['subscribe'] })
  assert.equal(studioEventSchema.safeParse({ ...event, version: 2 }).success, false)
  assert.equal(studioEventSchema.safeParse({ ...event, kind: null }).success, false)
})

test('event refresh cancels a stale initial response and only fetches active studio queries', async () => {
  const { QueryClient, QueryObserver } = await import('@tanstack/react-query')
  const { refreshStudioQueries } = await import('../src/lib/realtime/cache')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let resolveOld!: (value: string) => void
  let calls = 0
  const key = query('studio.getOne').queryKey
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: () => {
      calls++
      return calls === 1
        ? new Promise<string>(resolve => {
            resolveOld = resolve
          })
        : Promise.resolve('current')
    },
  })
  const stop = observer.subscribe(() => {})
  try {
    await refreshStudioQueries(client, [event])
    resolveOld('stale')
    await Promise.resolve()
    assert.equal(client.getQueryData(key), 'current')
    assert.equal(calls, 2)
  } finally {
    stop()
    client.clear()
  }
})
