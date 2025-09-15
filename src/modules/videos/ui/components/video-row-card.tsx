import { cva, VariantProps } from 'class-variance-authority'
import Link from 'next/link'
import { useMemo } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/modules/studio/ui/components/user-avatar'
import { UserInfo } from '@/modules/users/ui/components/user-info'
import { VideoGetManyOutput } from '@/modules/videos/types'
import { VideoMenu } from '@/modules/videos/ui/components/video-menu'
import { VideoThumbnail, VideoThumbnailSkeleton } from '@/modules/videos/ui/components/video-thumbnail'

const videoRowCardVariants = cva('group flex min-w-0', {
  variants: {
    size: {
      default: 'gap-4',
      compact: 'gap-2',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

const thumbnailVariants = cva('relative flex-none', {
  variants: {
    size: {
      default: 'w-[30%]',
      compact: 'w-[168px]',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

interface VideoRowCardProps extends VariantProps<typeof videoRowCardVariants> {
  data: VideoGetManyOutput['items'][number]
  onRemove?: () => void
}

export const VideoRowCardSkeleton = ({ size = 'default' }: VariantProps<typeof videoRowCardVariants>) => {
  return (
    <div className={videoRowCardVariants({ size })}>
      <div className={thumbnailVariants({ size })}>
        <VideoThumbnailSkeleton />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-x-2">
          <div className="min-w-0 flex-1">
            <Skeleton className={cn('h-5 w-[80%]', size === 'compact' && 'h-4 w-[80%]')} />
            {size === 'default' && (
              <>
                <Skeleton className="mt-1 h-4 w-[20%]" />
                <div className="my-3 flex items-center gap-2">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </>
            )}
            {size === 'compact' && (
              <>
                <Skeleton className="mt-1 h-4 w-[20%]" />
                <div className="flex gap-1">
                  <Skeleton className="mt-1 h-4 w-16" />
                  <Skeleton className="mt-1 h-4 w-16" />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const VideoRowCard = ({ data, size = 'default', onRemove }: VideoRowCardProps) => {
  const compactViews = useMemo(() => {
    return Intl.NumberFormat('en', {
      notation: 'compact',
    }).format(data.viewCount)
  }, [data.viewCount])

  const compactLikes = useMemo(() => {
    return Intl.NumberFormat('en', {
      notation: 'compact',
    }).format(data.likeCount)
  }, [data.likeCount])

  return (
    <div className={videoRowCardVariants({ size })}>
      <Link href={`/videos/${data.id}`} className={thumbnailVariants({ size })}>
        <VideoThumbnail imageUrl={data.thumbnailUrl} previewUrl={data.previewUrl} title={data.title} duration={data.duration} />
      </Link>
      {/*视频信息*/}
      <div className="min-w-0 flex-1">
        <div className="flex justify-center gap-x-2">
          <Link href={`/videos/${data.id}`} className="min-w-0 flex-1">
            <h3 className={cn('line-clamp-2 font-medium', size === 'compact' ? 'text-sm' : 'text-base')}>{data.title}</h3>
            {size === 'default' && (
              <p className="mt-2 text-xs text-muted-foreground">
                {compactViews} 浏览量 | {compactLikes} 点赞数
              </p>
            )}
            {size === 'default' && (
              <>
                <div className="mt-2 flex items-center gap-x-2">
                  <UserAvatar size="sm" imageUrl={data.user.imageUrl} name={data.user.name} />
                  <UserInfo size="sm" name={data.user.name} />
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <p className="mt-2 line-clamp-2 w-fit text-start text-xs text-muted-foreground">{data.description ?? '还没有简介'}</p>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="center" className="bg-black/70">
                    <p>来自视频简介</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
            {size === 'compact' && <UserInfo size="sm" name={data.user.name} />}
            {size === 'compact' && (
              <p className="mt-1 text-xs text-muted-foreground">
                {compactViews} 浏览量 | {compactLikes} 点赞数
              </p>
            )}
          </Link>
          <div>
            <VideoMenu videoId={data.id} onRemove={onRemove} />
          </div>
        </div>
      </div>
    </div>
  )
}
