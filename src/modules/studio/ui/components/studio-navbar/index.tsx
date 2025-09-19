import Image from 'next/image'
import Link from 'next/link'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { AuthButtons } from '@/modules/auth/ui/components/auth-button'

import StudioUploadModal from '../studio-upload-modal'

export const StudioNavbar = () => {
  return (
    <nav className="fixed top-0 right-0 left-0 z-50 flex h-16 items-center border-b bg-background px-2 pr-5 shadow-md">
      <div className="flex w-full items-center gap-4">
        {/*菜单和logo*/}
        <div className="flex flex-shrink-0 items-center">
          <SidebarTrigger />
          <Link prefetch href="/studio" className="hidden md:block">
            <div className="flex items-center gap-1 p-4">
              <Image src="/logo.svg" alt="logo" width={32} height={32}></Image>
              <p className="text-xl font-semibold tracking-tight">工作空间</p>
            </div>
          </Link>
        </div>
        {/*占位区域*/}
        <div className="flex-1" />
        {/*退出*/}
        <div className="flex flex-shrink-0 items-center gap-4">
          <StudioUploadModal />
          <AuthButtons />
        </div>
      </div>
    </nav>
  )
}
