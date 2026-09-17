import assert from 'node:assert/strict'
import { test } from 'node:test'

import { completePlaybackRevocation } from '../src/lib/video-playback'

test('failed revocation never creates or publishes a replacement; retry still revokes the old ID', async () => {
  const calls: string[] = []
  let unavailable = true
  const provider = {
    revoke: async (id: string) => {
      calls.push(`revoke:${id}`)
      if (unavailable) throw new Error('Mux unavailable')
    },
    create: async () => {
      calls.push('create')
      return { id: 'new' }
    },
    commit: async (id: string) => {
      calls.push(`commit:${id}`)
      return true
    },
  }
  await assert.rejects(completePlaybackRevocation('old', provider), /Mux unavailable/)
  assert.deepEqual(calls, ['revoke:old'])
  unavailable = false
  await completePlaybackRevocation('old', provider)
  assert.deepEqual(calls, ['revoke:old', 'revoke:old', 'create', 'commit:new'])
})

test('retry recovers after revocation succeeded but replacement creation failed', async () => {
  let revoked = false
  let failCreation = true
  let published: string | null = null
  const provider = {
    revoke: async () => {
      if (revoked) throw { status: 404 }
      revoked = true
    },
    create: async () => {
      if (failCreation) throw new Error('creation failed')
      return { id: 'new' }
    },
    commit: async (id: string) => {
      published = id
      return true
    },
  }
  await assert.rejects(completePlaybackRevocation('old', provider), /creation failed/)
  assert.equal(published, null)
  failCreation = false
  await completePlaybackRevocation('old', provider)
  assert.equal(published, 'new')
})

test('concurrent retries only discard their own losing replacement', async () => {
  const revoked: string[] = []
  let published: string | null = null
  let next = 0
  const provider = {
    revoke: async (id: string) => {
      revoked.push(id)
    },
    create: async () => ({ id: `new-${++next}` }),
    commit: async (id: string) => {
      if (published) return false
      published = id
      return true
    },
  }
  await Promise.all([completePlaybackRevocation('old', provider), completePlaybackRevocation('old', provider)])
  assert.equal(published, 'new-1')
  assert.deepEqual(revoked, ['old', 'old', 'new-2'])
})

test('an ambiguous commit error must not revoke a possibly published replacement', async () => {
  const revoked: string[] = []
  await assert.rejects(
    completePlaybackRevocation('old', {
      revoke: async id => {
        revoked.push(id)
      },
      create: async () => ({ id: 'new' }),
      commit: async () => {
        throw new Error('connection lost after commit')
      },
    }),
    /connection lost/
  )
  assert.deepEqual(revoked, ['old'])
})
