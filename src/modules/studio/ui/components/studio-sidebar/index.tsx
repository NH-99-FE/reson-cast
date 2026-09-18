'use client'

import { LogOutIcon, VideoIcon } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { SidebarNavigationLink } from '@/components/sidebar-navigation'
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
                <SidebarNavigationLink href="/studio">
                  <VideoIcon className="size-5" />
                  <span className="text-sm">视频内容</span>
                </SidebarNavigationLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <Separator />
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="退出工作空间" asChild>
                <SidebarNavigationLink href="/">
                  <LogOutIcon className="size-5" />
                  <span className="text-sm">退出工作空间</span>
                </SidebarNavigationLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
