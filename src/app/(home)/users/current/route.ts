import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import { users } from '@/db/schema'

export const GET = async () => {
  const { userId: userClerkId } = await auth()

  if (!userClerkId) {
    return redirect('/sign-in')
  }

  const [existingUser] = await db.select().from(users).where(eq(users.clerkId, userClerkId))

  if (!existingUser) {
    return redirect('/sign-in')
  }
  return redirect(`/users/${existingUser.id}`)
}
