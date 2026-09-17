import { fetchRequestHandler } from '@trpc/server/adapters/fetch'

import { createTRPCContext } from '@/trpc/init'
import { appRouter } from '@/trpc/routers/_app'
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
    responseMeta: () => ({ headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } }),
  })
export { handler as GET, handler as POST }
