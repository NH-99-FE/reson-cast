'use client'

import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'
import { ClapperboardIcon, UserCircleIcon, UserIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export const AuthButtons = () => {
  return (
    <>
      <SignedIn>
        <UserButton>
          <UserButton.MenuItems>
            <UserButton.Link href="/users/current" label="个人资料" labelIcon={<UserIcon className="size-4" />} />
          </UserButton.MenuItems>
          <UserButton.MenuItems>
            <UserButton.Link href="/studio" label="工作空间" labelIcon={<ClapperboardIcon className="size-4" />} />
          </UserButton.MenuItems>
        </UserButton>
      </SignedIn>
      <SignedOut>
        <SignInButton mode={'modal'}>
          <Button
            variant={'outline'}
            className="rounded-full border-blue-500/20 px-4 py-2 font-medium text-blue-600 shadow-none hover:text-blue-500"
          >
            <UserCircleIcon />
            <span>登录</span>
          </Button>
        </SignInButton>
      </SignedOut>
    </>
  )
}
