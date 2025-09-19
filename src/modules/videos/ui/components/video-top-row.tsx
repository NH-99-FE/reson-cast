import { format } from 'date-fns'
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow'
import { useMemo } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { VideoGetOneOutput } from '@/modules/videos/types'

import { VideoDescription } from './video-description'
import { VideoMenu } from './video-menu'
import { VideoOwner } from './video-owner'
import { VideoReactions } from './video-reactions'
interface VideoTopRowProps {
  video: VideoGetOneOutput
}

export const VideoTopRowSkeleton = () => {
  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Title skeleton */}
      <Skeleton className="h-7 w-3/4 md:w-2/5" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Video owner skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>

        {/* Actions skeleton */}
        <div className="-mb-2 flex gap-2 overflow-x-auto pb-2 sm:mb-0 sm:min-w-[calc(50%-6px)] sm:justify-end sm:overflow-visible">
          {/* Reactions skeleton */}
          <div className="flex">
            <Skeleton className="h-9 w-16 rounded-l-full" />
            <Skeleton className="h-9 w-16 rounded-r-full" />
          </div>
          {/* Menu skeleton */}
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>

      {/* Video description skeleton */}
      <div className="rounded-xl bg-secondary/50 p-3">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="mt-2">
          <Skeleton className="h-4 w-full" />
          <div className="mt-2 flex items-center gap-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  )
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
          <VideoReactions videoId={video.id} likes={video.likeCount} dislikes={video.dislikeCount} viewerReaction={video.viewerReaction} />
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
