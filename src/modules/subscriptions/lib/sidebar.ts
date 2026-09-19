export const SIDEBAR_SUBSCRIPTIONS_LIMIT = 5
export const SIDEBAR_SUBSCRIPTIONS_STALE_TIME = 5 * 60 * 1000

export interface SubscriptionAuthor {
  id: string
  name: string
  imageUrl: string
}

export interface SubscriptionChange {
  author: SubscriptionAuthor
  subscribed: boolean
}

// Apply pending operations to a server snapshot without overwriting other
// authors' optimistic changes when one operation fails.
export function getSidebarSubscriptions(authors: SubscriptionAuthor[], changes: SubscriptionChange[]) {
  let result = authors
  for (const { author, subscribed } of changes) {
    result = result.filter(item => item.id !== author.id)
    if (subscribed) result = [author, ...result]
  }
  return result.slice(0, SIDEBAR_SUBSCRIPTIONS_LIMIT)
}
