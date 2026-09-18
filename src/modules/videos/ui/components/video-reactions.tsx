import { useClerk } from '@clerk/nextjs'
import { ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toggleReaction } from '@/lib/optimistic-reaction'
import { cn } from '@/lib/utils'
import { VideoGetOneOutput } from '@/modules/videos/types'
import { trpc } from '@/trpc/client'

interface VideoReactionsProps {
  videoId: string
  likes: number
  dislikes: number
  viewerReaction: VideoGetOneOutput['viewerReaction']
}

export const VideoReactions = ({ videoId, viewerReaction, dislikes, likes }: VideoReactionsProps) => {
  const clerk = useClerk()
  const utils = trpc.useUtils()
  const reconcile = () => utils.playlists.getLiked.invalidate()
  const rollback = (previous: VideoGetOneOutput | undefined) => {
    if (!previous) return
    utils.videos.getOne.setData(
      { id: videoId },
      current =>
        current && {
          ...current,
          viewerReaction: previous.viewerReaction,
          likeCount: previous.likeCount,
          dislikeCount: previous.dislikeCount,
        }
    )
  }

  const like = trpc.videoReactions.like.useMutation({
    meta: { videoInteraction: videoId },
    onMutate: async () => {
      await utils.videos.getOne.cancel({ id: videoId })
      const previous = utils.videos.getOne.getData({ id: videoId })
      utils.videos.getOne.setData(
        { id: videoId },
        current =>
          current && {
            ...current,
            ...toggleReaction(current, 'like'),
          }
      )
      return { previous }
    },
    onSettled: reconcile,
    onError: (err, _input, context) => {
      rollback(context?.previous)
      toast.error('出错了')

      if (err.data?.code === 'UNAUTHORIZED') {
        clerk.openSignIn()
      }
    },
  })
  const dislike = trpc.videoReactions.dislike.useMutation({
    meta: { videoInteraction: videoId },
    onMutate: async () => {
      await utils.videos.getOne.cancel({ id: videoId })
      const previous = utils.videos.getOne.getData({ id: videoId })
      utils.videos.getOne.setData(
        { id: videoId },
        current =>
          current && {
            ...current,
            ...toggleReaction(current, 'dislike'),
          }
      )
      return { previous }
    },
    onSettled: reconcile,
    onError: (err, _input, context) => {
      rollback(context?.previous)
      if (err.data?.code === 'UNAUTHORIZED') {
        clerk.openSignIn()
      }
      toast.error('出错了')
    },
  })

  return (
    <div className="flex flex-none items-center">
      <Button
        className="gap-2 rounded-l-full rounded-r-none pr-4"
        variant="secondary"
        aria-label="点赞"
        aria-pressed={viewerReaction === 'like'}
        onClick={() => like.mutate({ videoId })}
        disabled={like.isPending || dislike.isPending}
      >
        <ThumbsUpIcon className={cn('size-5', viewerReaction === 'like' && 'fill-black')} />
        {likes}
      </Button>
      <Separator orientation="vertical" className="h-7" />
      <Button
        className="gap-2 rounded-l-none rounded-r-full pr-4"
        variant="secondary"
        aria-label="不喜欢"
        aria-pressed={viewerReaction === 'dislike'}
        onClick={() => dislike.mutate({ videoId })}
        disabled={like.isPending || dislike.isPending}
      >
        <ThumbsDownIcon className={cn('size-5', viewerReaction === 'dislike' && 'fill-black')} />
        {dislikes}
      </Button>
    </div>
  )
}
