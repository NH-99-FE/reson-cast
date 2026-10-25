-- Stop the old server, apply this migration, then start the updated server.
-- Safe to rerun. Does not infer historical adoption from text equality.
BEGIN;
ALTER TABLE video_generation_jobs ADD COLUMN IF NOT EXISTS resolution text;
UPDATE video_generation_jobs SET resolution = 'pending'
WHERE status = 'conflict' AND kind IN ('title', 'description') AND result IS NOT NULL AND resolution IS NULL;

ALTER TABLE video_generation_jobs DROP CONSTRAINT IF EXISTS video_generation_resolution;
ALTER TABLE video_generation_jobs ADD CONSTRAINT video_generation_resolution CHECK (resolution IN ('pending', 'adopted', 'dismissed'));
ALTER TABLE video_generation_jobs DROP CONSTRAINT IF EXISTS video_generation_resolution_scope;
ALTER TABLE video_generation_jobs ADD CONSTRAINT video_generation_resolution_scope
  CHECK (resolution IS NULL OR (status = 'conflict' AND kind IN ('title', 'description') AND result IS NOT NULL));

-- Replace the function used by an existing outbox trigger. New installations
-- attach the trigger when add-realtime-outbox.sql is applied.
CREATE OR REPLACE FUNCTION capture_studio_generation_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.status, NEW.error, NEW.resolution) IS NOT DISTINCT FROM ROW(OLD.status, OLD.error, OLD.resolution) THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO realtime_outbox(user_id, video_id, type, job_id, kind)
    VALUES (NEW.user_id, NEW.video_id, 'generation.changed', NEW.id, NEW.kind);
  RETURN NEW;
END $$;
COMMIT;
