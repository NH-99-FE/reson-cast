import { useAuth } from '@clerk/nextjs'
import { Edit2Icon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { userGetOneOutput } from '@/modules/users/types'
import { BannerUploadModal } from '@/modules/users/ui/components/banner-upload-modal'

interface UserPageBannerProps {
  user: userGetOneOutput
}

export const UserPageBannerSkeleton = () => {
  return <Skeleton className="h-[25vh] max-h-[200px] w-full rounded-xl" />
}

export const UserPageBanner = ({ user }: UserPageBannerProps) => {
  const { userId } = useAuth()
  const [isBannerUploadModalOpen, setIsBannerUploadModalOpen] = useState(false)
  console.log(user)
  return (
    <div className="group relative">
      <BannerUploadModal userId={user.id} open={isBannerUploadModalOpen} onOpenChange={setIsBannerUploadModalOpen} />
      <div
        className={cn(
          'h-[25vh] max-h-[200px] w-full rounded-xl',
          user.bannerUrl ? 'bg-cover bg-center' : 'bg-gradient-to-r from-gray-100 to-gray-200'
        )}
        style={user.bannerUrl ? { backgroundImage: `url(${user.bannerUrl})` } : undefined}
      >
        {user.clerkId === userId && (
          <Button
            type="button"
            size="icon"
            className="absolute top-4 right-4 rounded-full bg-black/40 opacity-100 transition-opacity duration-300 group-hover:opacity-100 hover:bg-black/50 md:opacity-0"
            onClick={() => {
              setIsBannerUploadModalOpen(true)
            }}
          >
            <Edit2Icon className="size-4 text-white" />
          </Button>
        )}
      </div>
    </div>
  )
}
