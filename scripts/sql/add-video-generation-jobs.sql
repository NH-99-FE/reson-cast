-- Apply before deploying the new task endpoints. Safe to rerun.
CREATE TABLE IF NOT EXISTS video_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CONSTRAINT video_generation_kind CHECK (kind IN ('title', 'description', 'thumbnail')),
  status text NOT NULL DEFAULT 'queued' CONSTRAINT video_generation_status CHECK (status IN ('queued', 'running', 'completed', 'conflict', 'failed')),
  workflow_run_id text NOT NULL UNIQUE,
  expected_value text,
  prompt text,
  result text,
  error text,
  created_at timestamp NOT NULL DEFAULT now(),
  finished_at timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS video_generation_active
  ON video_generation_jobs(video_id, kind) WHERE status IN ('queued', 'running');
CREATE TABLE IF NOT EXISTS video_file_cleanup (
  key text PRIMARY KEY,
  video_id uuid NOT NULL,
  user_id uuid NOT NULL,
  error text,
  created_at timestamp NOT NULL DEFAULT now(),
  cleaned_at timestamp
);
CREATE INDEX IF NOT EXISTS video_generation_latest
  ON video_generation_jobs(video_id, kind, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS video_file_cleanup_pending
  ON video_file_cleanup(video_id) WHERE cleaned_at IS NULL;
