import { auth } from '@clerk/nextjs/server'
import React from 'react'

import { HomeLayout } from '@/modules/home/ui/layouts/home-layout'
import { SIDEBAR_SUBSCRIPTIONS_STALE_TIME } from '@/modules/subscriptions/lib/sidebar'
import { HydrateClient, trpc } from '@/trpc/server'

interface LayoutProps {
  children: React.ReactNode
}

const Layout = async ({ children }: LayoutProps) => {
  const { userId } = await auth()
  if (userId) {
    // Stream the pending query without making the page wait for the sidebar.
    void trpc.subscriptions.getSidebar.prefetch(undefined, { staleTime: SIDEBAR_SUBSCRIPTIONS_STALE_TIME })
  }

  return (
    <HydrateClient>
      <HomeLayout>{children}</HomeLayout>
    </HydrateClient>
  )
}

export default Layout
