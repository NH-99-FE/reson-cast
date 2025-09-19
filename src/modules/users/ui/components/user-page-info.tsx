import { useAuth, useClerk } from '@clerk/nextjs'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/modules/studio/ui/components/user-avatar'
import { useSubscriptions } from '@/modules/subscriptions/hooks/use-subscription'
import { SubscriptionButton } from '@/modules/subscriptions/ui/components/subscription-button'
import { userGetOneOutput } from '@/modules/users/types'

interface UserPageBannerProps {
  user: userGetOneOutput
}

export const UserPageInfoSkeleton = () => {
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

export const UserPageInfo = ({ user }: UserPageBannerProps) => {
  const { userId: userClerkId, isLoaded } = useAuth()
  const clerk = useClerk()

  const { isPending, onClick } = useSubscriptions({
    userId: user.id,
    isSubscribed: user.viewerSubscribed,
  })

  return (
    <div className="py-6">
      {/*移动端布局*/}
      <div className="flex flex-col md:hidden">
        <div className="flex items-center gap-x-5">
          <UserAvatar
            size="lg"
            imageUrl={user.imageUrl}
            name={user.name}
            className="h-[60px] w-[60px]"
            onClick={() => {
              if (user.clerkId === userClerkId) {
                clerk.openUserProfile()
              }
            }}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{user.name}</h1>
            <div className="item-center mt-1 flex gap-1 text-xs text-muted-foreground">
              <span>{user.subscriberCount} 订阅</span>
              <span>&bull;</span>
              <span>{user.videoCount} 视频</span>
            </div>
          </div>
        </div>
        {userClerkId === user.clerkId ? (
          <Button asChild variant="secondary" type="button" className="mt-3 w-full rounded-full" onClick={() => {}}>
            <Link prefetch href="/studio">
              去工作室
            </Link>
          </Button>
        ) : (
          <SubscriptionButton
            className="mt-3 w-full"
            onClick={onClick}
            disabled={isPending || !isLoaded}
            isSubscribed={user.viewerSubscribed}
          />
        )}
      </div>
      {/*桌面端布局*/}
      <div className="hidden items-center gap-5 md:flex">
        <UserAvatar
          size="xl"
          imageUrl={user.imageUrl}
          name={user.name}
          className={cn(userClerkId === user.clerkId && 'cursor-pointer hover:opacity-80')}
          onClick={() => {
            if (user.clerkId === userClerkId) {
              clerk.openUserProfile()
            }
          }}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">{user.name}</h1>
          <div className="item-center mt-1 flex gap-1 text-xs text-muted-foreground">
            <span>{user.subscriberCount} 订阅</span>
            <span>&bull;</span>
            <span>{user.videoCount} 视频</span>
          </div>
          {userClerkId === user.clerkId ? (
            <Button asChild variant="secondary" type="button" className="mt-3 rounded-full" onClick={() => {}}>
              <Link prefetch href="/studio">
                去工作室
              </Link>
            </Button>
          ) : (
            <SubscriptionButton className="mt-3" onClick={onClick} disabled={isPending || !isLoaded} isSubscribed={user.viewerSubscribed} />
          )}
        </div>
      </div>
    </div>
  )
}
