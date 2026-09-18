import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { test } from 'node:test'

import { Rest } from 'ably'

import { authorizeStudio } from '../src/lib/realtime/auth'
import { verifyDispatch } from '../src/lib/realtime/signature'
import { signRealtimeToken } from '../src/lib/realtime/token'

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
      return signRealtimeToken('app.key:secret', params)
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

test('realtime JWT is signed locally with scoped claims and matching SDK expiry', async () => {
  const params = { clientId: 'owner', ttl: 600000, capability: '{"studio:user:owner":["subscribe"]}' }
  const result = await signRealtimeToken('app.key:secret', params, 1700000000123)
  const [header, payload, signature] = result.token.split('.')
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), { typ: 'JWT', alg: 'HS256', kid: 'app.key' })
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url').toString()), {
    iat: 1700000000,
    exp: 1700000600,
    'x-ably-clientId': params.clientId,
    'x-ably-capability': params.capability,
  })
  assert.equal(signature, createHmac('sha256', 'secret').update(`${header}.${payload}`).digest('base64url'))
  assert.equal(result.issued, 1700000000000)
  assert.equal(result.expires, 1700000600000)
  assert.equal(result.clientId, params.clientId)
  assert.equal(result.capability, params.capability)
  for (const key of [undefined, '', 'missing-secret', ':secret', 'app.key:']) {
    await assert.rejects(() => signRealtimeToken(key, params), /Ably is not configured/)
  }
})

test('Ably SDK accepts signed token details directly on initial auth and renewal', async () => {
  let renewals = 0
  const client = new Rest({
    authCallback: (_params, callback) => {
      renewals++
      void signRealtimeToken('app.key:secret', {
        clientId: 'owner',
        ttl: 600000,
        capability: '{"studio:user:owner":["subscribe"]}',
      }).then(
        token => callback(null, token),
        () => callback('Signing failed', null)
      )
    },
  })
  // Any attempted token exchange would fail: this key does not exist at Ably.
  for (let i = 0; i < 2; i++) {
    const token = await client.auth.requestToken()
    assert.equal(token.clientId, 'owner')
    assert.equal(token.expires - token.issued, 600000)
    assert.equal(token.token.split('.').length, 3)
  }
  assert.equal(renewals, 2)
})
