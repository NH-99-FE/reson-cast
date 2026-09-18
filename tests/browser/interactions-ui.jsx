import { createRoot } from 'react-dom/client'

import { DEFAULT_LIMIT } from '../../src/constants'
import { CommentItem } from '../../src/modules/comments/ui/components/comment-item'
import { useSubscriptions } from '../../src/modules/subscriptions/hooks/use-subscription'
import { SubscriptionButton } from '../../src/modules/subscriptions/ui/components/subscription-button'
import { VideoReactions } from '../../src/modules/videos/ui/components/video-reactions'
import { Provider, trpc } from './interactions-client'

function Controls() {
  const comments = trpc.comments.getMany.useInfiniteQuery(
    { videoId: 'video', limit: DEFAULT_LIMIT },
    { getNextPageParam: page => page.nextCursor }
  )
  const { data } = trpc.videos.getOne.useQuery({ id: 'video' })
  const subscription = useSubscriptions({ userId: 'creator', fromVideoId: 'video', isSubscribed: data?.user.viewerSubscribed ?? false })
  if (!data) return <p>Loading</p>
  return (
    <>
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
    <Controls />
  </Provider>
)
