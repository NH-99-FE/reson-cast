import { format } from 'date-fns'
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow'
import { useMemo } from 'react'

import { VideoGetOneOutput } from '@/modules/videos/types'

import { VideoDescription } from './video-description'
import { VideoMenu } from './video-menu'
import { VideoOwner } from './video-owner'
import { VideoReactions } from './video-reactions'
interface VideoTopRowProps {
  video: VideoGetOneOutput
}

export const VideoTopRow = ({ video }: VideoTopRowProps) => {
  const compactViews = useMemo(() => {
    return Intl.NumberFormat('en', {
      notation: 'compact',
    }).format(video.viewCount)
  }, [video.viewCount])

  const expandedViews = useMemo(() => {
    return Intl.NumberFormat('en', {
      notation: 'standard',
    }).format(video.viewCount)
  }, [video.viewCount])

  const compactDate = useMemo(() => {
    return formatDistanceToNow(video.createdAt, { addSuffix: true })
  }, [video.createdAt])

  const expandDate = useMemo(() => {
    return format(video.createdAt, 'd MMM yyyy')
  }, [video.createdAt])
  return (
    <div className="mt-4 flex flex-col gap-4">
      <h1 className="text-xl font-medium">{video.title}</h1>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <VideoOwner user={video.user} videoId={video.id} />
        <div className="-mb-2 flex gap-2 overflow-x-auto pb-2 sm:mb-0 sm:min-w-[calc(50%-6px)] sm:justify-end sm:overflow-visible">
          <VideoReactions />
          <VideoMenu videoId={video.id} variant="secondary" />
        </div>
      </div>
      <VideoDescription
        description={video.description}
        compactViews={compactViews}
        expandedViews={expandedViews}
        expandedDate={expandDate}
        compactDate={compactDate}
      />
    </div>
  )
}
