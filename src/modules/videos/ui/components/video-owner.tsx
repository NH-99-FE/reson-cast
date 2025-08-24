import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/modules/studio/ui/components/user-avatar'
import { SubscriptionButton } from '@/modules/subscriptions/ui/components/subscription-button'
import { UserInfo } from '@/modules/users/ui/components/user-info'

import { VideoGetOneOutput } from '../../types'

interface VideoOwnerProps {
  user: VideoGetOneOutput['user']
  videoId: string
}

export const VideoOwner = ({ user, videoId }: VideoOwnerProps) => {
  const { userId: userClerkId } = useAuth()
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 sm:items-start sm:justify-start">
      <Link href={`/users/${user.id}`}>
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar size="lg" imageUrl={user.imageUrl} name={user.name} />
          <div className="flex min-w-0 flex-col gap-1">
            <UserInfo name={user.name} />
            <span className="line-clamp-1 text-sm text-muted-foreground">{0}粉丝数</span>
          </div>
        </div>
      </Link>
      {userClerkId === user.clerkId ? (
        <Button asChild className="rounded-full" variant="secondary">
          <Link href={`/studio/videos/${videoId}`}>编辑视频</Link>
        </Button>
      ) : (
        <SubscriptionButton onClick={() => {}} disabled={false} isSubscribed={false} className="flex-none" />
      )}
    </div>
  )
}
