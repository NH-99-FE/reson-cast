import { AlertTriangleIcon } from 'lucide-react'

import { VideoGetOneOutput } from '../../types'

interface VideoBannerProps {
  status: VideoGetOneOutput['muxStatus']
}

export const VideoBanner = ({ status }: VideoBannerProps) => {
  if (status === 'ready') return null
  return (
    <div className="flex items-center gap-2 rounded-b-xl bg-yellow-400 px-4 py-3">
      <AlertTriangleIcon className="size-4 shrink-0 text-black" />
      <p className="line-clamp-1 text-xs font-medium text-black md:text-sm">视频仍在处理中...</p>
    </div>
  )
}
