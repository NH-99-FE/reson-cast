import { useClerk } from '@clerk/nextjs'
import { toast } from 'sonner'

import { trpc } from '@/trpc/client'

interface UseSubscriptionProps {
  userId: string
  isSubscribed: boolean
  fromVideoId?: string
}

export const useSubscriptions = ({ userId, fromVideoId, isSubscribed }: UseSubscriptionProps) => {
  const clerk = useClerk()
  const utils = trpc.useUtils()

  const subscribe = trpc.subscriptions.create.useMutation({
    onSuccess: () => {
      toast.success('关注成功')
      utils.videos.getManySubscribed.invalidate()
      if (fromVideoId) {
        utils.videos.getOne.invalidate({ id: fromVideoId })
      }
    },
    onError: error => {
      toast.error('关注失败')
      if (error.data?.code === 'UNAUTHORIZED') {
        clerk.openSignIn()
      }
    },
  })

  const unsubscribe = trpc.subscriptions.remove.useMutation({
    onSuccess: () => {
      toast.success('取关成功')
      utils.videos.getManySubscribed.invalidate()
      if (fromVideoId) {
        utils.videos.getOne.invalidate({ id: fromVideoId })
      }
    },
    onError: error => {
      toast.error('取关失败')
      if (error.data?.code === 'UNAUTHORIZED') {
        clerk.openSignIn()
      }
    },
  })
  const isPending = subscribe.isPending || unsubscribe.isPending
  const onClick = () => {
    if (isSubscribed) {
      unsubscribe.mutate({ userId })
    } else {
      subscribe.mutate({ userId })
    }
  }

  return {
    isPending,
    onClick,
  }
}
