'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { InfiniteScroll } from '@/components/infinite-scroll'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DEFAULT_LIMIT } from '@/constants'
import { trpc } from '@/trpc/client'

export const VideosSection = () => {
  return (
    <Suspense fallback={<p>加载中...</p>}>
      <ErrorBoundary fallback={<p>出错了...</p>}>
        <VideosSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  )
}

const VideosSectionSuspense = () => {
  const [videos, query] = trpc.studio.getMany.useSuspenseInfiniteQuery(
    {
      limit: DEFAULT_LIMIT,
    },
    {
      getNextPageParam: lastPage => lastPage.nextCursor,
    }
  )
  return (
    <div>
      <div className="border-y">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[510px] pl-6">视频</TableHead>
              <TableHead>谁可以看</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>日期</TableHead>
              <TableHead className="text-right">浏览量</TableHead>
              <TableHead className="text-right">评论</TableHead>
              <TableHead className="pr-6 text-right">点赞</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.pages
              .flatMap(page => page.items)
              .map(video => (
                <Link href={`/studio/videos/${video.id}`} key={video.id} legacyBehavior>
                  <TableRow className="cursor-pointer">
                    <TableCell>{video.title}</TableCell>
                    <TableCell>{video.title}</TableCell>
                    <TableCell>{video.title}</TableCell>
                    <TableCell>{video.title}</TableCell>
                    <TableCell>{video.title}</TableCell>
                    <TableCell>{video.title}</TableCell>
                    <TableCell>{video.title}</TableCell>
                  </TableRow>
                </Link>
              ))}
          </TableBody>
        </Table>
      </div>
      <InfiniteScroll hasNextPage={query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage} />
    </div>
  )
}
