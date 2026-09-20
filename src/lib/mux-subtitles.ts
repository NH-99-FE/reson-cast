import type { Track } from '@mux/mux-node/resources/video/assets'

// Match the English auto-caption track requested by videos.create. Only copy
// ready tracks: an older asset snapshot must not clear a completed subtitle.
export function readyMuxSubtitle(tracks: Track[] | undefined) {
  const track = tracks?.find(
    track =>
      track.type === 'text' && track.text_source === 'generated_vod' && track.language_code === 'en' && track.status === 'ready' && track.id
  )
  return track?.id ? { muxTrackId: track.id, muxTrackStatus: 'ready' as const } : {}
}
