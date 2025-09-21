'use client'
import { Trash2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/trpc/client'

interface PlaylistHeaderSectionProps {
  playlistId: string
}

export const PlaylistHeaderSection = ({ playlistId }: PlaylistHeaderSectionProps) => {
  return (
    <Suspense fallback={<PlaylistHeaderSectionSkeleton />}>
      <ErrorBoundary fallback={<p>出错了</p>}>
        <PlaylistHeaderSectionSuspense playlistId={playlistId} />
      </ErrorBoundary>
    </Suspense>
  )
}

const PlaylistHeaderSectionSkeleton = () => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="size-5 rounded-full" />
    </div>
  )
}

const PlaylistHeaderSectionSuspense = ({ playlistId }: PlaylistHeaderSectionProps) => {
  const router = useRouter()
  const [playlist] = trpc.playlists.getOne.useSuspenseQuery({ id: playlistId })
  const utils = trpc.useUtils()
  const remove = trpc.playlists.remove.useMutation({
    onSuccess: () => {
      toast.success('删除成功')
      utils.playlists.getMany.invalidate()
      router.push('/playlists')
    },
    onError: () => {
      toast.error('删除失败')
    },
  })
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">{playlist.name}</h1>
        <p className="text-xs text-muted-foreground">来自播放列表</p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" disabled={remove.isPending} className="rounded-full">
            <Trash2Icon />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除吗</AlertDialogTitle>
            <AlertDialogDescription>该操作无法撤销，请谨慎！</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate({ id: playlistId })}>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
