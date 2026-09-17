import type { DeletedObjectJSON, UserJSON, WebhookEvent } from '@clerk/nextjs/server'
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'

import { db } from '@/db'
import { users, videos } from '@/db/schema'
import { workflow } from '@/lib/workflow'

export async function POST(req: NextRequest) {
  const evt = (await verifyWebhook(req)) as WebhookEvent

  switch (evt.type) {
    case 'user.created':
    case 'user.updated': {
      const u = evt.data as UserJSON
      const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || (u.username ?? '')
      await db
        .insert(users)
        .values({
          clerkId: u.id,
          name: fullName,
          imageUrl: u.image_url ?? '',
        })
        .onConflictDoUpdate({
          target: users.clerkId,
          set: { name: fullName, imageUrl: u.image_url ?? '' },
        })
      break
    }
    case 'user.deleted': {
      const d = evt.data as DeletedObjectJSON
      if (!d.id) return new Response('Bad payload', { status: 400 }) // 确保不是 undefined
      const [user] = await db.select().from(users).where(eq(users.clerkId, d.id))
      if (!user) break
      await db.update(videos).set({ deletionRequestedAt: new Date() }).where(eq(videos.userId, user.id))
      await workflow.trigger({
        url: `${process.env.UPSTASH_WORKFLOW_URL}/api/users/workflows/delete`,
        workflowRunId: `delete-user-${user.id}`,
        body: { userId: user.id },
        retries: 3,
      })
      break
    }
  }

  return new Response('OK', { status: 200 })
}
