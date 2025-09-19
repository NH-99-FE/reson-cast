import { SignedIn } from '@clerk/nextjs'

import { Separator } from '@/components/ui/separator'
import { Sidebar, SidebarContent } from '@/components/ui/sidebar'
import { SubscriptionsSection } from '@/modules/home/ui/components/home-siderbar/subscriptions-section'

import { MainSection } from './main-section'
import { PersonalSection } from './personal-section'

export const HomeSidebar = () => {
  return (
    <Sidebar className="z-40 border-none pt-16" collapsible={'icon'}>
      <SidebarContent className="bg-background">
        <MainSection />
        <Separator />
        <PersonalSection />
        <SignedIn>
          <>
            <Separator />
            <SubscriptionsSection />
          </>
        </SignedIn>
      </SidebarContent>
    </Sidebar>
  )
}
