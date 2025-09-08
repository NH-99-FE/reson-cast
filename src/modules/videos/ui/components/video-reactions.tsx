import { useClerk } from '@clerk/nextjs'
import { ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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

  const like = trpc.videoReactions.like.useMutation({
    onSuccess: () => {
      utils.videos.getOne.invalidate({ id: videoId })
      // TODO:点赞列表失效
    },
    onError: err => {
      toast.error('出错了')

      if (err.data?.code === 'UNAUTHORIZED') {
        clerk.openSignIn()
      }
    },
  })
  const dislike = trpc.videoReactions.dislike.useMutation({
    onSuccess: () => {
      utils.videos.getOne.invalidate({ id: videoId })
      // TODO:点赞列表失效
    },
    onError: err => {
      toast.error('出错了')

      if (err.data?.code === 'UNAUTHORIZED') {
        clerk.openSignIn()
      }
    },
  })

  return (
    <div className="flex flex-none items-center">
      <Button
        className="gap-2 rounded-l-full rounded-r-none pr-4"
        variant="secondary"
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
        onClick={() => dislike.mutate({ videoId })}
        disabled={like.isPending || dislike.isPending}
      >
        <ThumbsDownIcon className={cn('size-5', viewerReaction === 'dislike' && 'fill-black')} />
        {dislikes}
      </Button>
    </div>
  )
}
