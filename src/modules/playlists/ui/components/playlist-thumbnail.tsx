import { ListVideoIcon, PlayIcon } from 'lucide-react'
import Image from 'next/image'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { cardThumbnailSource, isPublicThumbnail } from '@/lib/video-image-source'
import { THUMBNAIL_FALLBACK } from '@/modules/videos/constants'

interface PlaylistThumbnailProps {
  imageUrl?: string | null
  title: string
  videoCount: number
  className?: string
}

export const PlaylistThumbnailSkeleton = () => {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl">
      <Skeleton className="size-full" />
    </div>
  )
}

export const PlaylistThumbnail = ({ imageUrl, title, videoCount, className }: PlaylistThumbnailProps) => {
  const formattedVideoCount = Intl.NumberFormat('zh-CN').format(videoCount)
  const thumbnailSrc = cardThumbnailSource(imageUrl) || THUMBNAIL_FALLBACK

  return (
    <div className={cn('relative pt-3', className)}>
      <div className="relative">
        <div className="absolute -top-3 left-1/2 aspect-video w-[97%] -translate-x-1/2 overflow-hidden rounded-xl bg-black/20" />
        <div className="absolute -top-1.5 left-1/2 aspect-video w-[98.5%] -translate-x-1/2 overflow-hidden rounded-xl bg-black/25" />
        {/*image*/}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl">
          <Image
            src={thumbnailSrc}
            alt={title}
            className="h-full w-full object-cover"
            fill
            unoptimized={!isPublicThumbnail(imageUrl)}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl border border-black/10 dark:border-white/10" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex items-center gap-x-2">
            <PlayIcon className="size-4 fill-white text-white" />
            <span className="text-white">查看列表</span>
          </div>
        </div>
      </div>
      <div
        className={cn(
          'absolute right-2 bottom-2 z-10 flex items-center gap-x-1 rounded-md px-1.5 py-1 text-xs font-medium whitespace-nowrap text-white',
          thumbnailSrc !== THUMBNAIL_FALLBACK &&
            'bg-black/55 shadow-sm ring-1 ring-white/15 backdrop-blur-md transition-[background-color,box-shadow,backdrop-filter] duration-150 group-hover:bg-transparent group-hover:shadow-none group-hover:ring-0 group-hover:backdrop-blur-none'
        )}
      >
        <ListVideoIcon aria-hidden="true" className="size-4 shrink-0" />
        {formattedVideoCount} 个视频
      </div>
    </div>
  )
}
