'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  CopyCheckIcon,
  CopyIcon,
  Globe2Icon,
  ImagePlusIcon,
  Loader2Icon,
  LockIcon,
  MoreVerticalIcon,
  RotateCcw,
  RotateCcwIcon,
  SaveIcon,
  Sparkles,
  SparklesIcon,
  TrashIcon,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Suspense, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { videoUpdateSchema } from '@/db/schema'
import { formatVideoStatus } from '@/lib/utils'
import { ThumbnailUploadModal } from '@/modules/studio/ui/components/thumbnail-upload-modal'
import { THUMBNAIL_FALLBACK } from '@/modules/videos/constants'
import { VideoPlayer } from '@/modules/videos/ui/components/video-player'
import { trpc } from '@/trpc/client'

interface FormSectionProps {
  videoId: string
}

export const FormSection = ({ videoId }: FormSectionProps) => {
  return (
    <Suspense fallback={<FormSectionSkeleton />}>
      <ErrorBoundary fallback={<p>出错了！</p>}>
        <FormSectionSuspense videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  )
}

const FormSectionSkeleton = () => {
  return <p>加载中...</p>
}

const FormSectionSuspense = ({ videoId }: FormSectionProps) => {
  const router = useRouter()
  const utils = trpc.useUtils()

  const [thumbnailModalOpen, setThumbnailModalOpen] = useState<boolean>(false)

  const [video] = trpc.studio.getOne.useSuspenseQuery({ id: videoId })
  const [categories] = trpc.categories.getMany.useSuspenseQuery()

  const update = trpc.videos.update.useMutation({
    onSuccess: () => {
      // 旧缓存失效
      utils.studio.getMany.invalidate()
      utils.studio.getOne.invalidate({ id: videoId })
      toast.success('更新成功')
    },
    onError: () => {
      toast.error('更新失败')
    },
  })

  const remove = trpc.videos.remove.useMutation({
    onSuccess: () => {
      // 旧缓存失效
      utils.studio.getMany.invalidate()
      toast.success('删除成功')
      router.push('/studio')
    },
    onError: () => {
      toast.error('删除失败')
    },
  })

  // 恢复缩略图
  const restoreThumbnail = trpc.videos.restoreThumbnail.useMutation({
    onSuccess: () => {
      // 旧缓存失效

      utils.studio.getMany.invalidate()
      utils.studio.getOne.invalidate({ id: videoId })
      toast.success('恢复成功')
    },
    onError: () => {
      toast.error('恢复失败')
    },
  })

  const form = useForm<z.infer<typeof videoUpdateSchema>>({
    resolver: zodResolver(videoUpdateSchema),
    defaultValues: video,
  })

  const onSubmit = async (data: z.infer<typeof videoUpdateSchema>) => {
    await update.mutate(data)
  }

  const fullUrl = `${process.env.VERCEL_URL || 'http://localhost:3000'}/videos/${videoId}`

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
      <ThumbnailUploadModal open={thumbnailModalOpen} onOpenChange={setThumbnailModalOpen} videoId={videoId} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">视频详情</h1>
              <p className="text-xs text-muted-foreground">管理你的视频</p>
            </div>
            <div className="flex items-center gap-x-2">
              <Button type="submit" variant="outline" disabled={update.isPending}>
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
                  <DropdownMenuItem onClick={() => remove.mutate({ id: videoId })}>
                    <TrashIcon className="mr-2 size-4" />
                    <span>删除</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="space-y-8 lg:col-span-3">
              {/*标题区域*/}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>标题</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="在此添加视频标题" />
                    </FormControl>
                  </FormItem>
                )}
              />
              {/*简介区域*/}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>简介</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ''}
                        rows={10}
                        placeholder="在此添加视频介绍"
                        className="min-h-40 resize-none pr-10"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/*调整缩略图区域*/}
              <FormField
                name="thumbnailUrl"
                control={form.control}
                render={() => (
                  <FormItem>
                    <FormLabel>缩略图</FormLabel>
                    <FormControl>
                      <div className="group relative h-[84px] w-[153px] border border-dashed border-neutral-400 p-0.5">
                        <Image src={video.thumbnailUrl || THUMBNAIL_FALLBACK} alt="thumbnail" className="object-cover" fill unoptimized />
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
                            <DropdownMenuItem>
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
                    </FormControl>
                  </FormItem>
                )}
              />
              {/*分类区域*/}
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>类别</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
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
                  <VideoPlayer playbackId={video.muxPlaybackId} thumbnailUrl={video.thumbnailUrl} />
                </div>
                <div className="flex flex-col gap-y-6 p-4">
                  <div className="flex items-center justify-between gap-x-2">
                    <div className="flex flex-col gap-y-1">
                      <p className="text-xs text-muted-foreground">视频链接</p>
                      <div className="flex items-center gap-x-2">
                        <Link href={`/video/${video.id}`}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
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
