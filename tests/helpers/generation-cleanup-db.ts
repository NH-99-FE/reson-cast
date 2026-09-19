import { readFile } from 'node:fs/promises'

export const cleanupOwner = '00000000-0000-4000-8000-000000000001'
export const cleanupVideo = '00000000-0000-4000-8000-000000000002'

export async function installCleanupFixture(exec: (query: string) => Promise<unknown>) {
  await exec(`CREATE TABLE users(id uuid PRIMARY KEY);
    CREATE TABLE videos(id uuid PRIMARY KEY, user_id uuid REFERENCES users(id), title text, description text,
      mux_status text, mux_track_id text, "muxTrack_status" text, mux_playback_id text,
      thumbnail_key text, thumbnail_url text, preview_url text, duration integer, updated_at timestamp,
      deletion_requested_at timestamp, deletion_run_id uuid, deletion_error text);`)
  await exec(await readFile(new URL('../../scripts/sql/add-video-generation-jobs.sql', import.meta.url), 'utf8'))
  await exec(await readFile(new URL('../../scripts/sql/add-realtime-outbox.sql', import.meta.url), 'utf8'))
  await exec(`INSERT INTO users VALUES ('${cleanupOwner}');
    INSERT INTO videos(id,user_id,title,thumbnail_key) VALUES ('${cleanupVideo}','${cleanupOwner}','Original','current-file')`)
}
