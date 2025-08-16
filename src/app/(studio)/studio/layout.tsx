import React from 'react'

import { StudioLayout } from '@/modules/studio/ui/layouts/Studio-layout'

interface LayoutProps {
  children: React.ReactNode
}
const Layout = ({ children }: LayoutProps) => {
  return <StudioLayout>{children}</StudioLayout>
}

export default Layout
