import { CornerDownRightIcon, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DEFAULT_LIMIT } from '@/constants'
import { CommentItem } from '@/modules/comments/ui/components/comment-item'
import { trpc } from '@/trpc/client'

interface CommentRepliesProps {
  parentId: string
  videoId: string
}

export const CommentReplies = ({ parentId, videoId }: CommentRepliesProps) => {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = trpc.comments.getMany.useInfiniteQuery(
    {
      limit: DEFAULT_LIMIT,
      videoId,
      parentId,
    },
    {
      getNextPageParam: lastPage => lastPage.nextCursor,
    }
  )
  return (
    <div className="pl-14">
      <div>
        {isLoading && (
          <div className="flex-center flex justify-center">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading &&
          data?.pages.flatMap(page => page.items).map(comment => <CommentItem key={comment.id} comment={comment} variant="reply" />)}
      </div>
      {hasNextPage && (
        <Button variant="tertiary" className="rounded-full" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          显示更多
          <CornerDownRightIcon />
        </Button>
      )}
    </div>
  )
}
