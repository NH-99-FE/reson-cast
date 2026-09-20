import { useAuth, useClerk } from '@clerk/nextjs'
import { Loader2Icon, SquareCheckIcon, SquareIcon } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

import { InfiniteScroll } from '@/components/infinite-scroll'
import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { DEFAULT_LIMIT } from '@/constants'
import { trpc } from '@/trpc/client'

interface PlaylistAddModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoId: string
}

export const PlaylistAddModal = ({ onOpenChange, open, videoId }: PlaylistAddModalProps) => {
  const { isLoaded, isSignedIn } = useAuth()
  const clerk = useClerk()
  const utils = trpc.useUtils()
  const {
    data: playlists,
    isLoading,
    isError,
    refetch,
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
      enabled: !!videoId && open && !!isSignedIn,
    }
  )

  const reconcile = (data: { playlistId: string; videoId: string }) =>
    Promise.all([
      utils.playlists.getMany.invalidate(),
      utils.playlists.getManyForVideo.invalidate({ videoId: data.videoId }),
      utils.playlists.getVideos.invalidate({ playlistId: data.playlistId }),
    ])

  const addVideo = trpc.playlists.addVideo.useMutation({
    onSuccess: data => {
      toast.success('添加成功')
      return reconcile(data)
    },
    onError: () => {
      toast.error('添加失败')
    },
  })
  const removeVideo = trpc.playlists.removeVideo.useMutation({
    onSuccess: data => {
      toast.success('已从播放列表移除')
      return reconcile(data)
    },
    onError: () => {
      toast.error('移除失败')
    },
  })

  const items = playlists?.pages.flatMap(page => page.items) ?? []

  return (
    <ResponsiveModal open={open} title="加入播放列表" onOpenChange={onOpenChange}>
      {(!isLoaded || (isSignedIn && isLoading)) && (
        <div className="flex justify-center p-4">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {isLoaded && !isSignedIn && <Button onClick={() => clerk.openSignIn()}>登录后加入播放列表</Button>}
      {isSignedIn && isError && (
        <div role="alert" className="space-y-2 p-4 text-center">
          <p>播放列表加载失败，请重试</p>
          <Button variant="outline" onClick={() => void refetch()}>
            重试
          </Button>
        </div>
      )}
      {isSignedIn && !isLoading && !isError && items.length === 0 && (
        <div className="space-y-2 p-4 text-center">
          <p className="text-sm text-muted-foreground">还没有播放列表，请先创建一个</p>
          <Button asChild variant="outline">
            <Link href="/playlists" onClick={() => onOpenChange(false)}>
              创建播放列表
            </Link>
          </Button>
        </div>
      )}
      {isSignedIn && items.length > 0 && (
        <div className="max-h-[60vh] overflow-y-auto">
          {items.map(playlist => (
            <Button
              variant="ghost"
              key={playlist.id}
              className="w-full justify-start px-2 [&_svg]:size-5"
              aria-pressed={playlist.containsVideo}
              onClick={() => {
                if (playlist.containsVideo) {
                  removeVideo.mutate({ playlistId: playlist.id, videoId })
                } else {
                  addVideo.mutate({ playlistId: playlist.id, videoId })
                }
              }}
              disabled={removeVideo.isPending || addVideo.isPending}
            >
              {playlist.containsVideo ? <SquareCheckIcon /> : <SquareIcon />}
              <span className="truncate">{playlist.name}</span>
            </Button>
          ))}
          {hasNextPage && (
            <InfiniteScroll isManual hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} fetchNextPage={fetchNextPage} />
          )}
        </div>
      )}
    </ResponsiveModal>
  )
}
