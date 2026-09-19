'use client'

import { useAuth } from '@clerk/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  CopyCheckIcon,
  CopyIcon,
  Globe2Icon,
  ImagePlusIcon,
  Loader2Icon,
  LockIcon,
  MoreVerticalIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SaveIcon,
  SparklesIcon,
  TrashIcon,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { APP_URL } from '@/constants'
import { videoUpdateSchema } from '@/db/schema'
import { formatVideoStatus } from '@/lib/utils'
import { cardThumbnailSource, isPublicThumbnail, videoThumbnailSource } from '@/lib/video-image-source'
import { GenerationAction } from '@/modules/studio/ui/components/generation-action'
import { ThumbnailGenerateModal } from '@/modules/studio/ui/components/thumbnail-generate-modal'
import { ThumbnailUploadModal } from '@/modules/studio/ui/components/thumbnail-upload-modal'
import { useGenerationTask } from '@/modules/studio/ui/hooks/use-generation-task'
import { useTextGeneration } from '@/modules/studio/ui/hooks/use-text-generation'
import { dirtyVideoPatch, editableVideoFields } from '@/modules/studio/ui/hooks/video-form-values'
import { THUMBNAIL_FALLBACK } from '@/modules/videos/constants'
import { VideoPlayer } from '@/modules/videos/ui/components/video-player'
import { trpc } from '@/trpc/client'

interface FormSectionProps {
  videoId: string
}

const GenerationRetryButton = ({ label, disabled, onRetry }: { label: string; disabled: boolean; onRetry: () => void }) => {
  if (label !== '重试查询') {
    return (
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onRetry}>
        {label}
      </Button>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          aria-label="重试查询"
          disabled={disabled}
          onClick={onRetry}
        >
          <RefreshCwIcon className="size-4" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>点击重试</TooltipContent>
    </Tooltip>
  )
}

export const FormSection = ({ videoId }: FormSectionProps) => {
  return (
    <Suspense fallback={<FormSectionSkeleton />}>
      <ErrorBoundary fallback={<p>出错了！</p>}>
        <FormSectionSuspense key={videoId} videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  )
}

const FormSectionSkeleton = () => {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="mr-10 h-9 w-24" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-8 lg:col-span-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-[160px] w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-[84px] w-[153px]" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>
        <div className="flex flex-col space-y-2 lg:col-span-2">
          <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-[#F9F9F9]">
            <Skeleton className="aspect-video" />
            <div className="space-y-6 p-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-18" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-18" />
              </div>
            </div>
          </div>
          <div className="mt-8 space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

const FormSectionSuspense = ({ videoId }: FormSectionProps) => {
  const { userId: accountId } = useAuth()
  const router = useRouter()
  const utils = trpc.useUtils()

  const [thumbnailGenerateModalOpen, setThumbnailGenerateModalOpen] = useState(false)
  const [thumbnailModalOpen, setThumbnailModalOpen] = useState<boolean>(false)

  const [video, videoQuery] = trpc.studio.getOne.useSuspenseQuery({ id: videoId })
  const [categories] = trpc.categories.getMany.useSuspenseQuery()
  const thumbnailUrl = videoThumbnailSource(video)
  // Public sources are already versioned and require a query-free canonical URL.
  const posterUrl =
    thumbnailUrl && video.visibility !== 'public'
      ? `${thumbnailUrl}${thumbnailUrl.includes('?') ? '&' : '?'}cover=${encodeURIComponent(video.thumbnailKey ?? 'mux')}`
      : thumbnailUrl

  const form = useForm<z.infer<typeof videoUpdateSchema>>({
    resolver: zodResolver(videoUpdateSchema),
    defaultValues: video,
  })
  const unavailable = videoQuery.error?.data?.code === 'NOT_FOUND'
  useEffect(() => {
    if (unavailable) return
    for (const key of editableVideoFields) {
      if (!form.getFieldState(key).isDirty) form.resetField(key, { defaultValue: video[key] })
    }
  }, [video, form, unavailable])
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const refreshRelated = useCallback(() => {
    void utils.studio.getMany.invalidate()
    void utils.videos.invalidate()
    void utils.search.invalidate()
    void utils.playlists.invalidate()
  }, [utils])
  const refreshVideo = () => {
    void utils.studio.getOne.invalidate({ id: videoId })
    refreshRelated()
  }

  const update = trpc.videos.update.useMutation({
    onSuccess: (saved, submitted) => {
      if (!mounted.current) return
      for (const key of editableVideoFields) {
        if (!Object.hasOwn(submitted, key)) continue
        const latest = form.getValues(key)
        form.resetField(key, { defaultValue: saved[key] })
        // Preserve edits typed while this save was in flight, against the new baseline.
        if (latest !== submitted[key]) form.setValue(key, latest, { shouldDirty: true })
      }
      utils.studio.getOne.setData({ id: videoId }, saved)
      refreshRelated()
      toast.success('更新成功')
    },
    onError: error => {
      if (!mounted.current) return
      refreshVideo()
      toast.error(error.message || '更新失败')
    },
  })

  const remove = trpc.videos.remove.useMutation({
    onSuccess: () => {
      // 旧缓存失效
      utils.studio.getMany.invalidate()
      toast.success('已提交删除，正在清理资源')
      router.push('/studio')
    },
    onError: () => {
      toast.error('删除提交失败，请在工作台重试')
      utils.studio.getMany.invalidate()
      router.push('/studio')
    },
  })

  const revalidate = trpc.videos.revalidate.useMutation({
    onSuccess: () => {
      refreshVideo()
      toast.success('验证成功')
    },
    onError: error => toast.error(error.message || '验证未完成，请重试'),
  })
  const retryRevocation = trpc.videos.retryPlaybackRevocation.useMutation({
    onSuccess: () => {
      refreshVideo()
      toast.success('播放权限已更新')
    },
    onError: () => {
      refreshVideo()
      toast.error('播放权限更新未完成，请重试')
    },
  })
  const restoreThumbnail = trpc.videos.restoreThumbnail.useMutation({
    onSuccess: () => {
      refreshVideo()
      toast.success('恢复成功')
    },
    onError: () => toast.error('恢复失败'),
  })

  const refreshGenerated = () => {
    void utils.studio.getMany.invalidate()
  }
  const titleGeneration = useTextGeneration({ accountId, videoId, kind: 'title', form, onSaved: refreshGenerated })
  const descriptionGeneration = useTextGeneration({ accountId, videoId, kind: 'description', form, onSaved: refreshGenerated })
  const thumbnailGeneration = useGenerationTask({
    accountId,
    videoId,
    kind: 'thumbnail',
    onSettled: async () => {
      const fresh = await utils.client.studio.getOne.query({ id: videoId })
      utils.studio.getOne.setData({ id: videoId }, fresh)
      refreshGenerated()
    },
  })
  const cleanup = trpc.videos.getPendingFileCleanup.useQuery({ id: videoId })
  const retryCleanup = trpc.videos.retryFileCleanup.useMutation({
    onSuccess: result => {
      void cleanup.refetch()
      if (result.count) toast.error('仍有文件未清理，请稍后重试')
      else toast.success('旧封面已清理')
    },
    onError: () => toast.error('清理失败，请稍后重试'),
  })
  const locked = { title: titleGeneration.fieldLocked, description: descriptionGeneration.fieldLocked }
  const patch = dirtyVideoPatch(form.getValues(), form.formState.dirtyFields, locked)
  const onSubmit = (data: z.infer<typeof videoUpdateSchema>) => {
    const changes = dirtyVideoPatch(data, form.formState.dirtyFields, locked)
    if (!unavailable && !update.isPending && Object.keys(changes).length) update.mutate({ id: videoId, ...changes })
  }

  const fullUrl = `${APP_URL}/videos/${videoId}`

  const [isCopied, setIsCopied] = useState<boolean>(false)
  const onCopy = async () => {
    await navigator.clipboard.writeText(fullUrl)
    setIsCopied(true)
    setTimeout(() => {
      setIsCopied(false)
    }, 2000)
  }
  return (
    <>
      <ThumbnailGenerateModal
        generating={thumbnailGeneration.locked}
        onGenerate={prompt => thumbnailGeneration.start(prompt)}
        open={thumbnailGenerateModalOpen}
        onOpenChange={setThumbnailGenerateModalOpen}
      />
      <ThumbnailUploadModal open={thumbnailModalOpen} onOpenChange={setThumbnailModalOpen} videoId={videoId} />
      {unavailable && (
        <p role="alert" className="mb-4 rounded border p-4">
          视频已删除或无法访问，无法继续保存。尚未保存的文本仍保留，可复制后离开。
        </p>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">视频详情</h1>
              <p className="text-xs text-muted-foreground">管理你的视频</p>
            </div>
            <div className="flex items-center gap-x-2">
              <Button type="submit" variant="outline" disabled={unavailable || update.isPending || !Object.keys(patch).length}>
                {update.isPending ? <Loader2Icon className="w-8 animate-spin" /> : <SaveIcon />}
                保存
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant={'ghost'} size="icon">
                    <MoreVerticalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={'end'}>
                  <DropdownMenuItem onClick={() => revalidate.mutate({ id: videoId })}>
                    <RotateCcwIcon className="mr-2 size-4" />
                    <span>验证</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => remove.mutate({ id: videoId })}>
                    <TrashIcon className="mr-2 size-4" />
                    <span>删除</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {video.muxPlaybackIdToRevoke && (
            <div role="status" className="mb-6 flex items-center justify-between gap-4 rounded-md border p-4 text-sm">
              <p>视频已隐藏，旧播放权限尚未撤销完成。</p>
              <Button
                type="button"
                variant="outline"
                disabled={retryRevocation.isPending || update.isPending}
                onClick={() => retryRevocation.mutate({ id: videoId })}
              >
                {retryRevocation.isPending ? '正在重试' : '重试撤销'}
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="space-y-8 lg:col-span-3">
              {/*标题区域*/}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <div className="flex items-center gap-x-2">
                        标题
                        <GenerationAction
                          label="标题"
                          task={titleGeneration}
                          disabled={update.isPending || !!form.formState.dirtyFields.title || !video.muxTrackId}
                          disabledReason={
                            form.formState.dirtyFields.title ? '请先保存该字段' : !video.muxTrackId ? '视频字幕尚未就绪' : '正在保存'
                          }
                        />
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} disabled={titleGeneration.fieldLocked} placeholder="在此添加视频标题" />
                    </FormControl>
                    {titleGeneration.suggestion && !titleGeneration.locked && (
                      <details className="text-sm">
                        <summary>查看未采用的生成结果</summary>
                        <p className="my-2 whitespace-pre-wrap">{titleGeneration.suggestion}</p>
                        <Button type="button" size="sm" variant="outline" onClick={titleGeneration.adoptSuggestion}>
                          采用到编辑框
                        </Button>
                      </details>
                    )}
                    {form.formState.dirtyFields.title && !titleGeneration.locked && (
                      <p className="text-xs text-muted-foreground">请先保存该字段，再生成</p>
                    )}
                  </FormItem>
                )}
              />
              {/*简介区域*/}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <div className="flex items-center gap-x-2">
                        简介
                        <GenerationAction
                          label="简介"
                          task={descriptionGeneration}
                          disabled={update.isPending || !!form.formState.dirtyFields.description || !video.muxTrackId}
                          disabledReason={
                            form.formState.dirtyFields.description ? '请先保存该字段' : !video.muxTrackId ? '视频字幕尚未就绪' : '正在保存'
                          }
                        />
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        disabled={descriptionGeneration.fieldLocked}
                        value={field.value ?? ''}
                        rows={10}
                        placeholder="在此添加视频介绍"
                        className="min-h-40 resize-none pr-10"
                      />
                    </FormControl>
                    <FormMessage />
                    {descriptionGeneration.suggestion && !descriptionGeneration.locked && (
                      <details className="text-sm">
                        <summary>查看未采用的生成结果</summary>
                        <p className="my-2 whitespace-pre-wrap">{descriptionGeneration.suggestion}</p>
                        <Button type="button" size="sm" variant="outline" onClick={descriptionGeneration.adoptSuggestion}>
                          采用到编辑框
                        </Button>
                      </details>
                    )}
                    {form.formState.dirtyFields.description && !descriptionGeneration.locked && (
                      <p className="text-xs text-muted-foreground">请先保存该字段，再生成</p>
                    )}
                  </FormItem>
                )}
              />
              {/*调整缩略图区域*/}
              <FormItem>
                <p className="text-sm font-medium">缩略图</p>

                <div className="group relative h-[84px] w-[153px] border border-dashed border-neutral-400 p-0.5">
                  <Image
                    key={`${video.id}:${video.thumbnailKey ?? 'mux'}`}
                    src={cardThumbnailSource(thumbnailUrl) || THUMBNAIL_FALLBACK}
                    alt="thumbnail"
                    className="object-cover"
                    fill
                    sizes="153px"
                    unoptimized={!isPublicThumbnail(thumbnailUrl)}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        className="absolute top-1 right-1 size-7 rounded-full bg-black/50 opacity-100 duration-300 group-hover:opacity-100 hover:bg-black/50 md:opacity-0"
                      >
                        <MoreVerticalIcon className="text-white" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="right">
                      <DropdownMenuItem onClick={() => setThumbnailModalOpen(true)}>
                        <ImagePlusIcon className="mr-2 size-4" />
                        <span>修改</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={thumbnailGeneration.locked} onClick={() => setThumbnailGenerateModalOpen(true)}>
                        <SparklesIcon className="mr-2 size-4" />
                        <span>AI生成</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => restoreThumbnail.mutate({ id: videoId })}>
                        <RotateCcwIcon className="mr-2 size-4" />
                        <span>还原</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </FormItem>
              {thumbnailGeneration.message && (
                <div role="status" className="flex items-center gap-2 text-sm">
                  <span>{thumbnailGeneration.message}</span>
                  {thumbnailGeneration.retryLabel && (
                    <GenerationRetryButton
                      label={thumbnailGeneration.retryLabel}
                      disabled={thumbnailGeneration.syncing}
                      onRetry={() => void thumbnailGeneration.resume()}
                    />
                  )}
                </div>
              )}
              {!!cleanup.data?.count && (
                <div role="status" className="flex items-center gap-2 text-sm">
                  <span>有 {cleanup.data.count} 个旧封面文件等待清理，不影响当前封面。</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={retryCleanup.isPending}
                    onClick={() => retryCleanup.mutate({ id: videoId })}
                  >
                    重试清理
                  </Button>
                </div>
              )}
              {/*分类区域*/}
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>类别</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择一个类别" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-y-8 lg:col-span-2">
              <div className="flex h-fit flex-col gap-4 overflow-hidden rounded-xl bg-[#F9F9F9]">
                <div className="ralative aspect-video overflow-hidden">
                  <VideoPlayer videoId={video.id} thumbnailUrl={posterUrl} />
                </div>
                <div className="flex flex-col gap-y-6 p-4">
                  <div className="flex items-center justify-between gap-x-2">
                    <div className="flex flex-col gap-y-1">
                      <p className="text-xs text-muted-foreground">视频链接</p>
                      <div className="flex items-center gap-x-2">
                        <Link prefetch href={`/videos/${video.id}`}>
                          <p className="line-clamp-1 text-sm text-blue-500">{fullUrl}</p>
                        </Link>
                        <Button type="button" variant="ghost" size="icon" className={'shrink-0'} onClick={onCopy} disabled={isCopied}>
                          {isCopied ? <CopyCheckIcon /> : <CopyIcon />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-x-1">
                      <p className="text-xs text-muted-foreground">视频状态</p>
                      <p className="text-sm">{formatVideoStatus(video.muxStatus || 'preparing')}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-x-1">
                      <p className="text-xs text-muted-foreground">字幕状态</p>
                      <p className="text-sm">{formatVideoStatus(video.muxTrackStatus || 'no_subtitles')}</p>
                    </div>
                  </div>
                </div>
              </div>
              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>谁可以看</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="请选择谁可以看" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="public">
                          <Globe2Icon className="mr-2 size-4" />
                          所有人
                        </SelectItem>
                        <SelectItem value="private">
                          <LockIcon className="mr-2 size-4" />
                          仅自己
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </form>
      </Form>
    </>
  )
}
