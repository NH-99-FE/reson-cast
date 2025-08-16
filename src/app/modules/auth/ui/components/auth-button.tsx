'use client'

import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'
import { ClapperboardIcon, UserCircleIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export const AuthButtons = () => {
  return (
    <>
      <SignedIn>
        <UserButton>
          <UserButton.MenuItems>
            <UserButton.Link href="/studio" label="Studio" labelIcon={<ClapperboardIcon />} />
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
            登录
          </Button>
        </SignInButton>
      </SignedOut>
    </>
  )
}
