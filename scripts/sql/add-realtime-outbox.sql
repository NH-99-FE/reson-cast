-- Run after add-video-generation-jobs.sql. Trigger definitions are part of this migration;
-- drizzle-kit push alone does not install them. Safe to rerun.
BEGIN;
CREATE TABLE IF NOT EXISTS realtime_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('video.changed', 'generation.changed', 'deletion.changed')),
  job_id uuid,
  kind text CHECK (kind IN ('title', 'description', 'thumbnail')),
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text
);
CREATE INDEX IF NOT EXISTS realtime_outbox_pending ON realtime_outbox(next_attempt_at)
  WHERE sent_at IS NULL AND failed_at IS NULL;
CREATE INDEX IF NOT EXISTS realtime_outbox_sent ON realtime_outbox(sent_at) WHERE sent_at IS NOT NULL;

CREATE OR REPLACE FUNCTION capture_studio_video_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO realtime_outbox(user_id, video_id, type) VALUES (OLD.user_id, OLD.id, 'deletion.changed');
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO realtime_outbox(user_id, video_id, type) VALUES (NEW.user_id, NEW.id, 'video.changed');
    RETURN NEW;
  END IF;
  IF ROW(NEW.deletion_requested_at, NEW.deletion_run_id, NEW.deletion_error)
      IS DISTINCT FROM ROW(OLD.deletion_requested_at, OLD.deletion_run_id, OLD.deletion_error) THEN
    INSERT INTO realtime_outbox(user_id, video_id, type) VALUES (NEW.user_id, NEW.id, 'deletion.changed');
  END IF;
  IF ROW(NEW.mux_status, NEW.mux_track_id, NEW."muxTrack_status", NEW.mux_playback_id,
         NEW.title, NEW.description, NEW.thumbnail_key, NEW.thumbnail_url, NEW.preview_url, NEW.duration)
      IS DISTINCT FROM ROW(OLD.mux_status, OLD.mux_track_id, OLD."muxTrack_status", OLD.mux_playback_id,
         OLD.title, OLD.description, OLD.thumbnail_key, OLD.thumbnail_url, OLD.preview_url, OLD.duration) THEN
    INSERT INTO realtime_outbox(user_id, video_id, type) VALUES (NEW.user_id, NEW.id, 'video.changed');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studio_video_event ON videos;
CREATE TRIGGER studio_video_event AFTER INSERT OR UPDATE OR DELETE ON videos
  FOR EACH ROW EXECUTE FUNCTION capture_studio_video_event();

CREATE OR REPLACE FUNCTION capture_studio_generation_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.status, NEW.error) IS NOT DISTINCT FROM ROW(OLD.status, OLD.error) THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO realtime_outbox(user_id, video_id, type, job_id, kind)
    VALUES (NEW.user_id, NEW.video_id, 'generation.changed', NEW.id, NEW.kind);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studio_generation_event ON video_generation_jobs;
CREATE TRIGGER studio_generation_event AFTER INSERT OR UPDATE ON video_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION capture_studio_generation_event();
COMMIT;
