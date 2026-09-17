-- Additive, repeatable migration for the playback revocation retry state.
-- Existing videos have no pending revocation, represented by NULL.
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS mux_playback_id_to_revoke text;
