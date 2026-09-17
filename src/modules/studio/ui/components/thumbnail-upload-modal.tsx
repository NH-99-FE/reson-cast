import { toast } from 'sonner'

import { ResponsiveModal } from '@/components/responsive-modal'
import { UploadDropzone } from '@/lib/uploadthing'
import { trpc } from '@/trpc/client'

interface ThumbnailUploadModalProps {
  videoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ThumbnailUploadModal = ({ videoId, onOpenChange, open }: ThumbnailUploadModalProps) => {
  const utils = trpc.useUtils()
  const onUploadComplete = (attached: boolean) => {
    utils.studio.getOne.invalidate({ id: videoId })
    utils.studio.getMany.invalidate()
    utils.videos.invalidate()
    if (!attached) {
      toast.info('本次上传未应用，封面可能已被其他操作更新，请重新上传')
      return
    }
    onOpenChange(false)
  }
  return (
    <ResponsiveModal open={open} title="上传缩略图" onOpenChange={onOpenChange}>
      <UploadDropzone
        endpoint="thumbnailUploader"
        input={{ videoId }}
        onClientUploadComplete={files => onUploadComplete(files[0]?.serverData.attached === true)}
      />
    </ResponsiveModal>
  )
}
