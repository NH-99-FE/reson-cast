import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { setTimeout } from 'node:timers/promises'

import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { Client } from 'pg'

import { generationCleanupPolicy } from '../../src/modules/videos/server/services/generation-cleanup'
import { deleteGenerationBatch } from '../../src/modules/videos/server/services/generation-cleanup-queries'
import { finishTextGenerationQuery } from '../../src/modules/videos/server/services/generation-queries'
import { replaceThumbnailQuery } from '../../src/modules/videos/server/services/thumbnail-queries'
import { cleanupOwner as owner, cleanupVideo as video, installCleanupFixture } from '../helpers/generation-cleanup-db'

// Explicit opt-in database; never fall back to DATABASE_URL or load .env.
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database')
const clients = Array.from({ length: 3 }, () => new Client({ connectionString: process.env.TEST_DATABASE_URL }))
const [first, second, observer] = clients
const schema = `cleanup_test_${randomUUID().replaceAll('-', '')}`
const dialect = new PgDialect()
const policy = generationCleanupPolicy('30', new Date('2026-09-19T00:00:00Z'))
const batch = deleteGenerationBatch(policy.cutoff)
let created = false
async function execute(client: Client, query: SQL) {
  const compiled = dialect.sqlToQuery(query)
  return (await client.query(compiled.sql, compiled.params)).rows as Record<string, unknown>[]
}
before(async () => {
  await Promise.all(clients.map(client => client.connect()))
  await first.query(`CREATE SCHEMA "${schema}"`)
  created = true
  for (const client of clients) {
    await client.query(`SET search_path TO "${schema}"`)
    await client.query("SET statement_timeout='5s'")
  }
  await installCleanupFixture(query => first.query(query))
})
after(async () => {
  await Promise.allSettled(clients.map(client => client.query('ROLLBACK')))
  if (created) await first.query(`DROP SCHEMA "${schema}" CASCADE`)
  await Promise.allSettled(clients.map(client => client.end()))
})
async function seed(count = 3, kind = 'title') {
  await first.query('TRUNCATE video_generation_jobs, video_file_cleanup, realtime_outbox')
  await first.query(
    `INSERT INTO video_generation_jobs(video_id,user_id,kind,status,workflow_run_id,created_at,finished_at,expected_value,result)
    SELECT $1,$2,$3,'completed','bulk-' || n,'2026-01-01'::timestamp + n * interval '1 second',
      '2026-01-02','Original','Stored' FROM generate_series(1,$4::integer) n`,
    [video, owner, kind, count]
  )
  return (await first.query<{ id: string }>('SELECT id FROM video_generation_jobs ORDER BY created_at')).rows.map(row => row.id)
}
async function waitForLock(client: Client) {
  const pid = (await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid
  return async () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const { rows } = await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])
      if (rows[0]?.wait_event_type === 'Lock') return
      await setTimeout(10)
    }
    assert.fail('callback did not reach the expected row lock')
  }
}

test('two simultaneous cleaners claim disjoint bounded batches and preserve latest', async () => {
  const ids = await seed(1002)
  await first.query('BEGIN')
  await second.query('BEGIN')
  try {
    const a = await execute(first, batch)
    const b = await execute(second, batch)
    assert.equal(a.length, 500)
    assert.equal(b.length, 500)
    assert.equal(new Set([...a, ...b].map(row => row.id)).size, 1000)
    await second.query('COMMIT')
    await first.query('COMMIT')
  } finally {
    await first.query('ROLLBACK')
    await second.query('ROLLBACK')
  }
  assert.equal((await execute(first, batch)).length, 1)
  assert.deepEqual((await first.query('SELECT id FROM video_generation_jobs')).rows, [{ id: ids.at(-1) }])
  assert.equal((await execute(first, batch)).length, 0)
})

test('cleaner skips the terminal task locked by a callback and deletes it on a later run', async () => {
  const [old] = await seed()
  await first.query('BEGIN')
  try {
    await execute(first, finishTextGenerationQuery(old, 'title', 'Late'))
    const deleted = await execute(second, batch)
    assert.equal(deleted.length, 1)
    assert.notEqual(deleted[0].id, old)
    assert.deepEqual(await execute(second, batch), [], 'zero unlocked candidates is not an empty backlog')
  } finally {
    await first.query('ROLLBACK')
  }
  assert.deepEqual(await execute(second, batch), [{ id: old }])
})

test('text and thumbnail callbacks waiting behind a committed deletion cannot write', async () => {
  for (const kind of ['title', 'thumbnail'] as const) {
    const [old] = await seed(2, kind)
    const blocked = await waitForLock(second)
    await first.query('BEGIN')
    let pending: Promise<Record<string, unknown>[]> | undefined
    try {
      await execute(first, batch)
      pending = execute(
        second,
        kind === 'title'
          ? finishTextGenerationQuery(old, 'title', 'Late')
          : replaceThumbnailQuery({ videoId: video, userId: owner, expectedKey: 'current-file', newKey: 'late-file', jobId: old })
      )
      await blocked()
      await first.query('COMMIT')
      const result = await pending
      if (kind === 'title') assert.deepEqual(result, [])
      else {
        assert.equal(result[0].attached, false)
        assert.deepEqual((await first.query('SELECT key FROM video_file_cleanup')).rows, [{ key: 'late-file' }])
      }
      assert.deepEqual((await first.query('SELECT title,thumbnail_key FROM videos')).rows, [
        { title: 'Original', thumbnail_key: 'current-file' },
      ])
    } finally {
      await first.query('ROLLBACK')
      await pending
    }
  }
})

test('an uncommitted newer task cannot make the visible latest task eligible', async () => {
  const [latest] = await seed(1)
  await first.query('BEGIN')
  try {
    await first.query(
      `INSERT INTO video_generation_jobs(video_id,user_id,kind,workflow_run_id,created_at)
      VALUES($1,$2,'title','new-active','2026-02-01')`,
      [video, owner]
    )
    assert.deepEqual(await execute(second, batch), [])
    await first.query('COMMIT')
    assert.deepEqual(await execute(second, batch), [{ id: latest }])
  } finally {
    await first.query('ROLLBACK')
  }
})
