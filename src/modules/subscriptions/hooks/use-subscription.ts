import { useClerk } from '@clerk/nextjs'
import { toast } from 'sonner'

import { trpc } from '@/trpc/client'

import { getSidebarSubscriptions, type SubscriptionAuthor } from '../lib/sidebar'

interface UseSubscriptionProps {
  author: SubscriptionAuthor
  isSubscribed: boolean
  fromVideoId?: string
}

export const useSubscriptions = ({ author, fromVideoId, isSubscribed }: UseSubscriptionProps) => {
  const userId = author.id
  const clerk = useClerk()
  const utils = trpc.useUtils()

  const optimisticallySetSubscription = async (subscribed: boolean) => {
    await Promise.all([
      utils.users.getOne.cancel({ id: userId }),
      utils.subscriptions.getSidebar.cancel(),
      ...(fromVideoId ? [utils.videos.getOne.cancel({ id: fromVideoId })] : []),
    ])
    const previousUser = utils.users.getOne.getData({ id: userId })
    const previousVideo = fromVideoId ? utils.videos.getOne.getData({ id: fromVideoId }) : undefined
    const update = <T extends { viewerSubscribed: boolean; subscriberCount: number }>(user: T): T => ({
      ...user,
      viewerSubscribed: subscribed,
      subscriberCount: Math.max(0, user.subscriberCount + Number(subscribed) - Number(user.viewerSubscribed)),
    })
    utils.users.getOne.setData({ id: userId }, user => user && update(user))
    if (fromVideoId) {
      utils.videos.getOne.setData({ id: fromVideoId }, video => video && { ...video, user: update(video.user) })
    }
    return { previousUser, previousVideo }
  }
  const rollback = (context: Awaited<ReturnType<typeof optimisticallySetSubscription>> | undefined) => {
    if (context?.previousUser) utils.users.getOne.setData({ id: userId }, context.previousUser)
    const previous = context?.previousVideo?.user
    if (fromVideoId && previous)
      utils.videos.getOne.setData(
        { id: fromVideoId },
        current =>
          current && {
            ...current,
            user: { ...current.user, viewerSubscribed: previous.viewerSubscribed, subscriberCount: previous.subscriberCount },
          }
      )
  }
  const reconcile = () =>
    Promise.all([
      utils.videos.getManySubscribed.invalidate(),
      utils.users.getOne.invalidate({ id: userId }),
      utils.subscriptions.getMany.invalidate(),
      utils.subscriptions.getSidebar.invalidate(),
    ])

  const subscribe = trpc.subscriptions.create.useMutation({
    meta: { videoInteraction: fromVideoId, subscriptionChange: { author, subscribed: true } },
    onMutate: () => optimisticallySetSubscription(true),
    onSuccess: () => {
      // Keep the confirmed author even if the sidebar has never loaded.
      // Reconciliation will fill the remaining entries when reads recover.
      utils.subscriptions.getSidebar.setData(undefined, current => getSidebarSubscriptions(current ?? [], [{ author, subscribed: true }]))
      toast.success('关注成功')
    },
    onSettled: reconcile,
    onError: (error, _input, context) => {
      rollback(context)
      toast.error('关注失败')
      if (error.data?.code === 'UNAUTHORIZED') clerk.openSignIn()
    },
  })
  const unsubscribe = trpc.subscriptions.remove.useMutation({
    meta: { videoInteraction: fromVideoId, subscriptionChange: { author, subscribed: false } },
    onMutate: () => optimisticallySetSubscription(false),
    onSuccess: () => {
      utils.subscriptions.getSidebar.setData(
        undefined,
        current => current && getSidebarSubscriptions(current, [{ author, subscribed: false }])
      )
      toast.success('取关成功')
    },
    onSettled: reconcile,
    onError: (error, _input, context) => {
      rollback(context)
      toast.error('取关失败')
      if (error.data?.code === 'UNAUTHORIZED') clerk.openSignIn()
    },
  })
  const isPending = subscribe.isPending || unsubscribe.isPending
  const onClick = () => {
    if (isPending) return
    if (isSubscribed) unsubscribe.mutate({ userId })
    else subscribe.mutate({ userId })
  }
  return { isPending, onClick }
}
