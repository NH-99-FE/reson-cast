import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'

import { PGlite } from '@electric-sql/pglite'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import { finishTextGenerationQuery } from '../src/modules/videos/server/services/generation-queries'
import { replaceThumbnailQuery } from '../src/modules/videos/server/services/thumbnail-queries'

const pg = new PGlite()
const dialect = new PgDialect()
const owner = '00000000-0000-4000-8000-000000000001'
const video = '00000000-0000-4000-8000-000000000002'
const jobId = '00000000-0000-4000-8000-000000000003'
async function execute(query: SQL) {
  const { sql, params } = dialect.sqlToQuery(query)
  return (await pg.query(sql, params)).rows as Array<Record<string, unknown>>
}
async function reset(kind = 'title', expected: string | null = 'Original') {
  await pg.exec('TRUNCATE video_generation_jobs, video_file_cleanup, videos, users CASCADE')
  await pg.query('INSERT INTO users (id) VALUES ($1)', [owner])
  await pg.query('INSERT INTO videos (id,user_id,title,thumbnail_key) VALUES ($1,$2,$3,$4)', [video, owner, 'Original', 'old-file'])
  await pg.query('INSERT INTO video_generation_jobs (id,video_id,user_id,kind,workflow_run_id,expected_value) VALUES ($1,$2,$3,$4,$5,$6)', [
    jobId,
    video,
    owner,
    kind,
    'wfr_test',
    expected,
  ])
}
before(async () => {
  await pg.exec(`CREATE TABLE users (id uuid PRIMARY KEY);
    CREATE TABLE videos (id uuid PRIMARY KEY, user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      title text, description text, thumbnail_key text, thumbnail_url text, deletion_requested_at timestamp, updated_at timestamp);`)
  await pg.exec(await readFile(new URL('../scripts/sql/add-video-generation-jobs.sql', import.meta.url), 'utf8'))
})
after(() => pg.close())

test('atomic generation finish persists content and terminal result; replay cannot overwrite a later edit', async () => {
  await reset()
  assert.deepEqual(await execute(finishTextGenerationQuery(jobId, 'title', 'Generated')), [{ status: 'completed', result: 'Generated' }])
  await pg.query('UPDATE videos SET title=$1 WHERE id=$2', ['Later edit', video])
  assert.deepEqual(await execute(finishTextGenerationQuery(jobId, 'title', 'Repeated')), [{ status: 'completed', result: 'Generated' }])
  assert.equal((await pg.query<{ title: string }>('SELECT title FROM videos')).rows[0].title, 'Later edit')
})

test('conflicting generation preserves both the user edit and generated suggestion', async () => {
  await reset()
  await pg.query("UPDATE videos SET title='Other edit'")
  assert.deepEqual(await execute(finishTextGenerationQuery(jobId, 'title', 'Suggestion')), [{ status: 'conflict', result: 'Suggestion' }])
  assert.equal((await pg.query<{ title: string }>('SELECT title FROM videos')).rows[0].title, 'Other edit')
})

test('task terminal write failure rolls back content write too', async () => {
  await reset()
  await pg.exec("ALTER TABLE video_generation_jobs ADD CONSTRAINT simulate_failure CHECK (status <> 'completed')")
  try {
    await assert.rejects(execute(finishTextGenerationQuery(jobId, 'title', 'Generated')))
    assert.equal((await pg.query<{ title: string }>('SELECT title FROM videos')).rows[0].title, 'Original')
  } finally {
    await pg.exec('ALTER TABLE video_generation_jobs DROP CONSTRAINT simulate_failure')
  }
})

test('active generation uniqueness allows different fields but blocks duplicate submissions', async () => {
  await reset()
  await assert.rejects(
    pg.query("INSERT INTO video_generation_jobs(video_id,user_id,kind,workflow_run_id) VALUES($1,$2,'title','duplicate')", [video, owner])
  )
  await pg.query("INSERT INTO video_generation_jobs(video_id,user_id,kind,workflow_run_id) VALUES($1,$2,'description','other')", [
    video,
    owner,
  ])
})

test('restoring thumbnail durably queues old file; retry after cleanup outage still finds it', async () => {
  await reset()
  const input = { videoId: video, userId: owner, expectedKey: 'old-file', newKey: null }
  assert.equal((await execute(replaceThumbnailQuery(input)))[0].attached, true)
  // The remote delete fails. Nothing acknowledges the pending cleanup row.
  await execute(replaceThumbnailQuery({ ...input, expectedKey: null }))
  const pending = await pg.query<{ key: string }>('SELECT key FROM video_file_cleanup WHERE cleaned_at IS NULL')
  assert.deepEqual(pending.rows, [{ key: 'old-file' }])
  await pg.exec('UPDATE video_file_cleanup SET cleaned_at=now()')
  assert.equal((await pg.query('SELECT key FROM video_file_cleanup WHERE cleaned_at IS NULL')).rows.length, 0)
})

test('thumbnail and cleanup intent roll back together if recording cleanup fails', async () => {
  await reset()
  await pg.exec("ALTER TABLE video_file_cleanup ADD CONSTRAINT simulate_failure CHECK (key <> 'old-file')")
  try {
    await assert.rejects(execute(replaceThumbnailQuery({ videoId: video, userId: owner, expectedKey: 'old-file', newKey: 'new-file' })))
    assert.equal((await pg.query<{ thumbnail_key: string }>('SELECT thumbnail_key FROM videos')).rows[0].thumbnail_key, 'old-file')
  } finally {
    await pg.exec('ALTER TABLE video_file_cleanup DROP CONSTRAINT simulate_failure')
  }
})

test('late/replayed uploads cannot reattach a cleaned file or overwrite a newer thumbnail', async () => {
  await reset()
  const input = { videoId: video, userId: owner, expectedKey: 'old-file', newKey: 'new-file' }
  await execute(replaceThumbnailQuery(input))
  await execute(replaceThumbnailQuery({ ...input, expectedKey: 'new-file', newKey: null }))
  await pg.exec('UPDATE video_file_cleanup SET cleaned_at=now()')
  assert.equal((await execute(replaceThumbnailQuery({ ...input, expectedKey: null })))[0].attached, false)
  assert.equal((await pg.query<{ thumbnail_key: string | null }>('SELECT thumbnail_key FROM videos')).rows[0].thumbnail_key, null)
})

test('thumbnail generation updates task and media atomically and is safe to replay', async () => {
  await reset('thumbnail', 'old-file')
  const input = { videoId: video, userId: owner, expectedKey: 'old-file', newKey: 'generated-file', jobId }
  assert.equal((await execute(replaceThumbnailQuery(input)))[0].status, 'completed')
  await execute(replaceThumbnailQuery({ ...input, jobId: undefined, expectedKey: 'generated-file', newKey: 'manual-file' }))
  assert.equal((await execute(replaceThumbnailQuery(input)))[0].status, 'completed')
  assert.equal((await pg.query<{ thumbnail_key: string }>('SELECT thumbnail_key FROM videos')).rows[0].thumbnail_key, 'manual-file')
})

test('late callback after video deletion queues its file without resurrecting the video', async () => {
  await reset()
  await pg.query('DELETE FROM videos WHERE id=$1', [video])
  assert.equal(
    (await execute(replaceThumbnailQuery({ videoId: video, userId: owner, expectedKey: null, newKey: 'late-file' })))[0].attached,
    false
  )
  assert.deepEqual((await pg.query('SELECT key FROM video_file_cleanup')).rows, [{ key: 'late-file' }])
})
