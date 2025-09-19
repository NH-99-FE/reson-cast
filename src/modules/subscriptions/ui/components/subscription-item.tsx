import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/modules/studio/ui/components/user-avatar'
import { SubscriptionButton } from '@/modules/subscriptions/ui/components/subscription-button'

interface SubscriptionItemProps {
  name: string
  imageUrl: string
  subscriberCount: number
  onUnsubscribe: () => void
  disabled: boolean
}

export const SubscriptionItemSkeleton = () => {
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

export const SubscriptionItem = ({ name, imageUrl, subscriberCount, disabled, onUnsubscribe }: SubscriptionItemProps) => {
  return (
    <div className="flex items-start gap-4">
      <UserAvatar size="lg" name={name} imageUrl={imageUrl} />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm">{name}</h3>
            <p className="text-xs text-muted-foreground">{subscriberCount.toLocaleString()} 关注</p>
          </div>
          <SubscriptionButton
            size="sm"
            onClick={e => {
              e.preventDefault()
              onUnsubscribe()
            }}
            disabled={disabled}
            isSubscribed
          />
        </div>
      </div>
    </div>
  )
}
