import { useAuth, useClerk } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow'
import { ChevronDownIcon, ChevronUpIcon, MessageSquareIcon, MoreVerticalIcon, ThumbsDownIcon, ThumbsUpIcon, Trash2Icon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DEFAULT_LIMIT } from '@/constants'
import { toggleReaction } from '@/lib/optimistic-reaction'
import { cn } from '@/lib/utils'
import { CommentsGetManyOutput } from '@/modules/comments/types'
import { CommentForm } from '@/modules/comments/ui/components/comment-form'
import { CommentReplies } from '@/modules/comments/ui/components/comment-replies'
import { UserAvatar } from '@/modules/studio/ui/components/user-avatar'
import { trpc } from '@/trpc/client'

interface CommentItemProps {
  comment: CommentsGetManyOutput['items'][number]
  variant?: 'reply' | 'comment'
}

export const CommentItem = ({ comment, variant = 'comment' }: CommentItemProps) => {
  const clerk = useClerk()
  const utils = trpc.useUtils()
  const queryClient = useQueryClient()
  const { userId: userClerkId } = useAuth()

  const [isReplyOpen, setIsReplyOpen] = useState(false)
  const [isRepliesOpen, setIsRepliesOpen] = useState(false)

  const remove = trpc.comments.remove.useMutation({
    onSuccess: () => {
      toast.success('删除完成')
      utils.comments.getMany.invalidate({ videoId: comment.videoId })
    },
    onError: error => {
      toast.error('出错了')
      if (error.data?.code === 'UNAUTHORIZED') {
        clerk.openSignIn()
      }
    },
  })
  const reactionInput = { videoId: comment.videoId, parentId: comment.parentId ?? undefined, limit: DEFAULT_LIMIT }
  const optimisticReaction = async (action: 'like' | 'dislike') => {
    await utils.comments.getMany.cancel(reactionInput)
    const previous = utils.comments.getMany
      .getInfiniteData(reactionInput)
      ?.pages.flatMap(page => page.items)
      .find(item => item.id === comment.id)
    utils.comments.getMany.setInfiniteData(
      reactionInput,
      data =>
        data && {
          ...data,
          pages: data.pages.map(page => ({
            ...page,
            items: page.items.map(item => (item.id === comment.id ? { ...item, ...toggleReaction(item, action) } : item)),
          })),
        }
    )
    return { previous }
  }
  const rollbackReaction = (context: Awaited<ReturnType<typeof optimisticReaction>> | undefined) => {
    const previous = context?.previous
    if (!previous) return
    // Restore only this comment so other in-flight reactions are preserved.
    utils.comments.getMany.setInfiniteData(
      reactionInput,
      data =>
        data && {
          ...data,
          pages: data.pages.map(page => ({
            ...page,
            items: page.items.map(item =>
              item.id === comment.id
                ? {
                    ...item,
                    viewerReaction: previous.viewerReaction,
                    likeCount: previous.likeCount,
                    dislikeCount: previous.dislikeCount,
                  }
                : item
            ),
          })),
        }
    )
  }
  const like = trpc.commentReactions.like.useMutation({
    meta: { commentReactionVideoId: comment.videoId },
    onMutate: () => optimisticReaction('like'),
    onSettled: () => {
      // The shared list must not refetch over another comment's optimistic state.
      if (queryClient.isMutating({ predicate: mutation => mutation.options.meta?.commentReactionVideoId === comment.videoId }) === 1) {
        return utils.comments.getMany.invalidate({ videoId: comment.videoId })
      }
    },
    onError: (error, _input, context) => {
      rollbackReaction(context)
      toast.error('出错了')
      if (error.data?.code === 'UNAUTHORIZED') {
        clerk.openSignIn()
      }
    },
  })
  const dislike = trpc.commentReactions.dislike.useMutation({
    meta: { commentReactionVideoId: comment.videoId },
    onMutate: () => optimisticReaction('dislike'),
    onSettled: () => {
      // The shared list must not refetch over another comment's optimistic state.
      if (queryClient.isMutating({ predicate: mutation => mutation.options.meta?.commentReactionVideoId === comment.videoId }) === 1) {
        return utils.comments.getMany.invalidate({ videoId: comment.videoId })
      }
    },
    onError: (error, _input, context) => {
      rollbackReaction(context)
      toast.error('出错了')
      if (error.data?.code === 'UNAUTHORIZED') {
        clerk.openSignIn()
      }
    },
  })
  return (
    <div>
      <div className="flex gap-4">
        <Link prefetch href={`/users/${comment.userId}`}>
          <UserAvatar imageUrl={comment.user.imageUrl} name={comment.user.name} size={variant === 'comment' ? 'lg' : 'sm'} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link prefetch href={`/users/${comment.userId}`}>
            <div className="mb-0.5 flex items-center gap-2">
              <span className="pb-0.5 text-sm font-medium">{comment.user.name}</span>
              <span className="pb-0.5 text-sm text-muted-foreground">{formatDistanceToNow(comment.createdAt, { addSuffix: true })}</span>
            </div>
          </Link>
          <p className="text-sm">{comment.value}</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 cursor-pointer"
                aria-label="点赞评论"
                aria-pressed={comment.viewerReaction === 'like'}
                disabled={like.isPending || dislike.isPending}
                onClick={() => {
                  like.mutate({ commentId: comment.id })
                }}
              >
                <ThumbsUpIcon className={cn(comment.viewerReaction === 'like' && 'fill-black')} />
              </Button>
              <span className="text-xs text-muted-foreground">{comment.likeCount}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 cursor-pointer"
                aria-label="不喜欢评论"
                aria-pressed={comment.viewerReaction === 'dislike'}
                disabled={like.isPending || dislike.isPending}
                onClick={() => {
                  dislike.mutate({ commentId: comment.id })
                }}
              >
                <ThumbsDownIcon className={cn(comment.viewerReaction === 'dislike' && 'fill-black')} />
              </Button>
              <span className="text-xs text-muted-foreground">{comment.dislikeCount}</span>
            </div>
            {variant === 'comment' && (
              <Button className="h-8" variant="ghost" size="sm" onClick={() => setIsReplyOpen(true)}>
                回复
              </Button>
            )}
          </div>
        </div>
        {/*评论作者/视频作者具有删除权限*/}
        {(comment.user.clerkId === userClerkId || comment.videoOwnerClerkId === userClerkId || variant === 'comment') && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {variant === 'comment' && (
                <DropdownMenuItem
                  onClick={() => {
                    setIsReplyOpen(true)
                  }}
                >
                  <MessageSquareIcon className="mr-2 size-4" />
                  回复
                </DropdownMenuItem>
              )}
              {(comment.user.clerkId === userClerkId || comment.videoOwnerClerkId === userClerkId) && (
                <DropdownMenuItem
                  onClick={() => {
                    remove.mutate({ id: comment.id })
                  }}
                >
                  <Trash2Icon className="mr-2 size-4" />
                  删除
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {isReplyOpen && variant === 'comment' && (
        <div className="mt-4 pl-14">
          <CommentForm
            variant="reply"
            parentId={comment.id}
            videoId={comment.videoId}
            onCancel={() => setIsReplyOpen(false)}
            onSuccess={() => {
              setIsReplyOpen(false)
              setIsRepliesOpen(true)
            }}
          />
        </div>
      )}
      {comment.replyCount > 0 && variant === 'comment' && (
        <div className="pl-14">
          <Button className="rounded-full" variant="tertiary" size="sm" onClick={() => setIsRepliesOpen(current => !current)}>
            {isRepliesOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
            {comment.replyCount} 回复
          </Button>
        </div>
      )}
      {comment.replyCount > 0 && variant === 'comment' && isRepliesOpen && (
        <CommentReplies parentId={comment.id} videoId={comment.videoId} />
      )}
    </div>
  )
}
