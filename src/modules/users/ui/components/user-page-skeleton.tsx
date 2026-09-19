import { VideoGridCardSkeleton } from '@/components/page-content-skeletons'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

import { USER_VIDEOS_GRID_CLASS_NAME, UserPageLayout } from './user-page-layout'

const UserPageInfoSkeleton = () => {
  return (
    <div className="py-6">
      {/* 移动端骨架 */}
      <div className="flex flex-col md:hidden">
        <div className="flex items-center gap-x-5">
          <Skeleton className="h-[60px] w-[60px] rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-6 w-32" />
            <div className="mt-1 flex gap-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>
        <Skeleton className="mt-3 h-10 w-full rounded-full" />
      </div>

      {/* 桌面端骨架 */}
      <div className="hidden items-center gap-5 md:flex">
        <Skeleton className="h-[160px] w-[160px] rounded-full" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-6 w-32" />
          <div className="mt-1 flex gap-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="mt-3 h-10 w-24 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function UserSectionSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="h-[25vh] max-h-[200px] w-full rounded-xl" />
      <UserPageInfoSkeleton />
      <Separator />
    </div>
  )
}

export function UserVideosSkeleton() {
  return (
    <div className={USER_VIDEOS_GRID_CLASS_NAME}>
      {Array.from({ length: 18 }, (_, index) => (
        <VideoGridCardSkeleton key={index} />
      ))}
    </div>
  )
}

export function UserPageSkeleton() {
  return (
    <UserPageLayout role="status" aria-label="正在加载用户主页" aria-busy="true">
      <UserSectionSkeleton />
      <UserVideosSkeleton />
    </UserPageLayout>
  )
}
