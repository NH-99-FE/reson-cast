'use client'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { Separator } from '@/components/ui/separator'
import { UserPageBanner, UserPageBannerSkeleton } from '@/modules/users/ui/components/user-page-banner'
import { UserPageInfo, UserPageInfoSkeleton } from '@/modules/users/ui/components/user-page-info'
import { trpc } from '@/trpc/client'

interface UserViewProps {
  userId: string
}

export const UserSection = (props: UserViewProps) => {
  return (
    <Suspense fallback={<UserSectionSkeleton />}>
      <ErrorBoundary fallback={<p>出错了...</p>}>
        <UserSectionSuspense {...props} />
      </ErrorBoundary>
    </Suspense>
  )
}

const UserSectionSkeleton = () => {
  return (
    <div className="flex flex-col">
      <UserPageBannerSkeleton />
      <UserPageInfoSkeleton />
      <Separator />
    </div>
  )
}

export const UserSectionSuspense = ({ userId }: UserViewProps) => {
  const [user] = trpc.users.getOne.useSuspenseQuery({ id: userId })
  return (
    <div className="flex flex-col">
      <UserPageBanner user={user} />
      <UserPageInfo user={user} />
      <Separator />
    </div>
  )
}
