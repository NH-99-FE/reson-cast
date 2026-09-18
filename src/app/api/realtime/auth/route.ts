import { auth } from '@clerk/nextjs/server'

import { authorizeStudio } from '@/lib/realtime/auth'
import { realtimeServer } from '@/lib/realtime/server'
import { viewerId } from '@/modules/videos/server/services/access'

export async function POST(request: Request) {
  return authorizeStudio(request, {
    clerkId: async () => (await auth()).userId,
    userId: viewerId,
    sign: params => realtimeServer().auth.createTokenRequest(params),
  })
}
