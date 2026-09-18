import assert from 'node:assert/strict'
import { after, before, beforeEach, mock, test } from 'node:test'

import { PGlite, types } from '@electric-sql/pglite'
import { getTableConfig } from 'drizzle-orm/pg-core'

import { publicMuxThumbnailPath, publicThumbnailPath } from '../src/lib/video-image-source'

process.env.DATABASE_URL = 'postgresql://test:test@localhost/test'
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test'
const { db } = await import('../src/db')
const { playlists, playlistVideos, users, videos } = await import('../src/db/schema')
const { ratelimit } = await import('../src/lib/ratelimit')
const { playlistsRouter } = await import('../src/modules/playlists/server/procedures')

const pg = new PGlite()
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`
const owner = id(1)
const other = id(2)
const updatedAt = new Date('2026-01-01T00:00:00Z')
const caller = playlistsRouter.createCaller({ clerkUserId: 'owner' })
let queries = 0

before(async () => {
  for (const table of [users, playlists, playlistVideos, videos]) {
    const { name, columns } = getTableConfig(table)
    const definitions = columns.map(column => `"${column.name}" ${column.getSQLType().replace('video_visibility', 'text')}`)
    await pg.exec(`CREATE TABLE "${name}" (${definitions.join(',')})`)
  }
  // Execute the real router SQL locally, preserving Neon's array rows and timestamp strings.
  mock.method(db.$client, 'query', async (sql: string, params: unknown[], options: { arrayMode?: boolean }) => {
    queries++
    return pg.query(sql, params, {
      rowMode: options?.arrayMode ? 'array' : 'object',
      parsers: { [types.TIMESTAMP]: value => value },
    })
  })
  mock.method(ratelimit, 'limit', async () => ({ success: true }))
  await db.insert(users).values(
    [owner, other].map((userId, index) => ({
      id: userId,
      clerkId: index === 0 ? 'owner' : 'other',
      name: `User ${index}`,
      imageUrl: '/avatar.png',
      createdAt: updatedAt,
      updatedAt,
    }))
  )
})

beforeEach(async () => {
  await pg.exec('TRUNCATE playlists, playlist_videos, videos')
})

after(async () => {
  mock.restoreAll()
  await pg.close()
})

test('playlist covers use the latest eligible video and preserve custom, Mux, fallback, and empty results', async () => {
  const names = ['custom', 'mux', 'fallback', 'missing-image', 'empty', 'hidden-only']
  await db.insert(playlists).values(names.map((name, index) => ({ id: id(10 + index), userId: owner, name, updatedAt })))
  const sources = [
    { id: id(100), thumbnailKey: '封面/key', muxPlaybackId: 'custom-mux' },
    { id: id(101), muxPlaybackId: 'mux' },
    { id: id(102), thumbnailUrl: '/legacy-cover.png' },
    { id: id(103) },
    { id: id(104), visibility: 'private' as const, thumbnailKey: 'private' },
    { id: id(105), deletionRequestedAt: updatedAt, thumbnailKey: 'deleted' },
    { id: id(106), muxPlaybackId: 'older-mux' },
  ]
  await db.insert(videos).values(sources.map(source => ({ userId: owner, title: 'Video', visibility: 'public' as const, ...source })))
  await db
    .insert(playlistVideos)
    .values([
      ...sources.slice(0, 4).map((source, index) => ({ playlistId: id(10 + index), videoId: source.id, updatedAt })),
      { playlistId: id(10), videoId: id(104), updatedAt: new Date('2026-01-03') },
      { playlistId: id(10), videoId: id(105), updatedAt: new Date('2026-01-04') },
      { playlistId: id(10), videoId: id(106), updatedAt: new Date('2025-12-01') },
      { playlistId: id(15), videoId: id(104), updatedAt },
      { playlistId: id(15), videoId: id(105), updatedAt },
    ])

  queries = 0
  const result = await caller.getMany({ limit: 100 })
  assert.equal(queries, 2, 'one authentication lookup and one playlist query, without per-playlist lookups')
  assert.deepEqual(Object.fromEntries(result.items.map(item => [item.name, item.thumbnailUrl])), {
    custom: publicThumbnailPath(id(100), '封面/key'),
    mux: publicMuxThumbnailPath(id(101), 'mux'),
    fallback: '/legacy-cover.png',
    'missing-image': null,
    empty: null,
    'hidden-only': null,
  })
  assert.deepEqual(
    result.items.map(item => Number(item.videoCount)),
    [0, 0, 1, 1, 1, 2]
  )
  assert.ok(result.items.every(item => !('thumbnailVideo' in item) && item.user.id === owner))
  assert.equal(result.nextCursor, null)
})

test('thumbnail mapping preserves owner scoping and cursor pagination', async () => {
  await db
    .insert(playlists)
    .values([
      ...[10, 11, 12].map(value => ({ id: id(value), userId: owner, name: `Playlist ${value}`, updatedAt })),
      { id: id(13), userId: other, name: 'Other user playlist', updatedAt },
    ])
  await db.insert(videos).values({ id: id(100), userId: owner, title: 'Video', visibility: 'public', muxPlaybackId: 'mux' })
  await db.insert(playlistVideos).values({ playlistId: id(10), videoId: id(100), updatedAt })

  const first = await caller.getMany({ limit: 2 })
  assert.deepEqual(
    first.items.map(item => item.id),
    [id(12), id(11)]
  )
  assert.deepEqual(first.nextCursor, { id: id(11), updatedAt })
  const second = await caller.getMany({ limit: 2, cursor: first.nextCursor })
  assert.deepEqual(
    second.items.map(item => item.id),
    [id(10)]
  )
  assert.equal(second.items[0].thumbnailUrl, publicMuxThumbnailPath(id(100), 'mux'))
  assert.equal(second.nextCursor, null)
})
