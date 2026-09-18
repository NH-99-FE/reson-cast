'use client'

import Link, { useLinkStatus } from 'next/link'
import { type ComponentProps } from 'react'

import { cn } from '@/lib/utils'

import styles from './sidebar-navigation.module.css'

function NavigationHint() {
  const { pending } = useLinkStatus()
  return <span className={styles.hint} data-pending={pending} role="status" aria-label={pending ? '正在切换页面' : undefined} />
}

// Keep native Link navigation, prefetching, refs and authentication guards intact.
export function SidebarNavigationLink({ children, className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={cn(styles.link, className)}>
      <NavigationHint />
      {children}
    </Link>
  )
}
