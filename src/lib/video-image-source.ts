/** A new file key gives the optimizer a new source URL. */
export function thumbnailVersion(key: string) {
  return Array.from(new TextEncoder().encode(key), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function publicThumbnailPath(videoId: string, key: string) {
  return `/api/public/video-thumbnails/${videoId}/${thumbnailVersion(key)}`
}

export function publicMuxThumbnailPath(videoId: string, playbackId: string, width: 640 | 1280 = 1280) {
  return `/api/public/video-mux-thumbnails/${videoId}/${thumbnailVersion(playbackId)}/${width}`
}

export function isPublicThumbnail(src?: string | null) {
  return !!src && /^\/api\/public\/video-thumbnails\/[0-9a-f-]{36}\/[0-9a-f]+$/.test(src)
}

/** Mux serves cards at 640px; preserve versions and leave optimizer sources unchanged. */
export function cardThumbnailSource(src?: string | null) {
  if (src && /^\/api\/public\/video-mux-thumbnails\/[0-9a-f-]{36}\/[0-9a-f]+\/(?:640|1280)$/.test(src)) {
    return src.replace(/\/(?:640|1280)$/, '/640')
  }
  if (!src || !/^\/api\/videos\/[0-9a-f-]{36}\/image\/thumbnail(?:\?|$)/.test(src)) return src
  const [path, query] = src.split('?')
  const params = new URLSearchParams(query)
  params.set('width', '640')
  return `${path}?${params}`
}

export interface VideoThumbnailInput {
  id: string
  visibility: string
  thumbnailKey: string | null
  thumbnailUrl: string | null
  muxPlaybackId?: string | null
  deletionRequestedAt?: Date | string | null
}

export function videoThumbnailSource(video: VideoThumbnailInput) {
  if (video.visibility === 'public' && !video.deletionRequestedAt) {
    if (video.thumbnailKey) return publicThumbnailPath(video.id, video.thumbnailKey)
    if (video.muxPlaybackId) return publicMuxThumbnailPath(video.id, video.muxPlaybackId)
  }
  return video.thumbnailUrl
}
