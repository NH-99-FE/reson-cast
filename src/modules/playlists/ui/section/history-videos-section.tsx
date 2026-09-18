'use client'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { InfiniteScroll } from '@/components/infinite-scroll'
import { VideoListSkeleton } from '@/components/page-content-skeletons'
import { DEFAULT_LIMIT } from '@/constants'
import { VideoGridCard } from '@/modules/videos/ui/components/video-grid-card'
import { VideoRowCard } from '@/modules/videos/ui/components/video-row-card'
import { trpc } from '@/trpc/client'

export const HistoryVideosSection = () => {
  return (
    <Suspense fallback={<VideoListSkeleton />}>
      <ErrorBoundary fallback={<p>出错了</p>}>
        <HistoryVideosSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  )
}

const HistoryVideosSectionSuspense = () => {
  const [videos, query] = trpc.playlists.getHistory.useSuspenseInfiniteQuery(
    { limit: DEFAULT_LIMIT },
    {
      getNextPageParam: lastPage => lastPage.nextCursor,
    }
  )
  return (
    <>
      <div className="flex flex-col gap-4 gap-y-10 md:hidden">
        {videos.pages
          .flatMap(page => page.items)
          .map(video => (
            <VideoGridCard key={video.id} data={video}></VideoGridCard>
          ))}
      </div>
      <div className="hidden flex-col gap-4 md:flex">
        {videos.pages
          .flatMap(page => page.items)
          .map(video => (
            <VideoRowCard key={video.id} data={video} size="compact"></VideoRowCard>
          ))}
      </div>
      <InfiniteScroll hasNextPage={query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage} />
    </>
  )
}
