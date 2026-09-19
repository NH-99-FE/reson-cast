'use client'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { InfiniteScroll } from '@/components/infinite-scroll'
import { DEFAULT_LIMIT } from '@/constants'
import { USER_VIDEOS_GRID_CLASS_NAME } from '@/modules/users/ui/components/user-page-layout'
import { UserVideosSkeleton } from '@/modules/users/ui/components/user-page-skeleton'
import { VideoGridCard } from '@/modules/videos/ui/components/video-grid-card'
import { trpc } from '@/trpc/client'

interface VideosSectionProps {
  userId: string
}

export const VideosSection = (props: VideosSectionProps) => {
  return (
    <Suspense fallback={<UserVideosSkeleton />}>
      <ErrorBoundary fallback={<p>出错了</p>}>
        <VideosSectionSuspense {...props} />
      </ErrorBoundary>
    </Suspense>
  )
}

export const VideosSectionSuspense = ({ userId }: VideosSectionProps) => {
  const [videos, query] = trpc.videos.getMany.useSuspenseInfiniteQuery(
    { userId, limit: DEFAULT_LIMIT },
    {
      getNextPageParam: lastPage => lastPage.nextCursor,
    }
  )
  return (
    <div>
      <div className={USER_VIDEOS_GRID_CLASS_NAME}>
        {videos.pages
          .flatMap(page => page.items)
          .map(video => (
            <VideoGridCard key={video.id} data={video}></VideoGridCard>
          ))}
      </div>
      <InfiniteScroll hasNextPage={query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage} />
    </div>
  )
}
