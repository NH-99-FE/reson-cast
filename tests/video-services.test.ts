import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, mock, test } from 'node:test'

import { PGlite } from '@electric-sql/pglite'
import type { SQL } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test'
process.env.MUX_TOKEN_ID = 'test'
process.env.MUX_TOKEN_SECRET = 'test'
process.env.QSTASH_TOKEN = 'test'
process.env.UPLOADTHING_TOKEN = ''
process.env.API_KEY = 'test'
process.env.UPSTASH_WORKFLOW_URL = 'https://example.test'
const { db } = await import('../src/db')
const { videos } = await import('../src/db/schema')
const { workflow } = await import('../src/lib/workflow')
const { mux } = await import('../src/lib/mux')
const { startVideoGeneration, retryVideoGeneration, beginGeneration, finishTextGeneration, getGenerationJob, failGeneration } =
  await import('../src/modules/videos/server/services/generation')
const { restoreVideoThumbnail, cleanupVideoFiles, pendingFileCleanup } = await import('../src/modules/videos/server/services/thumbnails')
const { updateVideo, resumePlaybackRevocation } = await import('../src/modules/videos/server/services/update')
const { generationCleanupPolicy, runGenerationCleanup } = await import('../src/modules/videos/server/services/generation-cleanup')
const pg = new PGlite()
const owner = '00000000-0000-4000-8000-000000000001'
const videoId = '00000000-0000-4000-8000-000000000002'

before(async () => {
  await pg.exec('CREATE TABLE users(id uuid PRIMARY KEY)')
  // Build the fixture table from real column types; no production DB or credentials.
  const columns = getTableConfig(videos).columns.map(
    column => `"${column.name}" ${column.getSQLType() === 'video_visibility' ? 'text' : column.getSQLType()}`
  )
  await pg.exec(`CREATE TABLE videos (${columns.join(',')}, PRIMARY KEY(id))`)
  await pg.exec(await readFile(new URL('../scripts/sql/add-video-generation-jobs.sql', import.meta.url), 'utf8'))
  mock.method(db.$client, 'query', async (sql: string, params: unknown[], options: { arrayMode?: boolean }) => {
    const result = await pg.query<Record<string, unknown>>(sql, params)
    const normalize = (value: unknown) => (value instanceof Date ? value.toISOString() : value)
    return {
      ...result,
      rows: options?.arrayMode ? result.rows.map(row => result.fields.map(field => normalize(row[field.name]))) : result.rows,
    }
  })
})
after(async () => {
  mock.restoreAll()
  await pg.close()
})
async function reset() {
  await pg.exec('TRUNCATE video_generation_jobs, video_file_cleanup, videos, users CASCADE')
  await pg.query('INSERT INTO users(id) VALUES($1)', [owner])
  await pg.query(
    `INSERT INTO videos(id,user_id,title,visibility,mux_playback_id,mux_asset_id,mux_track_id,thumbnail_key)
    VALUES($1,$2,'Original','public','playback','asset','track','old-file')`,
    [videoId, owner]
  )
}

test('dispatch failure remains discoverable and retries the same job through successful writeback', async () => {
  await reset()
  let fails = true
  const runs: string[] = []
  const trigger = mock.method(workflow, 'trigger', async (input: { workflowRunId: string }) => {
    runs.push(input.workflowRunId)
    if (fails) throw new Error('lost response')
    return { workflowRunId: `wfr_${input.workflowRunId}` }
  })
  try {
    const job = await startVideoGeneration('title', videoId, owner)
    assert.equal(job.status, 'queued')
    assert.ok(job.error)
    assert.equal((await getGenerationJob(videoId, owner, 'title'))?.id, job.id)
    fails = false
    assert.equal((await retryVideoGeneration(job.id, owner)).id, job.id)
    assert.equal(runs[0], runs[1])
    await beginGeneration(job.id, videoId, owner, 'title')
    assert.equal((await startVideoGeneration('title', videoId, owner)).id, job.id, 'second page must reuse the active task')
    assert.equal((await finishTextGeneration(job.id, 'title', 'Generated')).status, 'completed')
    await failGeneration(job.id)
    assert.equal((await getGenerationJob(videoId, owner, 'title'))?.status, 'completed', 'late failure must not undo success')
    assert.equal((await finishTextGeneration(job.id, 'title', 'Duplicate')).result, 'Generated')
  } finally {
    trigger.mock.restore()
  }
})

test('other users cannot discover or retry a generation task', async () => {
  await reset()
  const trigger = mock.method(workflow, 'trigger', async () => {
    throw new Error('offline')
  })
  try {
    const job = await startVideoGeneration('title', videoId, owner)
    const other = '00000000-0000-4000-8000-000000000009'
    await assert.rejects(getGenerationJob(videoId, other, 'title'), error => (error as { code: string }).code === 'NOT_FOUND')
    await assert.rejects(retryVideoGeneration(job.id, other), error => (error as { code: string }).code === 'NOT_FOUND')
  } finally {
    trigger.mock.restore()
  }
})

test('cleanup preserves latest conflict recovery and regeneration; pruned callbacks are ignored', async () => {
  await reset()
  const trigger = mock.method(workflow, 'trigger', async () => ({ workflowRunId: 'test' }))
  try {
    const old = await startVideoGeneration('title', videoId, owner)
    await finishTextGeneration(old.id, 'title', 'Old result')
    const latest = await startVideoGeneration('title', videoId, owner)
    await pg.query("UPDATE videos SET title='User edit'")
    await finishTextGeneration(latest.id, 'title', 'Conflict suggestion')
    // Both are expired; the conflict remains protected because it is the latest.
    await pg.query("UPDATE video_generation_jobs SET created_at='2026-01-01',finished_at='2026-01-02' WHERE id=$1", [old.id])
    await pg.query("UPDATE video_generation_jobs SET created_at='2026-02-01',finished_at='2026-02-02' WHERE id=$1", [latest.id])
    const result = await runGenerationCleanup(
      async <Row extends Record<string, unknown>>(query: SQL<Row>) => (await db.execute<Row>(query)).rows,
      generationCleanupPolicy('30', new Date('2026-09-19'))
    )
    assert.equal(result.deleted, 1)
    const recovered = await getGenerationJob(videoId, owner, 'title')
    assert.equal(recovered?.id, latest.id)
    assert.equal(recovered?.result, 'Conflict suggestion')
    assert.equal(recovered?.status, 'conflict')
    assert.equal(await getGenerationJob(videoId, owner, 'title', old.id), null)
    assert.equal(await beginGeneration(old.id, videoId, owner, 'title'), null)
    assert.deepEqual(await finishTextGeneration(old.id, 'title', 'Late result'), {
      outcome: 'ignored',
      reason: 'job_missing',
      status: null,
      result: null,
    })
    await failGeneration(old.id)
    assert.equal((await pg.query<{ title: string }>('SELECT title FROM videos')).rows[0].title, 'User edit')
    await updateVideo({ id: videoId, title: recovered!.result! }, owner)
    assert.equal((await pg.query<{ title: string }>('SELECT title FROM videos')).rows[0].title, 'Conflict suggestion')
    assert.equal((await retryVideoGeneration(latest.id, owner)).status, 'conflict', 'terminal tasks never reactivate')
    const next = await startVideoGeneration('title', videoId, owner)
    assert.notEqual(next.id, latest.id)
    assert.equal(next.status, 'queued')
    assert.equal((await retryVideoGeneration(next.id, owner)).id, next.id)
  } finally {
    trigger.mock.restore()
  }
})

test('restore succeeds despite remote cleanup failure; recovery deletes the recorded old key', async () => {
  await reset()
  const deleted: string[][] = []
  let fails = true
  const removeFiles = async (keys: (string | null | undefined)[]) => {
    deleted.push(keys as string[])
    if (fails) throw new Error('provider unavailable')
  }
  // No UploadThing token exists in this isolated process; restore defers cleanup safely.
  assert.equal((await restoreVideoThumbnail(videoId, owner)).thumbnailKey, null)
  assert.equal((await pendingFileCleanup(videoId))[0].key, 'old-file')
  assert.equal(await cleanupVideoFiles(videoId, removeFiles), 1)
  fails = false
  assert.equal(await cleanupVideoFiles(videoId, removeFiles), 0)
  assert.deepEqual(deleted, [['old-file'], ['old-file']])
})

test('visibility update hides immediately on revocation failure and retry restores signed playback', async () => {
  await reset()
  let fails = true
  const revoked: string[] = []
  const revoke = mock.method(mux.video.assets, 'deletePlaybackId', async (_asset: string, id: string) => {
    revoked.push(id)
    if (fails) throw new Error('provider unavailable')
  })
  const create = mock.method(mux.video.assets, 'createPlaybackId', async () => ({ id: 'replacement', policy: 'signed' }))
  try {
    await assert.rejects(updateVideo({ id: videoId, visibility: 'private' }, owner))
    const {
      rows: [row],
    } = await pg.query('SELECT visibility,mux_playback_id,mux_playback_id_to_revoke FROM videos')
    assert.deepEqual(row, { visibility: 'private', mux_playback_id: null, mux_playback_id_to_revoke: 'playback' })
    fails = false
    const { requireVideo } = await import('../src/modules/videos/server/services/access')
    const updated = await resumePlaybackRevocation(await requireVideo(videoId, owner, true))
    assert.equal(updated.muxPlaybackId, 'replacement')
    assert.equal(updated.muxPlaybackIdToRevoke, null)
    assert.deepEqual(revoked, ['playback', 'playback'])
  } finally {
    revoke.mock.restore()
    create.mock.restore()
  }
})
