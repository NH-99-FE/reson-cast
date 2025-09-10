import { useAuth, useClerk } from '@clerk/nextjs'
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow'
import { MessageSquareIcon, MoreVerticalIcon, ThumbsDown, ThumbsDownIcon, ThumbsUpIcon, Trash2Icon } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { CommentsGetManyOutput } from '@/modules/comments/types'
import { UserAvatar } from '@/modules/studio/ui/components/user-avatar'
import { trpc } from '@/trpc/client'

interface CommentItemProps {
  comment: CommentsGetManyOutput['items'][number]
}

export const CommentItem = ({ comment }: CommentItemProps) => {
  const clerk = useClerk()
  const utils = trpc.useUtils()
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
  const like = trpc.commentReactions.like.useMutation({
    onSuccess: () => {
      utils.comments.getMany.invalidate({ videoId: comment.videoId })
    },
    onError: error => {
      toast.error('出错了')
      if (error.data?.code === 'UNAUTHORIZED') {
        clerk.openSignIn()
      }
    },
  })
  const dislike = trpc.commentReactions.dislike.useMutation({
    onSuccess: () => {
      utils.comments.getMany.invalidate({ videoId: comment.videoId })
    },
    onError: error => {
      toast.error('出错了')
      if (error.data?.code === 'UNAUTHORIZED') {
        clerk.openSignIn()
      }
    },
  })
  return (
    <div>
      <div className="flex gap-4">
        <Link href={`/users/${comment.userId}`}>
          <UserAvatar imageUrl={comment.user.imageUrl} name={comment.user.name} size="lg" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/users/${comment.userId}`}>
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
                disabled={like.isPending || dislike.isPending}
                onClick={() => {
                  dislike.mutate({ commentId: comment.id })
                }}
              >
                <ThumbsDownIcon className={cn(comment.viewerReaction === 'dislike' && 'fill-black')} />
              </Button>
              <span className="text-xs text-muted-foreground">{comment.dislikeCount}</span>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {}}>
              <MessageSquareIcon className="mr-2 size-4" />
              回复
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                remove.mutate({ id: comment.id })
              }}
            >
              <Trash2Icon className="mr-2 size-4" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
