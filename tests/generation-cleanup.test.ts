import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'

import { PGlite } from '@electric-sql/pglite'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import {
  type CleanupExecutor,
  GenerationCleanupError,
  generationCleanupPolicy,
  previewGenerationCleanup,
  runGenerationCleanup,
} from '../src/modules/videos/server/services/generation-cleanup'
import { deleteGenerationBatch } from '../src/modules/videos/server/services/generation-cleanup-queries'
import { createGenerationCleanupSchedule } from '../src/modules/videos/server/services/generation-cleanup-schedule'
import { finishTextGenerationQuery } from '../src/modules/videos/server/services/generation-queries'
import { replaceThumbnailQuery } from '../src/modules/videos/server/services/thumbnail-queries'
import { cleanupOwner as owner, cleanupVideo as video, installCleanupFixture } from './helpers/generation-cleanup-db'

const pg = new PGlite()
const dialect = new PgDialect()
const policy = generationCleanupPolicy('30', new Date('2026-09-19T00:00:00Z'))
async function execute<Row>(query: SQL<Row>) {
  const compiled = dialect.sqlToQuery(query)
  return (await pg.query<Row>(compiled.sql, compiled.params)).rows
}
before(() => installCleanupFixture(query => pg.exec(query)))
after(() => pg.close())

async function reset() {
  await pg.exec('TRUNCATE video_generation_jobs, video_file_cleanup, realtime_outbox')
  await pg.exec("UPDATE videos SET title='Original', thumbnail_key='current-file'")
}
async function job({
  id = randomUUID(),
  kind = 'title',
  status = 'completed',
  created = '2026-01-01',
  finished = '2026-01-02',
}: { id?: string; kind?: string; status?: string; created?: string; finished?: string | null } = {}) {
  await pg.query(
    `INSERT INTO video_generation_jobs
    (id,video_id,user_id,kind,status,workflow_run_id,created_at,finished_at,result)
    VALUES ($1::uuid,$2,$3,$4,$5,$1::text,$6,$7,'retained result')`,
    [id, video, owner, kind, status, created, finished]
  )
  return id
}

test('retention accepts only positive integer days and freezes an exact UTC cutoff', () => {
  assert.equal(generationCleanupPolicy('30', new Date('2026-09-19T08:00:00+08:00')).cutoff, policy.cutoff)
  for (const value of ['', '0', '-1', '1.5', '30days', ' 30 ', 'NaN', 'Infinity', '999999999999999999999']) {
    assert.throws(() => generationCleanupPolicy(value))
  }
})

test('preview is read-only; pruning removes only expired historical terminal tasks', async () => {
  await reset()
  const removed = []
  for (const status of ['completed', 'failed', 'conflict']) removed.push(await job({ status }))
  const kept = [
    await job({ finished: null }),
    await job({ finished: policy.cutoff }), // strict boundary, not <=
    await job({ finished: '2026-09-18' }),
    await job({ created: '2026-02-01', status: 'conflict' }), // latest, still expired
    await job({ kind: 'description', status: 'running', finished: null }),
    await job({ kind: 'thumbnail', status: 'queued', finished: null }),
  ]
  // Active records remain protected even with an anomalous completion timestamp.
  kept.push(await job({ kind: 'description', created: '2026-02-01' }))
  await pg.exec("UPDATE video_generation_jobs SET finished_at='2026-01-02' WHERE status='running'")
  const readonlyExecute: CleanupExecutor = async (query, readOnly) => {
    assert.equal(readOnly, true)
    return execute(query)
  }
  const preview = await previewGenerationCleanup(readonlyExecute, policy, true)
  assert.equal(preview.eligible, '3')
  assert.ok(preview.oldestFinishedAt instanceof Date)
  assert.ok(preview.health.oldest_stale_at instanceof Date)
  assert.ok(preview.sample.every(row => row.created_at instanceof Date && row.finished_at instanceof Date))
  assert.deepEqual(preview.sample.map(row => row.id).sort(), removed.sort())
  assert.ok(preview.sample.every(row => row.video_id === video && row.kind === 'title'))
  assert.deepEqual(preview.sample.map(row => row.status).sort(), ['completed', 'conflict', 'failed'])
  const serialized = JSON.parse(JSON.stringify(preview))
  assert.equal(serialized.oldestFinishedAt, preview.oldestFinishedAt.toISOString())
  assert.equal(serialized.health.oldest_stale_at, preview.health.oldest_stale_at.toISOString())
  assert.ok(preview.plans)
  assert.equal((await pg.query('SELECT id FROM video_generation_jobs')).rows.length, kept.length + removed.length)
  assert.equal(preview.health.stale_queued, '1')
  assert.equal(preview.health.stale_running, '1')
  assert.equal(preview.health.missing_finished_at, '1')
  await pg.exec('TRUNCATE realtime_outbox')
  const result = await runGenerationCleanup(execute, policy)
  assert.equal(result.deleted, removed.length)
  assert.equal(result.stopReason, 'no_unlocked_candidates')
  assert.deepEqual((await pg.query<{ id: string }>('SELECT id FROM video_generation_jobs')).rows.map(row => row.id).sort(), kept.sort())
  assert.equal((await pg.query('SELECT id FROM realtime_outbox')).rows.length, 0, 'maintenance must not emit business events')
  assert.equal((await runGenerationCleanup(execute, policy)).deleted, 0)
  const empty = await previewGenerationCleanup(execute, policy)
  assert.equal(empty.eligible, '0')
  assert.equal(empty.oldestFinishedAt, null)
  assert.deepEqual(empty.sample, [])
})

test('UUID tie-break matches latest-task ordering and latest is evaluated across all statuses', async () => {
  await reset()
  const low = '00000000-0000-4000-8000-000000000010'
  const high = '00000000-0000-4000-8000-000000000020'
  await job({ id: low })
  await job({ id: high, status: 'running', finished: null })
  assert.deepEqual(await execute(deleteGenerationBatch(policy.cutoff)), [{ id: low }])
  assert.equal((await pg.query('SELECT id FROM video_generation_jobs')).rows.length, 1)
})

test('one run commits at most ten batches of 500 and another run drains the remainder', async () => {
  await reset()
  await pg.query(
    `INSERT INTO video_generation_jobs(video_id,user_id,kind,status,workflow_run_id,created_at,finished_at)
    SELECT $1,$2,'title','completed','bulk-' || n,'2026-01-01'::timestamp + n * interval '1 second','2026-01-02'
    FROM generate_series(1, 5002) n`,
    [video, owner]
  )
  const result = await runGenerationCleanup(execute, policy)
  assert.equal(result.deleted, 5000)
  assert.equal(result.batches, 10)
  assert.equal(result.stopReason, 'batch_limit')
  assert.equal((await runGenerationCleanup(execute, policy)).deleted, 1)
  assert.equal((await pg.query('SELECT id FROM video_generation_jobs')).rows.length, 1)
})

test('time budget stops new work, and errors preserve acknowledged progress for safe retries', async () => {
  await reset()
  await job()
  await job({ created: '2026-02-01' })
  let time = 0
  let writes = 0
  const slow: CleanupExecutor = async (query, readOnly) => {
    const rows = await execute(query)
    if (!readOnly) {
      writes++
      time += 32_000
    }
    return rows
  }
  const timed = await runGenerationCleanup(slow, policy, () => time)
  assert.equal(timed.stopReason, 'time_budget')
  assert.equal(writes, 1)
  await job()
  const broken: CleanupExecutor = async (query, readOnly) => {
    if (!readOnly && writes++ > 1) throw new Error('connection lost')
    return execute(query)
  }
  await assert.rejects(runGenerationCleanup(broken, policy), error => {
    assert.ok(error instanceof GenerationCleanupError)
    assert.deepEqual(error.progress, { deleted: 1, batches: 1 })
    return true
  })
})

test('callbacks after pruning cannot overwrite text, resurrect jobs or attach orphaned thumbnails', async () => {
  await reset()
  const text = await job()
  const thumbnail = await job({ kind: 'thumbnail' })
  await job({ created: '2026-02-01' })
  await job({ kind: 'thumbnail', created: '2026-02-01' })
  assert.equal((await runGenerationCleanup(execute, policy)).deleted, 2)
  assert.deepEqual(await execute(finishTextGenerationQuery(text, 'title', 'Late result')), [])
  const input = { videoId: video, userId: owner, expectedKey: 'current-file', newKey: 'orphan', jobId: thumbnail }
  assert.deepEqual(await execute(replaceThumbnailQuery(input)), [{ attached: false, status: null }])
  await execute(replaceThumbnailQuery(input))
  assert.deepEqual((await pg.query('SELECT key FROM video_file_cleanup')).rows, [{ key: 'orphan' }])
  await execute(replaceThumbnailQuery({ ...input, newKey: 'current-file' }))
  assert.deepEqual((await pg.query('SELECT key FROM video_file_cleanup')).rows, [{ key: 'orphan' }], 'current file must never be queued')
  assert.deepEqual((await pg.query('SELECT title,thumbnail_key FROM videos')).rows, [{ title: 'Original', thumbnail_key: 'current-file' }])
  assert.equal((await pg.query('SELECT id FROM video_generation_jobs')).rows.length, 2)
})

test('maintenance schedule has stable isolated IDs and validates the destination', () => {
  const prod = createGenerationCleanupSchedule('production', 'https://example.test/')
  const dev = createGenerationCleanupSchedule('development', 'https://test.ngrok-free.app')
  assert.equal(prod.scheduleId, 'video-generation-cleanup-production')
  assert.equal(dev.scheduleId, 'video-generation-cleanup-development')
  assert.equal(prod.destination, 'https://example.test/api/videos/maintenance/generation-jobs')
  assert.equal(prod.cron, '15 3 * * *')
  assert.equal(prod.retries, 0)
  assert.throws(() => createGenerationCleanupSchedule(undefined, 'https://example.test'))
  assert.throws(() => createGenerationCleanupSchedule('production', 'https://test.ngrok-free.app'))
  assert.throws(() => createGenerationCleanupSchedule('production', 'https://user:pass@example.test'))
})
