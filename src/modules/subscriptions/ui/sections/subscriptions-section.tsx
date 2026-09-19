'use client'
import Link from 'next/link'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { InfiniteScroll } from '@/components/infinite-scroll'
import { SubscriptionsSkeleton } from '@/components/page-content-skeletons'
import { DEFAULT_LIMIT } from '@/constants'
import { useSubscriptions } from '@/modules/subscriptions/hooks/use-subscription'
import { type SubscriptionAuthor } from '@/modules/subscriptions/lib/sidebar'
import { SubscriptionItem } from '@/modules/subscriptions/ui/components/subscription-item'
import { trpc } from '@/trpc/client'

export const SubscriptionsSection = () => {
  return (
    <Suspense fallback={<SubscriptionsSkeleton />}>
      <ErrorBoundary fallback={<p>出错了</p>}>
        <SubscriptionsSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  )
}

const SubscriptionsSectionSuspense = () => {
  const [subscriptions, query] = trpc.subscriptions.getMany.useSuspenseInfiniteQuery(
    { limit: DEFAULT_LIMIT },
    {
      getNextPageParam: lastPage => lastPage.nextCursor,
    }
  )
  return (
    <>
      <div className="flex flex-col gap-4">
        {subscriptions.pages
          .flatMap(page => page.items)
          .map(subscription => (
            <SubscribedAuthor key={subscription.creatorId} author={subscription.user} />
          ))}
      </div>
      <InfiniteScroll hasNextPage={query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage} />
    </>
  )
}

function SubscribedAuthor({ author }: { author: SubscriptionAuthor & { subscriberCount: number } }) {
  const { onClick, isPending } = useSubscriptions({ author, isSubscribed: true })
  return (
    <Link prefetch href={`/users/${author.id}`}>
      <SubscriptionItem
        name={author.name}
        imageUrl={author.imageUrl}
        subscriberCount={author.subscriberCount}
        onUnsubscribe={onClick}
        disabled={isPending}
      />
    </Link>
  )
}
