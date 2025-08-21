'use client'

import { Loader2Icon, PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { trpc } from '@/trpc/client'

import { StudioUploader } from './studio-uploader'

const StudioUploadModal = () => {
  const router = useRouter()
  const utils = trpc.useUtils()
  const create = trpc.videos.create.useMutation({
    onSuccess: () => {
      toast.success('创建成功')
      utils.studio.getMany.invalidate()
    },
    onError: () => {
      toast.error('创建失败')
    },
  })

  const onSuccess = () => {
    if (!create.data?.video.id) return
    create.reset()
    router.push(`/studio/videos/${create.data.video.id}`)
  }
  return (
    <>
      <ResponsiveModal title="上传视频" open={!!create.data?.url} onOpenChange={() => create.reset()}>
        {create.data?.url ? <StudioUploader endpoint={create.data.url} onSuccess={onSuccess} /> : <Loader2Icon />}
      </ResponsiveModal>
      <Button variant="secondary" onClick={() => create.mutate()} disabled={create.isPending}>
        {create.isPending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
        创建
      </Button>
    </>
  )
}

export default StudioUploadModal
