import MuxUploader, { MuxUploaderDrop, MuxUploaderFileSelect, MuxUploaderProgress, MuxUploaderStatus } from '@mux/mux-uploader-react'

interface MuxUploaderProps {
  endpoint?: string | null
  onSuccess: () => void
}

export const StudioUploader = ({ endpoint, onSuccess }: MuxUploaderProps) => {
  return (
    <div>
      <MuxUploader endpoint={endpoint}></MuxUploader>
    </div>
  )
}
