import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createOutboxSchedule } from '../src/lib/realtime/schedule'

test('production scanner retains its ID, ten-minute interval and no retries', () => {
  assert.deepEqual(createOutboxSchedule('production', 'https://reson-cast.vercel.app/'), {
    destination: 'https://reson-cast.vercel.app/api/realtime/dispatch',
    cron: '*/10 * * * *',
    scheduleId: 'studio-realtime-outbox',
    retries: 0,
  })
})

test('development scanner cannot overwrite production even in the same QStash account', () => {
  const dev = createOutboxSchedule('development', 'https://example.ngrok-free.app')
  const prod = createOutboxSchedule('production', 'https://reson-cast.vercel.app')
  assert.equal(dev.destination, 'https://example.ngrok-free.app/api/realtime/dispatch')
  assert.equal(dev.scheduleId, 'studio-realtime-outbox-development')
  assert.notEqual(dev.scheduleId, prod.scheduleId)
  assert.equal(dev.retries, 0)
})

test('an explicit environment is required before configuring any cloud schedule', () => {
  for (const environment of [undefined, '', 'preview', 'prod']) {
    assert.throws(() => createOutboxSchedule(environment, 'https://reson-cast.vercel.app'), /Specify the scanner environment/)
  }
})

test('production rejects development tunnel and loopback destinations', () => {
  for (const base of [
    'https://example.ngrok-free.app',
    'https://example.ngrok-free.dev',
    'https://example.ngrok.app',
    'https://example.ngrok.io',
    'https://localhost:3000',
    'https://127.0.0.1:3000',
    'https://[::1]:3000',
  ]) {
    assert.throws(() => createOutboxSchedule('production', base), /Production scanner must target the deployed application/)
  }
})

test('scanner destination requires an HTTPS origin without credentials or extra URL components', () => {
  assert.throws(() => createOutboxSchedule('production', undefined), /Configure UPSTASH_WORKFLOW_URL/)
  for (const base of [
    'http://example.com',
    'https://user:password@example.com',
    'https://example.com/path',
    'https://example.com?token=test',
    'https://example.com#fragment',
  ]) {
    assert.throws(() => createOutboxSchedule('production', base), /must be an HTTPS origin/)
  }
})
