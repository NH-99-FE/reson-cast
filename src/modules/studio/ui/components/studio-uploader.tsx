import MuxUploader, { MuxUploaderDrop, MuxUploaderFileSelect, MuxUploaderProgress, MuxUploaderStatus } from '@mux/mux-uploader-react'
import { UploadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface MuxUploaderProps {
  endpoint?: string | null
  onSuccess: () => void
}

const UPLOADER_ID = 'video-uploader'

export const StudioUploader = ({ endpoint, onSuccess }: MuxUploaderProps) => {
  return (
    <div>
      <MuxUploader onSuccess={onSuccess} endpoint={endpoint} id={UPLOADER_ID} className="group/uploader hidden" />
      <MuxUploaderDrop muxUploader={UPLOADER_ID} className="group/drop">
        <div slot="heading" className="flex flex-col items-center gap-6">
          <div className="flex h-32 w-32 items-center justify-center gap-2 rounded-full bg-muted">
            <UploadIcon className="group/frop-[&[active]]:animate-bounce size-10 text-muted-foreground transition-all duration-300" />
          </div>
          <div className="flex flex-col gap-2 text-center">
            <p className="text-sm">将视频文件拖到此处上传</p>
            <p className="text-xs text-muted-foreground">你的视频文件将是隐私的直到你公开它们</p>
          </div>
          <MuxUploaderFileSelect muxUploader={UPLOADER_ID}>
            <Button type={'button'} className="rounded-full">
              选择文件
            </Button>
          </MuxUploaderFileSelect>
        </div>
        <span slot="separator" className="hidden" />
        <MuxUploaderStatus muxUploader={UPLOADER_ID} className="text-sm" />
        <MuxUploaderProgress muxUploader={UPLOADER_ID} className="text-sm" type="percentage" />
        <MuxUploaderProgress muxUploader={UPLOADER_ID} type="bar" />
      </MuxUploaderDrop>
    </div>
  )
}
