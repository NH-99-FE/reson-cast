import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const VideoThumbnailSkeleton = () => {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl">
      <Skeleton className="size-full" />
    </div>
  )
}

const VideoInfoSkeleton = () => {
  return (
    <div className="flex gap-3">
      <Skeleton className="size-10 flex-shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-5 w-[90%]" />
        <Skeleton className="h-4 w-[30%]" />
        <Skeleton className="h-4 w-[40%]" />
      </div>
    </div>
  )
}

export const VideoGridCardSkeleton = () => {
  return (
    <div className="flex w-full flex-col gap-2">
      <VideoThumbnailSkeleton />
      <VideoInfoSkeleton />
    </div>
  )
}

const SubscriptionItemSkeleton = () => {
  return (
    <div className="flex items-start gap-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
      </div>
    </div>
  )
}

const CompactVideoRowSkeleton = () => (
  <div className="flex min-w-0 gap-2">
    <div className="relative w-[168px] flex-none">
      <VideoThumbnailSkeleton />
    </div>
    <div className="min-w-0 flex-1">
      <Skeleton className="h-4 w-[80%]" />
      <Skeleton className="mt-1 h-4 w-[20%]" />
      <div className="flex gap-1">
        <Skeleton className="mt-1 h-4 w-16" />
        <Skeleton className="mt-1 h-4 w-16" />
      </div>
    </div>
  </div>
)
const PlaylistGridCardSkeleton = () => (
  <div className="flex w-full flex-col gap-2">
    <VideoThumbnailSkeleton />
    <div className="flex gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-4 w-[40%]" />
        <Skeleton className="h-4 w-[30%]" />
      </div>
    </div>
  </div>
)
export const CategoryStripSkeleton = () => (
  <div className="w-full overflow-hidden px-12" aria-hidden="true">
    <div className="flex gap-3">
      {Array.from({ length: 30 }, (_, index) => (
        <Skeleton key={index} className="h-[30px] w-[70px] shrink-0 rounded-lg" />
      ))}
    </div>
  </div>
)

export const VideoGridSkeleton = () => {
  return (
    <div className="[@media(min-width:1920px):grid-col-5] [@media(min-width:2200px):grid-col-6] grid grid-cols-1 gap-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 18 }).map((_, index) => (
        <VideoGridCardSkeleton key={index} />
      ))}
    </div>
  )
}

export const VideoListSkeleton = () => {
  return (
    <>
      <div className="flex flex-col gap-4 gap-y-10 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <VideoGridCardSkeleton key={index} />
        ))}
      </div>
      <div className="hidden flex-col gap-4 md:flex">
        {Array.from({ length: 10 }).map((_, index) => (
          <CompactVideoRowSkeleton key={index} />
        ))}
      </div>
    </>
  )
}

export const PlaylistsSkeleton = () => {
  return (
    <div className="[@media(min-width:1920px):grid-col-5] [@media(min-width:2200px):grid-col-6] grid grid-cols-1 gap-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 18 }).map((_, index) => (
        <PlaylistGridCardSkeleton key={index} />
      ))}
    </div>
  )
}

export const SubscriptionsSkeleton = () => {
  return (
    <>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 15 }).map((_, index) => (
          <SubscriptionItemSkeleton key={index} />
        ))}
      </div>
    </>
  )
}

export const StudioVideosSkeleton = () => {
  return (
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
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell className="pl-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-20 w-36 rounded-xl" />
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-[100px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-10" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-18" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-10" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-10" />
              </TableCell>
              <TableCell className="pr-6 text-right">
                <Skeleton className="ml-auto h-4 w-10" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
