'use client'

import type { MuxUploaderRefAttributes } from '@mux/mux-uploader-react'
import { Loader2Icon, PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { trpc } from '@/trpc/client'

import { StudioUploader } from './studio-uploader'

type UploadPhase = 'idle' | 'creating' | 'ready' | 'uploading' | 'cancelling' | 'cancel-failed'

const StudioUploadModal = () => {
  const router = useRouter()
  const utils = trpc.useUtils()
  const uploader = useRef<MuxUploaderRefAttributes>(null)
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const phaseRef = useRef<UploadPhase>('idle')
  const transition = (next: UploadPhase) => {
    // Mux may emit synchronously during abort, before React renders the new phase.
    phaseRef.current = next
    setPhase(next)
  }
  const remove = trpc.videos.remove.useMutation({
    onSuccess: () => {
      transition('idle')
      create.reset()
      void utils.studio.getMany.invalidate()
      toast.success('已取消上传，正在清理记录')
    },
    onError: () => {
      transition('cancel-failed')
      void utils.studio.getMany.invalidate()
      toast.error('取消提交失败，请重试取消')
    },
  })
  const create = trpc.videos.create.useMutation({
    onSuccess: () => {
      transition('ready')
      utils.studio.getMany.invalidate()
    },
    onError: () => {
      transition('idle')
      toast.error('创建失败')
    },
  })

  const onSuccess = () => {
    if (!['ready', 'uploading'].includes(phaseRef.current) || !create.data?.video.id) return
    const id = create.data.video.id
    transition('idle')
    create.reset()
    router.push(`/studio/videos/${id}`)
  }
  const cancel = () => {
    if (!create.data || !['ready', 'uploading', 'cancel-failed'].includes(phaseRef.current)) return
    if (phaseRef.current === 'uploading' && !window.confirm('是否放弃本次上传？放弃后将删除本次视频记录。')) return
    transition('cancelling')
    uploader.current?.upload?.abort()
    remove.mutate({ id: create.data.video.id })
  }
  const start = () => {
    if (phaseRef.current !== 'idle') return
    transition('creating')
    create.mutate()
  }
  return (
    <>
      <ResponsiveModal
        title="上传视频"
        open={phase !== 'idle' && phase !== 'creating'}
        onOpenChange={open => {
          if (!open) cancel()
        }}
      >
        {phase === 'cancelling' || phase === 'cancel-failed' ? (
          <div className="space-y-3" role="status">
            <p>{phase === 'cancelling' ? '正在取消上传…' : '上传已停止，取消请求尚未确认。请重试。'}</p>
            <Button onClick={cancel} disabled={phase === 'cancelling'}>
              重试取消
            </Button>
          </div>
        ) : create.data?.url ? (
          <StudioUploader
            uploaderRef={uploader}
            endpoint={create.data.url}
            onSuccess={onSuccess}
            onStarted={() => {
              if (phaseRef.current === 'ready') transition('uploading')
            }}
          />
        ) : (
          <Loader2Icon />
        )}
      </ResponsiveModal>
      <Button variant="secondary" onClick={start} disabled={phase !== 'idle'}>
        {phase === 'creating' ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
        创建
      </Button>
    </>
  )
}

export default StudioUploadModal
