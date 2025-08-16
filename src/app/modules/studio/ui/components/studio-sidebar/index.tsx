'use client'

import { LogOutIcon, VideoIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Separator } from '@/components/ui/separator'
import { Sidebar, SidebarContent, SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

import StudioSidebarHeader from './studio-sidebar-header'

export const StudioSidebar = () => {
  const pathname = usePathname()
  return (
    <Sidebar className="z-40 border-none pt-16" collapsible={'icon'}>
      <SidebarContent className="bg-background">
        <SidebarGroup>
          <SidebarMenu>
            <StudioSidebarHeader />
            <SidebarMenuItem>
              <SidebarMenuButton isActive={pathname === '/studio'} tooltip="视频内容" asChild>
                <Link href="/">
                  <VideoIcon className="size-5" />
                  <span className="text-sm">视频内容</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <Separator />
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="退出工作空间" asChild>
                <Link href="/">
                  <LogOutIcon className="size-5" />
                  <span className="text-sm">退出工作空间</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
