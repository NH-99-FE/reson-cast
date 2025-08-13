import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { HydrateClient, trpc } from '@/trpc/server'

import { PageClient } from './client'

export default async function Home() {
  void trpc.hello.prefetch({ text: 'jack' })
  return (
    <HydrateClient>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading...</div>}>
          <PageClient />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
