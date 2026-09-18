'use client'

import { format } from 'date-fns'
import { Globe2Icon, Loader2Icon, LockIcon } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { toast } from 'sonner'

import { InfiniteScroll } from '@/components/infinite-scroll'
import { StudioVideosSkeleton } from '@/components/page-content-skeletons'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DEFAULT_LIMIT } from '@/constants'
import { formatVideoStatus, formatVideoVisiblity } from '@/lib/utils'
import { VideoThumbnail } from '@/modules/videos/ui/components/video-thumbnail'
import { trpc } from '@/trpc/client'

export const VideosSection = () => {
  return (
    <Suspense fallback={<StudioVideosSkeleton />}>
      <ErrorBoundary fallback={<p>出错了...</p>}>
        <VideosSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  )
}

const VideosSectionSuspense = () => {
  const utils = trpc.useUtils()
  const remove = trpc.videos.remove.useMutation({
    onSuccess: () => {
      utils.studio.getMany.invalidate()
      toast.success('删除任务已提交')
    },
    onError: () => {
      utils.studio.getMany.invalidate()
      toast.error('提交失败，请重试')
    },
  })
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
              <TableHead className="text-right">评论量</TableHead>
              <TableHead className="pr-6 text-right">点赞数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.pages
              .flatMap(page => page.items)
              .map(video => (
                <TableRow key={video.id} className="cursor-pointer">
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-4">
                      <div className="relative aspect-video w-36 shrink-0">
                        {!video.deletionRequestedAt && (
                          <Link prefetch href={`/studio/videos/${video.id}`}>
                            <VideoThumbnail
                              imageUrl={video.thumbnailUrl}
                              previewUrl={video.previewUrl}
                              title={video.title}
                              duration={video.duration || 0}
                            />
                          </Link>
                        )}
                      </div>
                      <div className="flex max-w-[300px] flex-col gap-y-1">
                        <span className="truncate text-sm">{video.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{video.description || '还没有介绍'}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {video.visibility === 'private' ? <LockIcon className="size-4" /> : <Globe2Icon className="size-4" />}
                      <span>{formatVideoVisiblity(video.visibility || 'error')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {video.deletionRequestedAt ? (
                      <div className="space-y-2">
                        {video.deletionError ? (
                          <>
                            <p>删除失败</p>
                            <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => remove.mutate({ id: video.id })}>
                              重试删除
                            </Button>
                          </>
                        ) : (
                          <p role="status" className="flex items-center gap-2">
                            正在删除
                            <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
                          </p>
                        )}
                      </div>
                    ) : (
                      formatVideoStatus(video.muxStatus || 'error')
                    )}
                  </TableCell>
                  <TableCell className="truncate text-sm">{format(new Date(video.createdAt), 'd MMM yyyy')}</TableCell>
                  <TableCell className="text-right text-sm">{video.viewCount}</TableCell>
                  <TableCell className="text-right text-sm">{video.commentCount}</TableCell>
                  <TableCell className="pr-6 text-right text-sm">{video.likeCount}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <InfiniteScroll hasNextPage={query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage} />
    </div>
  )
}
