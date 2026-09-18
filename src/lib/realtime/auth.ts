import type { TokenDetails } from 'ably'

import { studioCapability } from './events'

export async function authorizeStudio(
  request: Request,
  io: {
    clerkId: () => Promise<string | null>
    userId: (clerkId: string) => Promise<string | undefined>
    sign: (params: { clientId: string; ttl: number; capability: string }) => TokenDetails | Promise<TokenDetails>
  }
) {
  const clerkId = await io.clerkId()
  if (!clerkId) return new Response('Unauthorized', { status: 401 })
  if (new URL(request.url).search || (await request.text()).trim()) return new Response('Unexpected parameters', { status: 400 })
  const userId = await io.userId(clerkId)
  if (!userId) return new Response('Unauthorized', { status: 401 })
  const token = await io.sign({ clientId: userId, ttl: 10 * 60 * 1000, capability: JSON.stringify(studioCapability(userId)) })
  return Response.json(token, { headers: { 'Cache-Control': 'no-store' } })
}
