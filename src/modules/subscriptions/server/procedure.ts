import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { subscriptions } from '@/db/schema'
import { createTRPCRouter, protectedProcedure } from '@/trpc/init'

export const subscriptionsRouter = createTRPCRouter({
  create: protectedProcedure.input(z.object({ userId: z.uuid() })).mutation(async ({ input, ctx }) => {
    const { userId: creatorId } = input
    const { id: viewerId } = ctx.user
    if (creatorId == viewerId) {
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }

    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.viewerId, viewerId), eq(subscriptions.creatorId, creatorId)))
      .limit(1)

    if (existing) {
      return existing
    }

    const [createSubscription] = await db
      .insert(subscriptions)
      .values({ viewerId, creatorId })
      .onConflictDoUpdate({
        target: [subscriptions.viewerId, subscriptions.creatorId],
        set: { updatedAt: new Date() },
      })
      .returning()
    return createSubscription
  }),
  remove: protectedProcedure.input(z.object({ userId: z.uuid() })).mutation(async ({ input, ctx }) => {
    const { userId: creatorId } = input
    const { id: viewerId } = ctx.user
    if (creatorId == viewerId) {
      throw new TRPCError({ code: 'BAD_REQUEST' })
    }

    const [deleteSubscription] = await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.creatorId, creatorId), eq(subscriptions.viewerId, viewerId)))
      .returning()

    if (!deleteSubscription) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Subscription not found' })
    }
    return deleteSubscription
  }),
})
