'use client'

import Image from 'next/image'
import { useState } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration } from '@/lib/utils'
import { cardThumbnailSource, isPublicThumbnail } from '@/lib/video-image-source'
import { THUMBNAIL_FALLBACK } from '@/modules/videos/constants'

interface VideoThumbnailProps {
  title: string
  imageUrl?: string | null
  previewUrl?: string | null
  duration: number
  priority?: boolean
}

export const VideoThumbnailSkeleton = () => {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl">
      <Skeleton className="size-full" />
    </div>
  )
}

export const VideoThumbnail = ({ title, imageUrl, previewUrl, duration, priority = false }: VideoThumbnailProps) => {
  const [previewActive, setPreviewActive] = useState(false)
  const [requestedPreviewUrl, setRequestedPreviewUrl] = useState<string | null>(null)
  const activatePreview = () => {
    setRequestedPreviewUrl(previewUrl || null)
    setPreviewActive(true)
  }
  return (
    <div
      className="group relative"
      onPointerEnter={event => {
        if (event.pointerType !== 'touch') activatePreview()
      }}
      onPointerLeave={() => setPreviewActive(false)}
      onPointerDown={event => {
        if (event.pointerType === 'touch') activatePreview()
      }}
      onPointerUp={event => {
        if (event.pointerType === 'touch') setPreviewActive(false)
      }}
      onPointerCancel={() => setPreviewActive(false)}
    >
      {/*缩略图区域*/}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl">
        {/*静态图*/}
        <Image
          src={cardThumbnailSource(imageUrl) || THUMBNAIL_FALLBACK}
          alt={title}
          fill
          priority={priority}
          unoptimized={!isPublicThumbnail(imageUrl)}
          sizes="(min-width: 2200px) 16vw, (min-width: 1920px) 20vw, (min-width: 1536px) 23vw, (min-width: 1024px) 30vw, (min-width: 640px) 48vw, 100vw"
          className="h-full w-full object-cover"
          onError={e => {
            e.currentTarget.removeAttribute('srcset')
            if (e.currentTarget.getAttribute('src') !== THUMBNAIL_FALLBACK) e.currentTarget.src = THUMBNAIL_FALLBACK
          }}
        />
        {/* Mount on interaction and keep hidden between interactions. Unmount on failure or a URL mismatch;
            the next interaction requests the current URL. */}
        {previewUrl && requestedPreviewUrl === previewUrl ? (
          <VideoPreview
            key={previewUrl}
            src={previewUrl}
            active={previewActive}
            onError={() => setRequestedPreviewUrl(current => (current === previewUrl ? null : current))}
          />
        ) : null}
      </div>
      <div className="absolute right-2 bottom-2 rounded bg-black/70 px-1 py-0.5 text-xs font-medium text-white">
        {formatDuration(duration)}
      </div>
    </div>
  )
}

function VideoPreview({ src, active, onError }: { src: string; active: boolean; onError: () => void }) {
  const [ready, setReady] = useState(false)
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      fill
      unoptimized
      loading="eager"
      onLoad={() => setReady(true)}
      onError={onError}
      className={`pointer-events-none h-full w-full object-cover ${active && ready ? 'opacity-100' : 'hidden opacity-0'}`}
    />
  )
}
