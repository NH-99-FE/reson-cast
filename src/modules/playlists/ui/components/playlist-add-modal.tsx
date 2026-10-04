import { useAuth, useClerk } from '@clerk/nextjs'
import { CheckIcon, ListVideoIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { InfiniteScroll } from '@/components/infinite-scroll'
import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { DEFAULT_LIMIT } from '@/constants'
import { cn } from '@/lib/utils'
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
  const isSaving = removeVideo.isPending || addVideo.isPending
  const pendingPlaylistId = addVideo.isPending
    ? addVideo.variables?.playlistId
    : removeVideo.isPending
      ? removeVideo.variables?.playlistId
      : undefined

  return (
    <ResponsiveModal
      open={open}
      title="加入播放列表"
      description="点击加入，再次点击即可移出。"
      dialogClassName="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-sm"
      headerClassName="gap-1.5 px-5 pt-5 pb-4"
      descriptionClassName="text-xs leading-5 text-muted-foreground"
      onOpenChange={onOpenChange}
    >
      {(!isLoaded || (isSignedIn && isLoading)) && (
        <div role="status" className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted-foreground">
          <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
          加载播放列表…
        </div>
      )}
      {isLoaded && !isSignedIn && (
        <div className="px-5 pb-5">
          <Button className="w-full rounded-xl" onClick={() => clerk.openSignIn()}>
            登录后加入播放列表
          </Button>
        </div>
      )}
      {isSignedIn && isError && (
        <div role="alert" className="space-y-4 px-5 pt-4 pb-8 text-center text-sm">
          <p className="text-muted-foreground">播放列表加载失败，请重试</p>
          <Button variant="outline" className="rounded-full" onClick={() => void refetch()}>
            重试
          </Button>
        </div>
      )}
      {isSignedIn && !isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center px-5 pt-5 pb-8 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
            <ListVideoIcon aria-hidden="true" className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">还没有播放列表，可在「播放列表」页面创建。</p>
        </div>
      )}
      {isSignedIn && !isError && items.length > 0 && (
        <div className="max-h-[50dvh] space-y-1 overflow-y-auto overscroll-contain px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {items.map(playlist => (
            <Button
              variant="ghost"
              key={playlist.id}
              className={cn(
                'h-14 w-full justify-start gap-3 rounded-xl px-3 text-left font-normal',
                playlist.containsVideo && 'bg-muted/70 hover:bg-muted'
              )}
              aria-pressed={playlist.containsVideo}
              aria-busy={pendingPlaylistId === playlist.id}
              onClick={() => {
                if (playlist.containsVideo) {
                  removeVideo.mutate({ playlistId: playlist.id, videoId })
                } else {
                  addVideo.mutate({ playlistId: playlist.id, videoId })
                }
              }}
              disabled={isSaving}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background">
                <ListVideoIcon aria-hidden="true" className="size-4 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1 truncate">{playlist.name}</span>
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border border-border',
                  playlist.containsVideo && 'border-primary bg-primary text-primary-foreground'
                )}
              >
                {pendingPlaylistId === playlist.id ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : playlist.containsVideo ? (
                  <CheckIcon className="size-3" strokeWidth={2.5} />
                ) : null}
              </span>
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
