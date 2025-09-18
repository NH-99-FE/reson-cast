import { Loader2Icon, SquareCheckIcon, SquareIcon } from 'lucide-react'
import { toast } from 'sonner'

import { InfiniteScroll } from '@/components/infinite-scroll'
import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { DEFAULT_LIMIT } from '@/constants'
import { trpc } from '@/trpc/client'

interface PlaylistCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoId: string
}

export const PlaylistAddModal = ({ onOpenChange, open, videoId }: PlaylistCreateModalProps) => {
  const utils = trpc.useUtils()
  const {
    data: playlists,
    isLoading,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage,
  } = trpc.playlists.getManyForVideo.useInfiniteQuery(
    {
      limit: DEFAULT_LIMIT,
      videoId,
    },
    {
      getNextPageParam: lastPage => lastPage.nextCursor,
      enabled: !!videoId && open,
    }
  )

  const handleOpenChange = (newOpen: boolean) => {
    utils.playlists.getManyForVideo.reset()
    onOpenChange(newOpen)
  }

  const addVideo = trpc.playlists.addVideo.useMutation({
    onSuccess: () => {
      toast.success('添加成功')
      utils.playlists.getMany.invalidate()
      utils.playlists.getManyForVideo.invalidate({ videoId })
    },
    onError: () => {
      toast.error('添加失败')
    },
  })
  const removeVideo = trpc.playlists.removeVideo.useMutation({
    onSuccess: () => {
      toast.success('删除成功')
      utils.playlists.getMany.invalidate()
      utils.playlists.getManyForVideo.invalidate({ videoId })
    },
    onError: () => {
      toast.error('删除失败')
    },
  })

  return (
    <ResponsiveModal open={open} title="加入播放列表" onOpenChange={handleOpenChange}>
      {isLoading && (
        <div className="flex justify-center p-4">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {!isLoading &&
        playlists?.pages
          .flatMap(page => page.items)
          .map(playlist => (
            <Button
              variant="ghost"
              key={playlist.id}
              className="size-lg w-full justify-start px-2 [&_svg]:size-5"
              onClick={() => {
                if (playlist.containsVideo) {
                  removeVideo.mutate({ playlistId: playlist.id, videoId })
                } else {
                  addVideo.mutate({ playlistId: playlist.id, videoId })
                }
              }}
              disabled={removeVideo.isPending || addVideo.isPending}
            >
              {playlist.containsVideo ? <SquareCheckIcon className="mr-2" /> : <SquareIcon />}
              {playlist.name}
            </Button>
          ))}
      {!isLoading && (
        <InfiniteScroll isManual hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} fetchNextPage={fetchNextPage} />
      )}
    </ResponsiveModal>
  )
}
