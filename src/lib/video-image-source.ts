/** A new file key gives the optimizer a new source URL. */
export function thumbnailVersion(key: string) {
  return Array.from(new TextEncoder().encode(key), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function publicThumbnailPath(videoId: string, key: string) {
  return `/api/public/video-thumbnails/${videoId}/${thumbnailVersion(key)}`
}

export function isPublicThumbnail(src?: string | null) {
  return !!src && /^\/api\/public\/video-thumbnails\/[0-9a-f-]{36}\/[0-9a-f]+$/.test(src)
}

/** Only the authenticated Mux fallback accepts a display width; preserve version parameters. */
export function cardThumbnailSource(src?: string | null) {
  if (!src || !/^\/api\/videos\/[0-9a-f-]{36}\/image\/thumbnail(?:\?|$)/.test(src)) return src
  const [path, query] = src.split('?')
  const params = new URLSearchParams(query)
  params.set('width', '640')
  return `${path}?${params}`
}

export function videoThumbnailSource(video: {
  id: string
  visibility: string
  thumbnailKey: string | null
  thumbnailUrl: string | null
  deletionRequestedAt?: Date | string | null
}) {
  if (video.visibility === 'public' && video.thumbnailKey && !video.deletionRequestedAt) {
    return publicThumbnailPath(video.id, video.thumbnailKey)
  }
  return video.thumbnailUrl
}
