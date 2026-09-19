'use client'

import { useAuth } from '@clerk/nextjs'
import { useMutationState } from '@tanstack/react-query'
import { ListIcon, RotateCwIcon } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { SidebarNavigationLink } from '@/components/sidebar-navigation'
import { Separator } from '@/components/ui/separator'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/modules/studio/ui/components/user-avatar'
import {
  getSidebarSubscriptions,
  SIDEBAR_SUBSCRIPTIONS_LIMIT,
  SIDEBAR_SUBSCRIPTIONS_STALE_TIME,
  type SubscriptionChange,
} from '@/modules/subscriptions/lib/sidebar'
import { trpc } from '@/trpc/client'

export const LoadingSkeleton = () => (
  <>
    {Array.from({ length: SIDEBAR_SUBSCRIPTIONS_LIMIT }, (_, index) => (
      <SidebarMenuItem key={index} aria-hidden="true">
        <div className="flex h-8 items-center gap-4 rounded-md p-2">
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-24 group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarMenuItem>
    ))}
  </>
)

export const SubscriptionsSection = () => {
  const pathname = usePathname()
  const { isLoaded, isSignedIn } = useAuth()
  const { data, error, isFetching, refetch } = trpc.subscriptions.getSidebar.useQuery(undefined, {
    enabled: isLoaded && isSignedIn,
    staleTime: SIDEBAR_SUBSCRIPTIONS_STALE_TIME,
    retry: (failureCount, error) => failureCount < 1 && error.data?.code !== 'UNAUTHORIZED' && error.data?.code !== 'FORBIDDEN',
  })
  const pendingChanges = useMutationState({
    filters: { status: 'pending', predicate: mutation => !!mutation.options.meta?.subscriptionChange },
    select: mutation => ({
      change: mutation.options.meta?.subscriptionChange as SubscriptionChange,
      submittedAt: mutation.state.submittedAt,
    }),
  })

  if (isLoaded && !isSignedIn) return null

  const subscriptions = getSidebarSubscriptions(
    data ?? [],
    [...pendingChanges].sort((a, b) => a.submittedAt - b.submittedAt).map(item => item.change)
  )
  const hasContent = data !== undefined || subscriptions.length > 0
  const showLoading = !hasContent && (!isLoaded || !error)

  return (
    <>
      <Separator />
      <SidebarGroup role="region" aria-label="订阅">
        <SidebarGroupLabel>订阅</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu aria-busy={showLoading}>
            {showLoading && <LoadingSkeleton />}

            {subscriptions.map(author => (
              <SidebarMenuItem key={author.id}>
                <SidebarMenuButton tooltip={author.name} asChild isActive={pathname === `/users/${author.id}`}>
                  <SidebarNavigationLink href={`/users/${author.id}`} className="flex items-center gap-4">
                    <UserAvatar size="xs" imageUrl={author.imageUrl} name={author.name} />
                    <span className="truncate text-sm">{author.name}</span>
                  </SidebarNavigationLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}

            {!hasContent && isLoaded && error && (
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="重试加载订阅" onClick={() => void refetch()} disabled={isFetching}>
                  <RotateCwIcon className="size-4" />
                  <span className="text-sm text-muted-foreground">{isFetching ? '正在重试…' : '暂时无法加载 · 重试'}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {hasContent && subscriptions.length === 0 && (
              <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
                <p className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">订阅后，可在这里快速找到创作者</p>
              </SidebarMenuItem>
            )}

            <SidebarMenuItem>
              <SidebarMenuButton tooltip="查看全部订阅" asChild isActive={pathname === '/subscriptions'}>
                <SidebarNavigationLink href="/subscriptions" className="flex items-center gap-4">
                  <ListIcon className="size-4" />
                  <span className="text-sm">查看全部订阅</span>
                </SidebarNavigationLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}
