'use client'
// ^-- to make sure we can mount the Provider from a server component
import { useAuth } from '@clerk/nextjs'
import { QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import { useState } from 'react'
import superjson from 'superjson'

import { APP_URL } from '@/constants'

import { makeQueryClient } from './query-client'
import type { AppRouter } from './routers/_app'
export const trpc = createTRPCReact<AppRouter>()
function getUrl() {
  const base = (() => {
    if (typeof window !== 'undefined') return ''
    return APP_URL
  })()
  return `${base}/api/trpc`
}
function IdentityTRPCProvider(
  props: Readonly<{
    children: React.ReactNode
  }>
) {
  const [queryClient] = useState(makeQueryClient)
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: getUrl(),
        }),
      ],
    })
  )
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
    </trpc.Provider>
  )
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth()
  return <IdentityTRPCProvider key={userId ?? 'guest'}>{children}</IdentityTRPCProvider>
}
