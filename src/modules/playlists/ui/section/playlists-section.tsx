'use client'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { InfiniteScroll } from '@/components/infinite-scroll'
import { PlaylistsSkeleton } from '@/components/page-content-skeletons'
import { Button } from '@/components/ui/button'
import { DEFAULT_LIMIT } from '@/constants'
import { PlaylistEmptyState } from '@/modules/playlists/ui/components/playlist-empty-state'
import { PlaylistGridCard } from '@/modules/playlists/ui/section/playlist-grid-card'
import { trpc } from '@/trpc/client'

interface PlaylistsSectionProps {
  onCreate: () => void
}

export const PlaylistsSection = ({ onCreate }: PlaylistsSectionProps) => {
  return (
    <Suspense fallback={<PlaylistsSkeleton />}>
      <ErrorBoundary fallback={<p>出错了</p>}>
        <PlaylistsSectionSuspense onCreate={onCreate} />
      </ErrorBoundary>
    </Suspense>
  )
}

const PlaylistsSectionSuspense = ({ onCreate }: PlaylistsSectionProps) => {
  const [playlists, query] = trpc.playlists.getMany.useSuspenseInfiniteQuery(
    { limit: DEFAULT_LIMIT },
    {
      getNextPageParam: lastPage => lastPage.nextCursor,
    }
  )
  const items = playlists.pages.flatMap(page => page.items)

  if (items.length === 0 && !query.hasNextPage) {
    return (
      <PlaylistEmptyState title="还没有播放列表" description="创建一个列表，把喜欢的视频收在一起。">
        <Button className="rounded-full" onClick={onCreate}>
          创建播放列表
        </Button>
      </PlaylistEmptyState>
    )
  }

  return (
    <>
      <div className="[@media(min-width:1920px):grid-col-5] [@media(min-width:2200px):grid-col-6] grid grid-cols-1 gap-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
        {items.map(playlist => (
          <PlaylistGridCard key={playlist.id} data={playlist} />
        ))}
      </div>
      <InfiniteScroll hasNextPage={query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage} />
    </>
  )
}
