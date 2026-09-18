import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

import { Realtime, Rest } from 'ably'
import { config } from 'dotenv'

import { studioCapability, studioChannel } from '../src/lib/realtime/events'
import { signRealtimeToken } from '../src/lib/realtime/token'

config({ quiet: true })

async function verify() {
  const key = process.env.ABLY_API_KEY
  if (!key) throw new Error('ABLY_API_KEY is required')
  const clientId = `auth-test-${randomUUID()}`
  const channelName = studioChannel(clientId)
  let issuedCount = 0
  let firstExpiry = 0
  let latestExpiry = 0
  // Suppress SDK logs: failures below report only status/code, never credentials.
  const client = new Realtime({
    autoConnect: false,
    logHandler: () => {},
    authCallback: (_params, callback) => {
      void signRealtimeToken(key, {
        clientId,
        ttl: issuedCount === 0 ? 60_000 : 600_000,
        capability: JSON.stringify(studioCapability(clientId)),
      }).then(
        token => {
          issuedCount++
          latestExpiry = token.expires
          if (issuedCount === 1) firstExpiry = token.expires
          callback(null, token)
        },
        () => callback('Signing failed', null)
      )
    },
  })
  const publisher = new Rest({ key, logHandler: () => {}, httpRequestTimeout: 10_000, httpMaxRetryCount: 0 })
  const channel = client.channels.get(channelName)
  const received = new Set<string>()
  let connectedOnce = false
  let interrupted = false
  let renewalConfirmed = false
  client.connection.on(change => {
    if (change.current === 'connected') {
      connectedOnce = true
      if (issuedCount >= 2 && latestExpiry > firstExpiry) renewalConfirmed = true
    } else if (connectedOnce) interrupted = true
  })
  const waitFor = async (predicate: () => boolean, label: string, timeout = 20_000) => {
    const deadline = Date.now() + timeout
    while (!predicate()) {
      if (client.connection.state === 'failed') throw new Error(`Connection failed (${client.connection.errorReason?.code})`)
      if (Date.now() >= deadline) throw new Error(`Timed out: ${label}`)
      await delay(100)
    }
  }
  try {
    client.connect()
    await waitFor(() => client.connection.state === 'connected', 'initial connection')
    await channel.subscribe(message => received.add(message.data))
    await publisher.channels.get(channelName).publish('auth-test', 'before-renewal')
    await waitFor(() => received.has('before-renewal'), 'initial message')
    console.log('PASS: real Ably JWT authentication, channel attachment and message delivery')

    await assert.rejects(channel.publish('auth-test', 'forbidden'), (error: { code?: number }) => error.code === 40160)
    await assert.rejects(client.channels.get(`${channelName}-other`).attach(), (error: { code?: number }) => error.code === 40160)
    console.log('PASS: publish and other-channel access denied for subscriber token')
    console.log('Waiting for natural token expiry and SDK renewal (about 60 seconds)…')

    // No requestToken()/authorize(): renewal must be initiated by the SDK/service.
    await waitFor(() => renewalConfirmed && Date.now() > firstExpiry + 2_000, 'automatic renewal past original expiry', 100_000)
    assert.equal(interrupted, false, 'Connection must stay connected during renewal')
    assert.equal(channel.state, 'attached')
    await publisher.channels.get(channelName).publish('auth-test', 'after-renewal')
    await waitFor(() => received.has('after-renewal'), 'message after original expiry')
    console.log('PASS: automatic renewal accepted; subscription receives messages after original JWT expires')
  } finally {
    channel.unsubscribe()
    client.close()
  }
}

// Bound all network operations, including subscribe/publish, without dumping token-bearing errors.
const watchdog = setTimeout(() => {
  console.error('FAIL: integration check exceeded 150 seconds')
  process.exit(1)
}, 150_000)
try {
  await verify()
} catch (error) {
  const failure = error as { code?: number; statusCode?: number; message?: string }
  console.error(
    'FAIL:',
    failure.code ? `Ably code ${failure.code}, HTTP ${failure.statusCode}` : failure.message?.replace(/eyJ[\w.-]+/g, '[redacted]')
  )
  process.exitCode = 1
} finally {
  clearTimeout(watchdog)
}
