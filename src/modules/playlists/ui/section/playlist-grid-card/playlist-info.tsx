import { Skeleton } from '@/components/ui/skeleton'
import { PlaylistGetManyOutput } from '@/modules/playlists/types'

interface PlaylistInfoProps {
  data: PlaylistGetManyOutput['items'][number]
}

export const PlaylistInfoSkeleton = () => (
  <div className="flex gap-3">
    <div className="min-w-0 flex-1 space-y-2">
      <Skeleton className="h-4 w-[60%]" />
      <Skeleton className="h-4 w-[40%]" />
      <Skeleton className="h-4 w-[30%]" />
    </div>
  </div>
)

export const PlaylistInfo = ({ data }: PlaylistInfoProps) => {
  return (
    <div className="flex gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-sm font-medium break-words lg:line-clamp-2">{data.name}</h3>
        <p className="text-sm text-muted-foreground">播放列表</p>
        <p className="text-sm font-semibold text-muted-foreground hover:text-primary">查看完整播放列表</p>
      </div>
    </div>
  )
}
