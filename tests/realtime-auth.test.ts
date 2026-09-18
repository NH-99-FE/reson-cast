import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { test } from 'node:test'

import type { TokenRequest } from 'ably'

import { authorizeStudio } from '../src/lib/realtime/auth'
import { verifyDispatch } from '../src/lib/realtime/signature'

const url = 'https://example.test/api/realtime/dispatch'
function signed(body = '{}', key = 'current', target = url, expired = false) {
  const now = Math.floor(Date.now() / 1000)
  const data = [
    { alg: 'HS256', typ: 'JWT' },
    { iss: 'Upstash', sub: target, exp: now + (expired ? -30 : 60), body: createHash('sha256').update(body).digest('base64url') },
  ]
    .map(value => Buffer.from(JSON.stringify(value)).toString('base64url'))
    .join('.')
  return `${data}.${createHmac('sha256', key).update(data).digest('base64url')}`
}
const request = (signature: string, body = '{}') => new Request(url, { method: 'POST', body, headers: { 'upstash-signature': signature } })
test('dispatch verifies signature, both rotation keys, expiry, body and destination', async () => {
  assert.ok(await verifyDispatch(request(signed()), 'current', 'next', url))
  assert.ok(await verifyDispatch(request(signed('{}', 'next')), 'current', 'next', url))
  for (const req of [
    request('forged'),
    request(signed(), 'tampered'),
    request(signed('{}', 'current', 'https://other.test')),
    request(signed('{}', 'current', url, true)),
    new Request(url),
  ]) {
    assert.equal(await verifyDispatch(req, 'current', 'next', url), false)
  }
})
test('auth rejects guests, missing local users and forged capabilities; derives identity on each renewal', async () => {
  let clerk: string | null = null
  let local: string | undefined
  const calls: unknown[] = []
  const io = {
    clerkId: async () => clerk,
    userId: async () => local,
    sign: async (params: { clientId: string; ttl: number; capability: string }) => {
      calls.push(params)
      return { ...params, keyName: 'key', timestamp: Date.now(), nonce: 'nonce', mac: 'mac' } as TokenRequest
    },
  }
  const req = (body?: string) => new Request('https://example.test/api/realtime/auth', { method: 'POST', body })
  assert.equal((await authorizeStudio(req(), io)).status, 401)
  clerk = 'clerk-user'
  assert.equal((await authorizeStudio(req(), io)).status, 401)
  local = 'owner'
  assert.equal((await authorizeStudio(req('{"clientId":"victim","capability":{"*":["publish"]}}'), io)).status, 400)
  assert.equal(calls.length, 0)
  const result = await authorizeStudio(req(), io)
  assert.equal(result.headers.get('cache-control'), 'no-store')
  assert.deepEqual(calls[0], { clientId: 'owner', ttl: 600000, capability: '{"studio:user:owner":["subscribe"]}' })
  local = 'new-owner'
  await authorizeStudio(req(), io)
  assert.equal((calls[1] as { clientId: string }).clientId, 'new-owner')
})
