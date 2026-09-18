import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'

import { PGlite } from '@electric-sql/pglite'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import { deliverEvent, type OutboxRow } from '../src/lib/realtime/delivery'
import { acknowledgeEvent, claimEvents, failEvent, replayEvent, retryDelay } from '../src/lib/realtime/queries'

const pg = new PGlite()
const dialect = new PgDialect()
const owner = '00000000-0000-4000-8000-000000000001'
const video = '00000000-0000-4000-8000-000000000002'
const job = '00000000-0000-4000-8000-000000000003'
const token = '00000000-0000-4000-8000-000000000004'
const otherToken = '00000000-0000-4000-8000-000000000005'
async function execute(query: SQL) {
  const compiled = dialect.sqlToQuery(query)
  return pg.query<OutboxRow>(compiled.sql, compiled.params)
}
async function reset() {
  await pg.exec('TRUNCATE videos, video_generation_jobs, realtime_outbox CASCADE')
  await pg.query('INSERT INTO videos(id,user_id,title) VALUES ($1,$2,$3)', [video, owner, 'original'])
  await pg.exec('TRUNCATE realtime_outbox')
}
before(async () => {
  await pg.exec(`CREATE TABLE videos(id uuid PRIMARY KEY, user_id uuid, title text, description text,
    mux_status text, mux_track_id text, "muxTrack_status" text, mux_playback_id text,
    thumbnail_key text, thumbnail_url text, preview_url text, duration integer,
    deletion_requested_at timestamp, deletion_run_id uuid, deletion_error text);
    CREATE TABLE video_generation_jobs(id uuid PRIMARY KEY, video_id uuid REFERENCES videos(id) ON DELETE CASCADE,
    user_id uuid, kind text, status text, error text);`)
  await pg.exec(await readFile(new URL('../scripts/sql/add-realtime-outbox.sql', import.meta.url), 'utf8'))
})
after(() => pg.close())

test('trigger writes atomically, ignores unchanged state, and rolls back business update on outbox failure', async () => {
  await reset()
  await pg.exec("UPDATE videos SET mux_status='ready'; UPDATE videos SET mux_status='ready'")
  assert.equal((await pg.query<Record<string, unknown>>('SELECT * FROM realtime_outbox')).rows.length, 1)
  await pg.exec("ALTER TABLE realtime_outbox ADD CONSTRAINT simulated_failure CHECK (type <> 'generation.changed')")
  await assert.rejects(pg.query("INSERT INTO video_generation_jobs VALUES ($1,$2,$3,'title','queued',NULL)", [job, video, owner]))
  assert.equal((await pg.query<Record<string, unknown>>('SELECT * FROM video_generation_jobs')).rows.length, 0)
  await pg.exec('ALTER TABLE realtime_outbox DROP CONSTRAINT simulated_failure')
  await pg.exec('ALTER TABLE realtime_outbox ADD CONSTRAINT simulated_failure CHECK (video_id IS NULL) NOT VALID')
  await assert.rejects(pg.exec("UPDATE videos SET title='lost'"))
  assert.equal((await pg.query<Record<string, unknown>>('SELECT title FROM videos')).rows[0].title, 'original')
  await pg.exec('ALTER TABLE realtime_outbox DROP CONSTRAINT simulated_failure')
})
test('subtitle status uses the actual mixed-case database column and emits only on change', async () => {
  await reset()
  await pg.exec(`UPDATE videos SET "muxTrack_status"='ready'; UPDATE videos SET "muxTrack_status"='ready'`)
  const { rows } = await pg.query<{ type: string }>('SELECT type FROM realtime_outbox')
  assert.deepEqual(rows, [{ type: 'video.changed' }])
})
test('generation transitions and submission errors emit once; deletion preserves pending events', async () => {
  await reset()
  await pg.query("INSERT INTO video_generation_jobs VALUES ($1,$2,$3,'title','queued',NULL)", [job, video, owner])
  await pg.exec(
    "UPDATE video_generation_jobs SET status='running'; UPDATE video_generation_jobs SET status='running'; UPDATE video_generation_jobs SET status='failed', error='error'"
  )
  await pg.exec('DELETE FROM videos')
  const { rows } = await pg.query<Record<string, unknown>>('SELECT type FROM realtime_outbox')
  assert.equal(rows.filter(row => row.type === 'generation.changed').length, 3)
  assert.equal(rows.filter(row => row.type === 'deletion.changed').length, 1)
})
test('exclusive claims, lease expiry, stale acknowledgements, retry limit, replay and success', async () => {
  await reset()
  await pg.exec("UPDATE videos SET mux_track_id='track'")
  const claimed = await execute(claimEvents(token))
  assert.equal(claimed.rows.length, 1)
  const id = claimed.rows[0].id
  assert.equal((await execute(claimEvents(otherToken))).rows.length, 0)
  await pg.exec("UPDATE realtime_outbox SET lease_until=now()-interval '1 second'")
  assert.equal((await execute(claimEvents(otherToken))).rows.length, 1)
  await execute(acknowledgeEvent(id, token))
  assert.equal((await pg.query<Record<string, unknown>>('SELECT sent_at FROM realtime_outbox')).rows[0].sent_at, null)
  await pg.exec('UPDATE realtime_outbox SET attempts=19')
  await execute(failEvent(id, otherToken, 60, 'simulated outage'))
  assert.ok((await pg.query<Record<string, unknown>>('SELECT failed_at FROM realtime_outbox')).rows[0].failed_at)
  assert.equal((await execute(claimEvents(token))).rows.length, 0)
  await execute(replayEvent(id))
  assert.equal((await execute(claimEvents(token))).rows.length, 1)
  await execute(acknowledgeEvent(id, token))
  assert.equal((await execute(claimEvents(otherToken))).rows.length, 0)
  assert.equal((await execute(replayEvent(id))).rows.length, 0)
})
test('claim batches are bounded to 50', async () => {
  await reset()
  await pg.query("INSERT INTO realtime_outbox(user_id,video_id,type) SELECT $1,$2,'video.changed' FROM generate_series(1,60)", [
    owner,
    video,
  ])
  assert.equal((await execute(claimEvents(token))).rows.length, 50)
  assert.equal((await execute(claimEvents(otherToken))).rows.length, 10)
})
test('provider timeout and lost acknowledgement remain retryable; published data contains identifiers only', async () => {
  const row: OutboxRow = {
    id: job,
    user_id: owner,
    video_id: video,
    type: 'video.changed',
    version: 1,
    job_id: null,
    kind: null,
    attempts: 0,
  }
  const failures: number[] = []
  let acknowledgements = 0
  const fail = async (delay: number) => {
    failures.push(delay)
  }
  assert.equal(
    await deliverEvent(row, {
      publish: async () => {
        throw new Error('timeout')
      },
      acknowledge: async () => {
        acknowledgements++
      },
      fail,
    }),
    false
  )
  assert.equal(acknowledgements, 0)
  assert.equal(
    await deliverEvent(row, {
      publish: async (channel, event) => {
        assert.equal(channel, `studio:user:${owner}`)
        assert.deepEqual(Object.keys(event).sort(), ['id', 'jobId', 'kind', 'type', 'version', 'videoId'].sort())
      },
      acknowledge: async () => {
        throw new Error('DB unavailable')
      },
      fail,
    }),
    false
  )
  assert.equal(failures.length, 2)
  assert.ok(retryDelay(20) <= 900)
})
