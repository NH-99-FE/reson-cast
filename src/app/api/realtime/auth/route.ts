import { auth } from '@clerk/nextjs/server'

import { authorizeStudio } from '@/lib/realtime/auth'
import { signRealtimeToken } from '@/lib/realtime/token'
import { viewerId } from '@/modules/videos/server/services/access'

export async function POST(request: Request) {
  return authorizeStudio(request, {
    clerkId: async () => (await auth()).userId,
    userId: viewerId,
    sign: params => signRealtimeToken(process.env.ABLY_API_KEY, params),
  })
}
