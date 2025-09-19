import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

import { SidebarHeader, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/modules/studio/ui/components/user-avatar'

const StudioSidebarHeader = () => {
  const { user } = useUser()
  const { state } = useSidebar()
  if (!user)
    return (
      <SidebarHeader className="flex flex-col items-center pb-4">
        <Skeleton className="size-[112px] rounded-full" />
        <div className="mt-2 flex flex-col items-center gap-y-2">
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-4 w-[100px]" />
        </div>
      </SidebarHeader>
    )
  if (state === 'collapsed') {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton tooltip="我的简介" asChild>
          <Link prefetch href="/users/current">
            <UserAvatar imageUrl={user.imageUrl} name={user.fullName ?? 'User'} size="xs" />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }
  return (
    <SidebarHeader className="flex flex-col items-center pb-4">
      <Link prefetch href="/users/current">
        <UserAvatar imageUrl={user.imageUrl} name={user.fullName ?? 'User'} className="size-[112px] transition-opacity hover:opacity-80" />
      </Link>
      <div className="mt-2 flex flex-col items-center gap-y-1">
        <p className="text-sm font-medium">{user.fullName}</p>
        <p className="text-sm text-muted-foreground">{user.emailAddresses[0].emailAddress}</p>
      </div>
    </SidebarHeader>
  )
}

export default StudioSidebarHeader
