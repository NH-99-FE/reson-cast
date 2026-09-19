import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { after, test } from 'node:test'

import { neonConfig } from '@neondatabase/serverless'

import { POST } from '../src/app/api/videos/maintenance/generation-jobs/route'
import { createCleanupExecutor } from '../src/modules/videos/server/services/generation-cleanup'
import { generationCleanupPreview } from '../src/modules/videos/server/services/generation-cleanup-queries'

const savedEnv = { ...process.env }
const savedFetch = neonConfig.fetchFunction
after(() => {
  process.env = savedEnv
  neonConfig.fetchFunction = savedFetch
})
const url = 'https://example.test/api/videos/maintenance/generation-jobs'
function request({ body = '{}', key = 'current', target = url, expired = false } = {}) {
  const claims = {
    iss: 'Upstash',
    sub: target,
    exp: Math.floor(Date.now() / 1000) + (expired ? -60 : 60),
    body: createHash('sha256').update(body).digest('base64url'),
  }
  const data = [{ alg: 'HS256' }, claims].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.')
  const signature = `${data}.${createHmac('sha256', key).update(data).digest('base64url')}`
  return new Request(url, { method: 'POST', body, headers: { 'upstash-signature': signature } })
}
function configure() {
  process.env.DATABASE_URL = 'postgresql://test:test@database.example.test/test'
  process.env.UPSTASH_WORKFLOW_URL = 'https://example.test'
  process.env.QSTASH_CURRENT_SIGNING_KEY = 'current'
  process.env.QSTASH_NEXT_SIGNING_KEY = 'next'
  process.env.GENERATION_JOB_RETENTION_DAYS = '30'
}

test('maintenance fails closed before any database access for invalid signatures/configuration', async () => {
  configure()
  let calls = 0
  neonConfig.fetchFunction = async () => {
    calls++
    throw new Error('must not reach database')
  }
  for (const req of [
    new Request(url, { method: 'POST' }),
    request({ key: 'forged' }),
    request({ target: 'https://other.test' }),
    request({ expired: true }),
  ]) {
    assert.equal((await POST(req)).status, 401)
  }
  delete process.env.QSTASH_NEXT_SIGNING_KEY
  assert.equal((await POST(request())).status, 503)
  configure()
  process.env.GENERATION_JOB_RETENTION_DAYS = '0'
  assert.equal((await POST(request())).status, 503)
  assert.equal(calls, 0)
})

test('signed requests use bounded Neon transactions and ignore request-supplied retention', async () => {
  configure()
  const batches: { queries: { query: string; params: unknown[] }[]; readOnly: string | null }[] = []
  neonConfig.fetchFunction = async (_url: unknown, options?: RequestInit) => {
    const { queries } = JSON.parse(String(options?.body)) as { queries: { query: string; params: unknown[] }[] }
    const headers = new Headers(options?.headers)
    const readOnly = headers.get('Neon-Batch-Read-Only')
    batches.push({ queries, readOnly })
    assert.ok(options?.signal)
    assert.equal(queries.length, 2)
    assert.match(queries[0].query, /set_config\('statement_timeout'/)
    assert.match(queries[0].query, /set_config\('lock_timeout', '500ms', true\)/)
    assert.deepEqual(queries[0].params, ['5000ms'])
    assert.equal(headers.get('Neon-Batch-Isolation-Level'), 'ReadCommitted')
    return Response.json({
      results: [
        { fields: [], rows: [] },
        { fields: [], rows: readOnly === 'true' ? [[]] : [] },
      ],
    })
  }
  for (const key of ['current', 'next']) {
    const response = await POST(request({ key, body: '{"retentionDays":0,"batchSize":999999}' }))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const body = await response.json()
    assert.equal(body.retentionDays, 30)
    assert.equal(body.deleted, 0)
    assert.equal(body.stopReason, 'no_unlocked_candidates')
  }
  assert.deepEqual(
    batches.map(batch => batch.readOnly),
    ['true', 'false', 'true', 'false']
  )
  assert.ok(batches.filter(batch => batch.readOnly === 'false').every(batch => batch.queries[1].params.includes('500')))
})

test('database failures return a retriable error without exposing provider details', async () => {
  configure()
  neonConfig.fetchFunction = async () => {
    throw new Error('private-provider-detail')
  }
  const response = await POST(request())
  assert.equal(response.status, 503)
  assert.doesNotMatch(await response.text(), /private-provider-detail/)
})

test('Neon decoding preserves text counts and nullable Date values declared by cleanup queries', async () => {
  configure()
  for (const timestamp of ['2026-01-02 00:00:00', null]) {
    neonConfig.fetchFunction = async () =>
      Response.json({
        results: [
          { fields: [], rows: [] },
          {
            fields: [
              { name: 'eligible', dataTypeID: 25 },
              { name: 'oldest_finished_at', dataTypeID: 1114 },
            ],
            rows: [['9007199254740993', timestamp]],
          },
        ],
      })
    const [row] = await createCleanupExecutor()(generationCleanupPreview('2026-08-20T00:00:00Z'), true)
    assert.equal(row.eligible, '9007199254740993', 'counts must not lose precision through number conversion')
    if (timestamp === null) assert.equal(row.oldest_finished_at, null)
    else {
      assert.ok(row.oldest_finished_at instanceof Date)
      assert.equal(JSON.parse(JSON.stringify(row)).oldest_finished_at, row.oldest_finished_at.toISOString())
    }
  }
})
