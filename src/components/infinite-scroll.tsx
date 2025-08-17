import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { useIntersectionObserver } from '@/hooks/use-intersectionObserver'

interface InfiniteScrollProps {
  isManual?: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}

export const InfiniteScroll = ({ isManual = false, hasNextPage, isFetchingNextPage, fetchNextPage }: InfiniteScrollProps) => {
  const { targetRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.5,
    rootMargin: '100px',
  })

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage && !isManual) {
      fetchNextPage()
    }
  }, [isIntersecting, hasNextPage, fetchNextPage, isFetchingNextPage, isManual])

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div ref={targetRef} className="h-1">
        {hasNextPage ? (
          <Button variant={'secondary'} disabled={!hasNextPage || isFetchingNextPage} onClick={() => fetchNextPage()}>
            {isFetchingNextPage ? '加载中...' : '加载更多'}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">已经到底了</p>
        )}
      </div>
    </div>
  )
}
