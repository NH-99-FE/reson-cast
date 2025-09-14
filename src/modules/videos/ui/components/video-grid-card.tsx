import Link from 'next/link'

import { VideoGetManyOutput } from '@/modules/videos/types'
import { VideoThumbnail, VideoThumbnailSkeleton } from '@/modules/videos/ui/components/video-thumbnail'

import { VideoInfo, VideoInfoSkeleton } from './video-info'

interface VideoGridCardProps {
  data: VideoGetManyOutput['items'][number]
  onRemove?: () => void
}

export const VideoGridCardSkeleton = () => {
  return (
    <div className="flex w-full flex-col gap-2">
      <VideoThumbnailSkeleton />
      <VideoInfoSkeleton />
    </div>
  )
}

export const VideoGridCard = ({ data, onRemove }: VideoGridCardProps) => {
  return (
    <div className="group flex w-full flex-col gap-2">
      <Link href={`/videos/${data.id}`}>
        <VideoThumbnail imageUrl={data.thumbnailUrl} previewUrl={data.previewUrl} title={data.title} duration={data.duration} />
      </Link>
      <VideoInfo data={data} onRemove={onRemove} />
    </div>
  )
}
