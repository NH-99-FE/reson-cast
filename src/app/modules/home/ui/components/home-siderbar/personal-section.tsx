'use client'

import { useAuth, useClerk } from '@clerk/nextjs'
import { HistoryIcon, ListVideoIcon, ThumbsUpIcon } from 'lucide-react'
import Link from 'next/link'

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const items = [
  {
    title: '历史',
    url: '/playlists/history',
    icon: HistoryIcon,
    auth: true,
  },
  {
    title: '点赞',
    url: '/playlists/liked',
    icon: ThumbsUpIcon,
    auth: true,
  },
  {
    title: '视频',
    url: '/playlists',
    icon: ListVideoIcon,
    auth: true,
  },
]

export const PersonalSection = () => {
  const { isSignedIn } = useAuth()
  const clerk = useClerk()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>我的</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                asChild
                isActive={false}
                onClick={e => {
                  if (!isSignedIn && item.auth) {
                    e.preventDefault()
                    return clerk.openSignIn()
                  }
                }}
              >
                <Link href={item.url} className="flex items-center gap-4">
                  <item.icon />
                  <span className="text-sm">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
