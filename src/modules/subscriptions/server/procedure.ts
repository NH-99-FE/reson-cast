import { TRPCError } from '@trpc/server'
import { and, desc, eq, getTableColumns, lt, or } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { subscriptions, users } from '@/db/schema'
import { createTRPCRouter, protectedProcedure } from '@/trpc/init'

export const subscriptionsRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            creatorId: z.uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit } = input
      const { id: userId } = ctx.user
      const data = await db
        .select({
          ...getTableColumns(subscriptions),
          user: {
            ...getTableColumns(users),
            subscriberCount: db.$count(subscriptions, eq(users.id, subscriptions.creatorId)),
          },
        })
        .from(subscriptions)
        .innerJoin(users, eq(subscriptions.creatorId, users.id))
        .where(
          and(
            eq(subscriptions.viewerId, userId),
            cursor
              ? or(
                  lt(subscriptions.updatedAt, cursor.updatedAt),
                  and(eq(subscriptions.updatedAt, cursor.updatedAt), lt(subscriptions.creatorId, cursor.creatorId))
                )
              : undefined
          )
        )
        .orderBy(desc(subscriptions.updatedAt), desc(subscriptions.creatorId))
        .limit(limit + 1)

      // 多取一条，取到的数据长度>limit则说明有下一页
      const hasMore = data.length > limit

      const items = hasMore ? data.slice(0, -1) : data

      const lastItem = items[items.length - 1]

      const nextCursor = hasMore
        ? {
            creatorId: lastItem.creatorId,
            updatedAt: lastItem.updatedAt,
          }
        : null

      return {
        items,
        nextCursor,
      }
    }),
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
