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
  const onUploadComplete = () => {
    utils.studio.getOne.invalidate({ id: videoId })
    utils.studio.getMany.invalidate()
    onOpenChange(false)
  }
  return (
    <ResponsiveModal open={open} title="上传缩略图" onOpenChange={onOpenChange}>
      <UploadDropzone endpoint="thumbnailUploader" input={{ videoId }} onClientUploadComplete={onUploadComplete} />
    </ResponsiveModal>
  )
}
