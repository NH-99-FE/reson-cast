'use client'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { InfiniteScroll } from '@/components/infinite-scroll'
import { DEFAULT_LIMIT } from '@/constants'
import { PlaylistGridCard, PlaylistGridCardSkeleton } from '@/modules/playlists/ui/section/playlist-grid-card'
import { trpc } from '@/trpc/client'

export const PlaylistsSection = () => {
  return (
    <Suspense fallback={<PlaylistsSectionSkeleton />}>
      <ErrorBoundary fallback={<p>出错了</p>}>
        <PlaylistsSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  )
}

const PlaylistsSectionSkeleton = () => {
  return (
    <div className="[@media(min-width:1920px):grid-col-5] [@media(min-width:2200px):grid-col-6] grid grid-cols-1 gap-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 18 }).map((_, index) => (
        <PlaylistGridCardSkeleton key={index} />
      ))}
    </div>
  )
}

const PlaylistsSectionSuspense = () => {
  const [playlists, query] = trpc.playlists.getMany.useSuspenseInfiniteQuery(
    { limit: DEFAULT_LIMIT },
    {
      getNextPageParam: lastPage => lastPage.nextCursor,
    }
  )
  return (
    <>
      <div className="[@media(min-width:1920px):grid-col-5] [@media(min-width:2200px):grid-col-6] grid grid-cols-1 gap-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
        {playlists.pages
          .flatMap(page => page.items)
          .map(playlist => (
            <PlaylistGridCard key={playlist.id} data={playlist} />
          ))}
      </div>
      <InfiniteScroll hasNextPage={query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage} />
    </>
  )
}
