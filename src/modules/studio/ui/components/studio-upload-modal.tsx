'use client'

import type { MuxUploaderRefAttributes } from '@mux/mux-uploader-react'
import { CircleAlertIcon, Loader2Icon, PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ComponentPropsWithoutRef, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { trpc } from '@/trpc/client'

import { StudioUploader } from './studio-uploader'

type UploadPhase = 'idle' | 'creating' | 'ready' | 'uploading' | 'cancelling' | 'cancel-failed'

// Keep inactive content mounted so switching panels never interrupts the upload.
const UploadPanel = ({ active, children, ...props }: ComponentPropsWithoutRef<'div'> & { active: boolean }) => (
  <div
    {...props}
    aria-hidden={!active}
    inert={!active}
    className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${active ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
  >
    <div className="min-h-0 overflow-hidden">{children}</div>
  </div>
)

const StudioUploadModal = () => {
  const router = useRouter()
  const utils = trpc.useUtils()
  const uploadPanel = useRef<HTMLDivElement>(null)
  const continueButton = useRef<HTMLButtonElement>(null)
  const uploader = useRef<MuxUploaderRefAttributes>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
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
    setConfirmOpen(false)
    transition('idle')
    create.reset()
    router.push(`/studio/videos/${id}`)
  }
  const cancel = () => {
    if (!create.data || !['ready', 'uploading', 'cancel-failed'].includes(phaseRef.current)) return
    setConfirmOpen(false)
    transition('cancelling')
    uploader.current?.upload?.abort()
    remove.mutate({ id: create.data.video.id })
  }
  const showConfirmation = () => {
    setConfirmOpen(true)
    requestAnimationFrame(() => continueButton.current?.focus({ preventScroll: true }))
  }
  const resume = () => {
    setConfirmOpen(false)
    requestAnimationFrame(() => uploadPanel.current?.focus({ preventScroll: true }))
  }
  const start = () => {
    if (phaseRef.current !== 'idle') return
    transition('creating')
    create.mutate()
  }
  return (
    <>
      <ResponsiveModal
        variant="dialog"
        title={confirmOpen ? '放弃上传？' : '上传视频'}
        preventOutsideClose={phase === 'uploading' || phase === 'cancelling' || phase === 'cancel-failed'}
        onEscapeKeyDown={event => {
          if (confirmOpen) {
            event.preventDefault()
            resume()
          }
        }}
        open={phase !== 'idle' && phase !== 'creating'}
        onOpenChange={open => {
          if (open) return
          if (confirmOpen) {
            resume()
            return
          }
          if (phaseRef.current === 'uploading') showConfirmation()
          else cancel()
        }}
      >
        {phase === 'cancelling' || phase === 'cancel-failed' ? (
          <div className="flex flex-col items-center gap-4 px-4 py-8 text-center" role="status" aria-live="polite">
            <div
              className={`flex size-12 items-center justify-center rounded-full ${phase === 'cancelling' ? 'bg-muted' : 'bg-destructive/10 text-destructive'}`}
            >
              {phase === 'cancelling' ? (
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
              ) : (
                <CircleAlertIcon className="size-5" aria-hidden="true" />
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{phase === 'cancelling' ? '正在取消上传' : '取消未完成'}</p>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                {phase === 'cancelling' ? '正在提交取消请求，请稍候。' : '上传已停止，但取消请求未能确认，请重试。'}
              </p>
            </div>
            {phase === 'cancel-failed' && (
              <Button variant="outline" onClick={cancel} className="mt-1">
                重试取消
              </Button>
            )}
          </div>
        ) : (
          <div>
            <UploadPanel active={!confirmOpen} data-upload-progress-panel>
              <div ref={uploadPanel} tabIndex={-1} className="outline-none">
                {create.data?.url ? (
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
              </div>
            </UploadPanel>
            <UploadPanel active={confirmOpen} data-upload-confirmation>
              <section aria-label="放弃本次上传" className="pt-1">
                <p className="flex items-center gap-2 text-sm leading-relaxed text-muted-foreground">
                  <CircleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span>上传将停止，本次视频记录将被删除。</span>
                </p>
                <div className="mt-6 flex justify-end gap-3 pb-1">
                  <Button ref={continueButton} variant="outline" onClick={resume}>
                    继续上传
                  </Button>
                  <Button variant="destructive" onClick={cancel}>
                    放弃上传
                  </Button>
                </div>
              </section>
            </UploadPanel>
          </div>
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
