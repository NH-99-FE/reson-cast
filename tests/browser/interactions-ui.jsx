import { createRoot } from 'react-dom/client'

import { Sidebar, SidebarContent, SidebarProvider } from '../../src/components/ui/sidebar'
import { DEFAULT_LIMIT } from '../../src/constants'
import { CommentItem } from '../../src/modules/comments/ui/components/comment-item'
import { SubscriptionsSection as SidebarSubscriptions } from '../../src/modules/home/ui/components/home-siderbar/subscriptions-section'
import { useSubscriptions } from '../../src/modules/subscriptions/hooks/use-subscription'
import { SubscriptionButton } from '../../src/modules/subscriptions/ui/components/subscription-button'
import { SubscriptionsSection as FullSubscriptions } from '../../src/modules/subscriptions/ui/sections/subscriptions-section'
import { VideoReactions } from '../../src/modules/videos/ui/components/video-reactions'
import { Provider, trpc } from './interactions-client'

function Controls() {
  const comments = trpc.comments.getMany.useInfiniteQuery(
    { videoId: 'video', limit: DEFAULT_LIMIT },
    { getNextPageParam: page => page.nextCursor }
  )
  const { data } = trpc.videos.getOne.useQuery({ id: 'video' })
  const subscription = useSubscriptions({
    author: data?.user ?? { id: 'creator', name: '新订阅作者', imageUrl: '' },
    fromVideoId: 'video',
    isSubscribed: data?.user.viewerSubscribed ?? false,
  })
  const utils = trpc.useUtils()
  if (!data) return <p>Loading</p>
  return (
    <>
      <button onClick={() => void utils.subscriptions.getSidebar.invalidate()}>刷新侧栏</button>
      <VideoReactions videoId="video" viewerReaction={data.viewerReaction} likes={data.likeCount} dislikes={data.dislikeCount} />
      <SubscriptionButton isSubscribed={data.user.viewerSubscribed} onClick={subscription.onClick} disabled={subscription.isPending} />
      <span data-testid="subscribers">{data.user.subscriberCount}</span>
      {comments.data?.pages
        .flatMap(page => page.items)
        .map(comment => (
          <div key={comment.id} data-testid={comment.id}>
            <CommentItem comment={comment} />
          </div>
        ))}
    </>
  )
}
createRoot(document.getElementById('root')).render(
  <Provider>
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <SidebarSubscriptions />
        </SidebarContent>
      </Sidebar>
      <main className="flex-1 p-8">{new URLSearchParams(window.location.search).has('full') ? <FullSubscriptions /> : <Controls />}</main>
    </SidebarProvider>
  </Provider>
)
