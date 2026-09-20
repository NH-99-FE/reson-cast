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
const { syncMuxSubtitle } = await import('../src/modules/videos/server/services/subtitles')
const { readyMuxSubtitle } = await import('../src/lib/mux-subtitles')
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

const readySubtitle = { id: 'english-caption', type: 'text', text_source: 'generated_vod', language_code: 'en', status: 'ready' } as const

test('subtitle arriving before the asset callback is associated through upload ID; duplicates are safe', async () => {
  await reset()
  await pg.query('UPDATE videos SET mux_asset_id=NULL, mux_upload_id=$1, mux_track_id=NULL', ['upload'])
  const retrieve = mock.method(mux.video.assets, 'retrieve', async () => ({ id: 'asset', upload_id: 'upload', tracks: [readySubtitle] }))
  try {
    assert.equal(await syncMuxSubtitle('asset'), 'synced')
    assert.equal(await syncMuxSubtitle('asset'), 'synced')
    const { rows } = await pg.query<{ mux_track_id: string | null; muxTrack_status: string | null; mux_asset_id: string | null }>(
      'SELECT mux_track_id, "muxTrack_status", mux_asset_id FROM videos WHERE id=$1',
      [videoId]
    )
    assert.equal(rows[0].mux_track_id, readySubtitle.id)
    assert.equal(rows[0].muxTrack_status, 'ready')
    assert.equal(rows[0].mux_asset_id, null, 'does not depend on or replace asset synchronization')
  } finally {
    retrieve.mock.restore()
  }
})

test('unassociated subtitles request a retry, while deleted videos are left untouched', async () => {
  await reset()
  const retrieve = mock.method(mux.video.assets, 'retrieve', async () => ({ id: 'asset', upload_id: 'upload', tracks: [readySubtitle] }))
  try {
    await pg.query('UPDATE videos SET mux_asset_id=NULL, mux_track_id=NULL')
    assert.equal(await syncMuxSubtitle('asset'), 'retry')
    await pg.query('UPDATE videos SET mux_upload_id=$1, deletion_requested_at=now()', ['upload'])
    assert.equal(await syncMuxSubtitle('asset'), 'ignored')
    const { rows } = await pg.query<{ mux_track_id: string | null }>('SELECT mux_track_id FROM videos')
    assert.equal(rows[0].mux_track_id, null)
  } finally {
    retrieve.mock.restore()
  }
})

test('deleted Mux assets are acknowledged, but transient Mux errors remain retryable', async () => {
  let status = 404
  const retrieve = mock.method(mux.video.assets, 'retrieve', async () => {
    throw Object.assign(new Error('Mux failed'), { status })
  })
  try {
    assert.equal(await syncMuxSubtitle('asset'), 'ignored')
    status = 503
    await assert.rejects(syncMuxSubtitle('asset'), /Mux failed/)
  } finally {
    retrieve.mock.restore()
  }
})

test('asset reconciliation selects the ready English automatic caption and does not downgrade it', () => {
  const patch = readyMuxSubtitle([
    { id: 'audio', type: 'audio' },
    { ...readySubtitle, id: 'french', language_code: 'fr' },
    { ...readySubtitle, id: 'uploaded', text_source: 'uploaded' },
    { ...readySubtitle, id: 'pending', status: 'preparing' },
    readySubtitle,
  ])
  assert.deepEqual(patch, { muxTrackId: readySubtitle.id, muxTrackStatus: 'ready' })
  assert.deepEqual({ ...patch, ...readyMuxSubtitle([{ ...readySubtitle, status: 'preparing' }]) }, patch)
  assert.deepEqual(readyMuxSubtitle(undefined), {})
})

test('subtitle ready callback retries when the current asset snapshot has not caught up', async () => {
  const retrieve = mock.method(mux.video.assets, 'retrieve', async () => ({
    id: 'asset',
    tracks: [{ ...readySubtitle, status: 'preparing' }],
  }))
  try {
    assert.equal(await syncMuxSubtitle('asset'), 'retry')
  } finally {
    retrieve.mock.restore()
  }
})

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

const { runUploadCleanup } = await import('../src/modules/videos/server/services/upload-cleanup')
async function abandonedFixture() {
  await reset()
  await pg.exec(`UPDATE videos SET mux_asset_id=NULL, mux_playback_id=NULL, mux_upload_id='upload', mux_status='waiting',
    created_at='2020-01-01', updated_at='2020-01-01', thumbnail_key=NULL`)
}
test('upload recovery retains active/completed/unknown uploads and provider failures', async () => {
  for (const response of [
    { status: 'waiting' },
    { status: 'asset_created', asset_id: 'asset' },
    { status: 'timed_out', asset_id: 'asset' },
    { status: 'unknown' },
    { status: 404 },
    { status: 503 },
  ]) {
    await abandonedFixture()
    const retrieve = mock.method(mux.video.uploads, 'retrieve', async () => {
      if (typeof response.status === 'number') throw response
      return response
    })
    try {
      await runUploadCleanup()
      const {
        rows: [row],
      } = await pg.query<{ deletion_requested_at: Date | null }>('SELECT deletion_requested_at FROM videos')
      assert.equal(row.deletion_requested_at, null)
    } finally {
      retrieve.mock.restore()
    }
  }
})
test('terminal empty uploads are submitted for deletion, and late local association prevents deletion', async () => {
  for (const raced of [false, true]) {
    await abandonedFixture()
    const retrieve = mock.method(mux.video.uploads, 'retrieve', async () => {
      if (raced) await pg.exec("UPDATE videos SET mux_asset_id='late-asset'")
      return { status: 'timed_out' }
    })
    const trigger = mock.method(workflow, 'trigger', async () => ({ workflowRunId: 'test' }))
    try {
      const result = await runUploadCleanup()
      assert.equal(result.submitted, raced ? 0 : 1)
      assert.equal(trigger.mock.callCount(), raced ? 0 : 1)
      const {
        rows: [row],
      } = await pg.query<{ deletion_requested_at: Date | null }>('SELECT deletion_requested_at FROM videos')
      assert.equal(row.deletion_requested_at !== null, !raced)
    } finally {
      retrieve.mock.restore()
      trigger.mock.restore()
    }
  }
})
test('recovery finishes persisted deletion even after dispatch failure', async () => {
  await abandonedFixture()
  await pg.exec("UPDATE videos SET deletion_requested_at=now(), deletion_error='dispatch failed'")
  const retrieve = mock.method(mux.video.uploads, 'retrieve', async () => ({ status: 'cancelled' }))
  try {
    const result = await runUploadCleanup()
    assert.equal(result.recovered, 1)
    assert.equal((await pg.query('SELECT id FROM videos')).rows.length, 0)
  } finally {
    retrieve.mock.restore()
  }
})

type CleanupRequestOptions = { signal: AbortSignal; timeout: number; maxRetries: number }

test('maintenance passes one deadline and bounded retry-free options through all Mux cleanup operations', async () => {
  await abandonedFixture()
  await pg.exec("UPDATE videos SET deletion_requested_at=now(), deletion_error='dispatch failed', mux_asset_id='asset'")
  let reads = 0
  const options: CleanupRequestOptions[] = []
  const retrieve = mock.method(mux.video.uploads, 'retrieve', async (_id: string, opts: CleanupRequestOptions) => {
    options.push(opts)
    return { status: ++reads === 1 ? 'waiting' : 'cancelled' }
  })
  const cancel = mock.method(mux.video.uploads, 'cancel', async (_id: string, opts: CleanupRequestOptions) => {
    options.push(opts)
  })
  const remove = mock.method(mux.video.assets, 'delete', async (_id: string, opts: CleanupRequestOptions) => {
    options.push(opts)
  })
  try {
    assert.equal((await runUploadCleanup()).recovered, 1)
    assert.equal(options.length, 4)
    for (const option of options) {
      assert.equal(option.timeout, 5000)
      assert.equal(option.maxRetries, 0)
      assert.ok(option.signal instanceof AbortSignal)
      assert.equal(option.signal, options[0].signal)
    }
  } finally {
    retrieve.mock.restore()
    cancel.mock.restore()
    remove.mock.restore()
  }
})

test('an interrupted recovery preserves deletion intent and can be retried', async () => {
  await abandonedFixture()
  await pg.exec("UPDATE videos SET deletion_requested_at=now(), deletion_error='dispatch failed'")
  const { cleanupVideo } = await import('../src/modules/videos/server/services/deletion')
  const controller = new AbortController()
  const retrieve = mock.method(mux.video.uploads, 'retrieve', async (_id: string, options: CleanupRequestOptions) => {
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      controller.abort(new Error('maintenance deadline'))
    })
  })
  try {
    await assert.rejects(cleanupVideo(videoId, undefined, controller.signal), /maintenance deadline/)
    assert.equal((await pg.query('SELECT id FROM videos WHERE deletion_requested_at IS NOT NULL')).rows.length, 1)
  } finally {
    retrieve.mock.restore()
  }
  const retry = mock.method(mux.video.uploads, 'retrieve', async () => ({ status: 'cancelled' }))
  try {
    assert.equal((await runUploadCleanup()).recovered, 1)
  } finally {
    retry.mock.restore()
  }
})

test('file cleanup propagates cancellation into the UploadThing HTTP request', async () => {
  const { deleteFiles } = await import('../src/lib/video-media')
  const savedToken = process.env.UPLOADTHING_TOKEN
  process.env.UPLOADTHING_TOKEN = Buffer.from(JSON.stringify({ apiKey: 'sk_test', appId: 'test', regions: ['sea1'] })).toString('base64')
  const controller = new AbortController()
  let interrupted = false
  const request = mock.method(globalThis, 'fetch', async (_input: unknown, options: RequestInit & { signal: AbortSignal }) => {
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener(
        'abort',
        () => {
          interrupted = true
          reject(options.signal.reason)
        },
        { once: true }
      )
      controller.abort(new Error('maintenance deadline'))
    })
  })
  try {
    await assert.rejects(deleteFiles(['cover'], controller.signal))
    assert.equal(interrupted, true)
  } finally {
    process.env.UPLOADTHING_TOKEN = savedToken
    request.mock.restore()
  }
})
