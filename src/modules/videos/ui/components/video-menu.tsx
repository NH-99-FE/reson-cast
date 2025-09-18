import { ListPlusIcon, MoreVerticalIcon, ShareIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { APP_URL } from '@/constants'
import { PlaylistAddModal } from '@/modules/playlists/ui/components/playlist-add-modal'

interface VideoMenuProps {
  videoId: string
  variant?: 'ghost' | 'secondary'
  onRemove?: () => void
}

export const VideoMenu = ({ videoId, variant = 'ghost', onRemove }: VideoMenuProps) => {
  const [isOpenPlaylistAddModal, setIsOpenPlaylistAddModal] = useState(false)

  const onShare = () => {
    const fullUrl = `${APP_URL}/videos/${videoId}`
    navigator.clipboard.writeText(fullUrl)
    toast.success('链接已复制到剪贴板')
  }
  return (
    <>
      <PlaylistAddModal videoId={videoId} open={isOpenPlaylistAddModal} onOpenChange={setIsOpenPlaylistAddModal} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size="icon" className="rounded-full">
            <MoreVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
          <DropdownMenuItem onClick={onShare}>
            <ShareIcon className="mr-2 size-4" />
            分享
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsOpenPlaylistAddModal(true)}>
            <ListPlusIcon className="mr-2 size-4" />
            加入播放列表
          </DropdownMenuItem>
          {onRemove && (
            <DropdownMenuItem onClick={onRemove}>
              <Trash2Icon className="mr-2 size-4" />
              删除
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
