import type { DeletedObjectJSON, UserJSON, WebhookEvent } from '@clerk/nextjs/server'
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'

import { db } from '@/db'
import { users } from '@/db/schema'

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
      await db.delete(users).where(eq(users.clerkId, d.id))
      break
    }
  }

  return new Response('OK', { status: 200 })
}
