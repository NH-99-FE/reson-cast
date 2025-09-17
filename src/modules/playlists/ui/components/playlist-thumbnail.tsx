import { ListVideoIcon, PlayIcon } from 'lucide-react'
import Image from 'next/image'
import { useMemo } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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
  const compactViews = useMemo(() => {
    return Intl.NumberFormat('en', {
      notation: 'compact',
    }).format(videoCount)
  }, [videoCount])

  return (
    <div className={cn('relative pt-3', className)}>
      <div className="relative">
        <div className="absolute -top-3 left-1/2 aspect-video w-[97%] -translate-x-1/2 overflow-hidden rounded-xl bg-black/20" />
        <div className="absolute -top-1.5 left-1/2 aspect-video w-[98.5%] -translate-x-1/2 overflow-hidden rounded-xl bg-black/25" />
        {/*image*/}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl">
          <Image src={imageUrl || THUMBNAIL_FALLBACK} alt={title} className="h-full w-full object-cover" fill />
        </div>
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex items-center gap-x-2">
            <PlayIcon className="size-4 fill-white text-white" />
            <span className="text-white">播放全部</span>
          </div>
        </div>
      </div>
      <div className="bg-block/80 absolute right-2 bottom-2 flex items-center gap-x-1 rounded px-1 py-0.5 text-xs font-medium text-white">
        <ListVideoIcon />
        {compactViews} videos
      </div>
    </div>
  )
}
