'use client'

import { useAuth } from '@clerk/nextjs'
import { ListIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_LIMIT } from '@/constants'
import { UserAvatar } from '@/modules/studio/ui/components/user-avatar'
import { trpc } from '@/trpc/client'

export const LoadingSkeleton = () => {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <SidebarMenuItem key={index}>
          <SidebarMenuButton>
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-full" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  )
}

export const SubscriptionsSection = () => {
  const pathname = usePathname()
  const { isSignedIn, isLoaded } = useAuth()

  const { data, isLoading, error } = trpc.subscriptions.getMany.useInfiniteQuery(
    {
      limit: DEFAULT_LIMIT,
    },
    {
      getNextPageParam: lastPage => lastPage.nextCursor,
      enabled: isSignedIn && isLoaded, // 确保 Clerk 已加载且用户已登录
    }
  )

  return (
    <SidebarGroup>
      <SidebarGroupLabel>订阅</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* Clerk 状态未加载时显示骨架 */}
          {!isLoaded && <LoadingSkeleton />}

          {/* 已加载但未登录时不显示内容 */}
          {isLoaded && !isSignedIn && null}

          {/* 已登录且正在加载数据时显示骨架 */}
          {isLoaded && isSignedIn && isLoading && <LoadingSkeleton />}

          {/* 已登录且数据加载完成时显示订阅列表 */}
          {isLoaded &&
            isSignedIn &&
            !isLoading &&
            !error &&
            data?.pages.flatMap(page =>
              page.items.map(subscription => (
                <SidebarMenuItem key={`${subscription.creatorId}-${subscription.viewerId}`}>
                  <SidebarMenuButton tooltip={subscription.user.name} asChild isActive={pathname === `/users/${subscription.user.id}`}>
                    <Link prefetch href={`/users/${subscription.user.id}`} className="flex items-center gap-5">
                      <UserAvatar size="xs" imageUrl={subscription.user.imageUrl} name={subscription.user.name} />
                      <span className="text-sm">{subscription.user.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            )}

          {/* 已登录时始终显示订阅列表链接 */}
          {isLoaded && isSignedIn && !isLoading && !error && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/subscriptions'}>
                <Link prefetch href="/subscriptions" className="flex items-center gap-4">
                  <ListIcon className="size-4" />
                  <span className="text-sm">订阅列表</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
