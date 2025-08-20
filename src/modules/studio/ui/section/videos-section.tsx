'use client'

import { format } from 'date-fns'
import { Globe2Icon, LockIcon } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { InfiniteScroll } from '@/components/infinite-scroll'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DEFAULT_LIMIT } from '@/constants'
import { formatVideoStatus, formatVideoVisiblity } from '@/lib/utils'
import { VideoThumbnail } from '@/modules/videos/ui/components/video-thumbnail'
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
                <TableRow key={video.id} className="cursor-pointer">
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <div className="relative aspect-video w-36 shrink-0">
                        <Link href={`/studio/videos/${video.id}`}>
                          <VideoThumbnail
                            imageUrl={video.thumbnailUrl}
                            previewUrl={video.previewUrl}
                            title={video.title}
                            duration={video.duration || 0}
                          />
                        </Link>
                      </div>
                      <div className="flex flex-col gap-y-1 overflow-hidden">
                        <span className="line-clamp-1 text-sm">{video.title}</span>
                        <span className="line-clamp-1 text-xs text-muted-foreground">{video.description || '还没有介绍'}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {video.visibility === 'private' ? <LockIcon className="size-4" /> : <Globe2Icon className="size-4" />}
                      <span>{formatVideoVisiblity(video.visibility || 'error')}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatVideoStatus(video.muxStatus || 'error')}</TableCell>
                  <TableCell className="truncate text-sm">{format(new Date(video.createdAt), 'd MMM yyyy')}</TableCell>
                  <TableCell>{video.title}</TableCell>
                  <TableCell>{video.title}</TableCell>
                  <TableCell>{video.title}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <InfiniteScroll hasNextPage={query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage} />
    </div>
  )
}
