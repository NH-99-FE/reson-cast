import React from 'react'

import { SidebarProvider } from '@/components/ui/sidebar'

import { StudioNavbar } from '../components/studio-navbar'
import { StudioRealtimeProvider } from '../components/studio-realtime-provider'
import { StudioSidebar } from '../components/studio-sidebar'

interface StudioLayoutProps {
  children: React.ReactNode
}
export const StudioLayout = ({ children }: StudioLayoutProps) => {
  return (
    <SidebarProvider>
      <StudioRealtimeProvider>
        <div className="w-full">
          <StudioNavbar />
          <div className="flex min-h-screen pt-16">
            <StudioSidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </StudioRealtimeProvider>
    </SidebarProvider>
  )
}
