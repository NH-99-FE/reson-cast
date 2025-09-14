'use client'

import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { InfiniteScroll } from '@/components/infinite-scroll'
import { DEFAULT_LIMIT } from '@/constants'
import { VideoGridCard, VideoGridCardSkeleton } from '@/modules/videos/ui/components/video-grid-card'
import { VideoRowCard, VideoRowCardSkeleton } from '@/modules/videos/ui/components/video-row-card'
import { trpc } from '@/trpc/client'

interface SuggestionsProps {
  videoId: string
  isManual?: boolean
}

export const SuggestionsSection = ({ isManual, videoId }: SuggestionsProps) => {
  return (
    <Suspense fallback={<SuggestionsSectionSkeleton />}>
      <ErrorBoundary fallback={<p>出错了</p>}>
        <SuggestionsSectionSuspense videoId={videoId} isManual={isManual} />
      </ErrorBoundary>
    </Suspense>
  )
}

const SuggestionsSectionSkeleton = () => {
  return (
    <>
      <div className="hidden space-y-3 md:block">
        {Array.from({ length: 8 }).map((_, index) => (
          <VideoRowCardSkeleton key={index} size="compact" />
        ))}
      </div>
      <div className="block space-y-10 md:hidden">
        {Array.from({ length: 8 }).map((_, index) => (
          <VideoGridCardSkeleton key={index} />
        ))}
      </div>
    </>
  )
}

const SuggestionsSectionSuspense = ({ isManual, videoId }: SuggestionsProps) => {
  const [suggestions, query] = trpc.suggestions.getMany.useSuspenseInfiniteQuery(
    {
      videoId,
      limit: DEFAULT_LIMIT,
    },
    {
      getNextPageParam: lastPage => lastPage.nextCursor,
    }
  )
  return (
    <>
      <div className="hidden space-y-3 md:block">
        {suggestions.pages.flatMap(page =>
          page.items.map(video => <VideoRowCard key={video.id} data={video} size="compact" onRemove={() => {}} />)
        )}
      </div>
      <div className={'block space-y-10 md:hidden'}>
        {suggestions.pages.flatMap(page => page.items.map(video => <VideoGridCard key={video.id} data={video} />))}
      </div>
      <InfiniteScroll
        isManual={isManual}
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
      />
    </>
  )
}
