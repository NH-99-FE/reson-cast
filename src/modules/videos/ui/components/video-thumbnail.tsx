import Image from 'next/image'

import { formatDuration } from '@/lib/utils'
import { THUMBNAIL_FALLBACK } from '@/modules/videos/constants'

interface VideoThumbnailProps {
  title: string
  imageUrl?: string | null
  previewUrl?: string | null
  duration: number
}

export const VideoThumbnail = ({ title, imageUrl, previewUrl, duration }: VideoThumbnailProps) => {
  return (
    <div className="group relative">
      {/*缩略图区域*/}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl">
        {/*静态图*/}
        <Image
          src={imageUrl || THUMBNAIL_FALLBACK}
          alt={title}
          fill
          className="h-full w-full object-cover group-hover:opacity-0"
          unoptimized
        />
        {/*缩略图*/}
        <Image
          src={previewUrl || THUMBNAIL_FALLBACK}
          alt={title}
          fill
          unoptimized={!!previewUrl}
          className="h-full w-full object-cover opacity-0 group-hover:opacity-100"
        />
      </div>
      <div className="absolute right-2 bottom-2 rounded bg-black/70 px-1 py-0.5 text-xs font-medium text-white">
        {formatDuration(duration)}
      </div>
    </div>
  )
}
