import Image from 'next/image'

import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration } from '@/lib/utils'
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
  return (
    <div className="group relative">
      {/*缩略图区域*/}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl">
        {/*静态图*/}
        <Image
          src={imageUrl || THUMBNAIL_FALLBACK}
          alt={title}
          fill
          priority={priority}
          sizes="(min-width: 2200px) 16vw, (min-width: 1920px) 20vw, (min-width: 1536px) 23vw, (min-width: 1024px) 30vw, (min-width: 640px) 48vw, 100vw"
          className="h-full w-full object-cover group-hover:opacity-0"
          onError={e => {
            e.currentTarget.src = THUMBNAIL_FALLBACK
          }}
        />
        {/*缩略图*/}
        <Image
          src={previewUrl || THUMBNAIL_FALLBACK}
          alt={title}
          fill
          unoptimized={!!previewUrl}
          sizes="(min-width: 2200px) 16vw, (min-width: 1920px) 20vw, (min-width: 1536px) 23vw, (min-width: 1024px) 30vw, (min-width: 640px) 48vw, 100vw"
          className="h-full w-full object-cover opacity-0 group-hover:opacity-100"
        />
      </div>
      <div className="absolute right-2 bottom-2 rounded bg-black/70 px-1 py-0.5 text-xs font-medium text-white">
        {formatDuration(duration)}
      </div>
    </div>
  )
}
