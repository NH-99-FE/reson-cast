import assert from 'node:assert/strict'
import { after, before, mock, test } from 'node:test'

import { PGlite, types } from '@electric-sql/pglite'
import { and, eq } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test'
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test'
const { db } = await import('../src/db')
const { subscriptions, users } = await import('../src/db/schema')
const { ratelimit } = await import('../src/lib/ratelimit')
const { subscriptionsRouter } = await import('../src/modules/subscriptions/server/procedure')

const pg = new PGlite()
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`
const viewer = id(1)
const other = id(2)
const date = new Date('2026-01-01T00:00:00Z')
const caller = subscriptionsRouter.createCaller({ clerkUserId: 'viewer' })

before(async () => {
  for (const table of [users, subscriptions]) {
    const { name, columns } = getTableConfig(table)
    await pg.exec(`CREATE TABLE "${name}" (${columns.map(column => `"${column.name}" ${column.getSQLType()}`).join(',')})`)
  }
  mock.method(db.$client, 'query', async (sql: string, params: unknown[], options: { arrayMode?: boolean }) =>
    pg.query(sql, params, { rowMode: options?.arrayMode ? 'array' : 'object', parsers: { [types.TIMESTAMP]: value => value } })
  )
  mock.method(ratelimit, 'limit', async () => ({ success: true }))
  await db.insert(users).values(
    Array.from({ length: 10 }, (_, index) => ({
      id: id(index + 1),
      clerkId: index === 0 ? 'viewer' : `user-${index}`,
      name: `Author ${index + 1}`,
      imageUrl: '/avatar.png',
      createdAt: date,
      updatedAt: date,
    }))
  )
  await db
    .insert(subscriptions)
    .values([
      ...Array.from({ length: 7 }, (_, i) => ({ viewerId: viewer, creatorId: id(i + 3), createdAt: date, updatedAt: date })),
      { viewerId: other, creatorId: id(10), createdAt: date, updatedAt: new Date('2026-02-01') },
    ])
})

after(async () => {
  mock.restoreAll()
  await pg.close()
})

test('sidebar is viewer-scoped, deterministic, limited to five and returns only navigation fields', async () => {
  const authors = await caller.getSidebar()
  assert.deepEqual(
    authors.map(author => author.id),
    [9, 8, 7, 6, 5].map(id)
  )
  assert.deepEqual(Object.keys(authors[0]).sort(), ['id', 'imageUrl', 'name'])
})

test('sidebar refills after removal and places the most recent subscription first', async () => {
  await db.delete(subscriptions).where(and(eq(subscriptions.viewerId, viewer), eq(subscriptions.creatorId, id(9))))
  assert.deepEqual(
    (await caller.getSidebar()).map(author => author.id),
    [8, 7, 6, 5, 4].map(id)
  )
  await db.insert(subscriptions).values({ viewerId: viewer, creatorId: id(10), createdAt: date, updatedAt: new Date('2026-03-01') })
  assert.deepEqual(
    (await caller.getSidebar()).map(author => author.id),
    [10, 8, 7, 6, 5].map(id)
  )
})

test('sidebar rejects unauthenticated callers', async () => {
  await assert.rejects(subscriptionsRouter.createCaller({ clerkUserId: null }).getSidebar(), { code: 'UNAUTHORIZED' })
})
