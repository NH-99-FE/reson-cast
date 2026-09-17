import { TRPCError } from '@trpc/server'
import { and, eq, isNull, or } from 'drizzle-orm'

import { db } from '@/db'
import { comments, users, videos } from '@/db/schema'

export const publicVideoCondition = () => and(eq(videos.visibility, 'public'), isNull(videos.deletionRequestedAt))
export const readableVideoCondition = (userId?: string) =>
  and(
    isNull(videos.deletionRequestedAt),
    userId ? or(eq(videos.visibility, 'public'), eq(videos.userId, userId)) : eq(videos.visibility, 'public')
  )
export async function viewerId(clerkId: string | null) {
  if (!clerkId) return undefined
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1)
  return user?.id
}
export async function requireVideo(videoId: string, userId?: string, ownerOnly = false) {
  const [video] = await db
    .select()
    .from(videos)
    .where(and(eq(videos.id, videoId), readableVideoCondition(userId)))
    .limit(1)
  if (!video || (ownerOnly && video.userId !== userId)) throw new TRPCError({ code: 'NOT_FOUND' })
  return video
}
export async function requireComment(commentId: string, userId?: string) {
  const [comment] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1)
  if (!comment) throw new TRPCError({ code: 'NOT_FOUND' })
  await requireVideo(comment.videoId, userId)
  return comment
}
