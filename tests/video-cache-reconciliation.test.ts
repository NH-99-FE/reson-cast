import assert from 'node:assert/strict'
import { test } from 'node:test'

import { QueryObserver } from '@tanstack/react-query'
import { createTRPCReact, getQueryKey } from '@trpc/react-query'

import { makeQueryClient } from '../src/trpc/query-client'
import type { AppRouter } from '../src/trpc/routers/_app'

const trpc = createTRPCReact<AppRouter>()

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>(done => {
    resolve = done
  })
  return { promise, resolve }
}

for (const fail of [false, true]) {
  test(`overlapping onSettled callbacks reconcile once after both finish (failure=${fail})`, async () => {
    const client = makeQueryClient()
    const key = getQueryKey(trpc.videos.getOne, { id: 'video' }, 'query')
    let reads = 0
    const observer = new QueryObserver(client, {
      queryKey: key,
      initialData: 'optimistic',
      staleTime: Infinity,
      queryFn: async () => {
        reads++
        return 'server'
      },
    })
    const unsubscribe = observer.subscribe(() => {})
    const gates = [deferred(), deferred()]
    const entered = [deferred(), deferred()]
    const mutations = gates.map((gate, i) =>
      client.getMutationCache().build(client, {
        meta: { videoInteraction: 'video' },
        mutationFn: async () => {
          if (fail && i === 1) throw new Error('failed')
        },
        onSettled: () => {
          entered[i].resolve()
          return gate.promise
        },
      })
    )
    try {
      const results = mutations.map(mutation => mutation.execute(undefined).catch(() => {}))
      await Promise.all(entered.map(item => item.promise))
      assert.equal(client.isMutating(), 2)
      gates[0].resolve()
      await results[0]
      assert.equal(reads, 0, 'must preserve the remaining optimistic operation')
      gates[1].resolve()
      await results[1]
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(client.isMutating(), 0)
      assert.equal(reads, 1)
      assert.equal(client.getQueryData(key), 'server')
    } finally {
      unsubscribe()
      client.clear()
    }
  })
}

test('single operations reconcile independently by video ID and ignore untagged mutations', async () => {
  const client = makeQueryClient()
  const keys = ['a', 'b'].map(id => getQueryKey(trpc.videos.getOne, { id }, 'query'))
  keys.forEach(key => client.setQueryData(key, 'cached'))
  const gate = deferred()
  const pending = client
    .getMutationCache()
    .build(client, {
      meta: { videoInteraction: 'b' },
      mutationFn: () => gate.promise,
    })
    .execute(undefined)
  try {
    await client
      .getMutationCache()
      .build(client, { mutationFn: async () => {} })
      .execute(undefined)
    assert.equal(client.getQueryState(keys[0])?.isInvalidated, false)
    await client
      .getMutationCache()
      .build(client, {
        meta: { videoInteraction: 'a' },
        mutationFn: async () => {},
      })
      .execute(undefined)
    assert.equal(client.getQueryState(keys[0])?.isInvalidated, true)
    assert.equal(client.getQueryState(keys[1])?.isInvalidated, false)
    gate.resolve()
    await pending
    assert.equal(client.getQueryState(keys[1])?.isInvalidated, true)
  } finally {
    gate.resolve()
    await pending
    client.clear()
  }
})
