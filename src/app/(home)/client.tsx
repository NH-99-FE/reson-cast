'use client'

import { trpc } from '@/trpc/client'

export const PageClient = () => {
  const [data] = trpc.hello.useSuspenseQuery({
    text: 'jack',
  })
  return <div>Page client page say: {data.greeting}</div>
}
