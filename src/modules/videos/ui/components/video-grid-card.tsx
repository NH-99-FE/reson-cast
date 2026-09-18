import Link from 'next/link'

import { videoThumbnailSource } from '@/lib/video-image-source'
import { VideoGetManyOutput } from '@/modules/videos/types'
import { VideoThumbnail, VideoThumbnailSkeleton } from '@/modules/videos/ui/components/video-thumbnail'

import { VideoInfo, VideoInfoSkeleton } from './video-info'

interface VideoGridCardProps {
  data: VideoGetManyOutput['items'][number]
  onRemove?: () => void
  priority?: boolean
}

export const VideoGridCardSkeleton = () => {
  return (
    <div className="flex w-full flex-col gap-2">
      <VideoThumbnailSkeleton />
      <VideoInfoSkeleton />
    </div>
  )
}

export const VideoGridCard = ({ data, onRemove, priority = false }: VideoGridCardProps) => {
  return (
    <div className="group flex w-full flex-col gap-2">
      <Link prefetch href={`/videos/${data.id}`}>
        <VideoThumbnail
          imageUrl={videoThumbnailSource(data)}
          previewUrl={data.previewUrl}
          title={data.title}
          duration={data.duration}
          priority={priority}
        />
      </Link>
      <VideoInfo data={data} onRemove={onRemove} />
    </div>
  )
}
