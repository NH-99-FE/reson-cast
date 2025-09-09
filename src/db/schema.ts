import { integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { pgEnum } from 'drizzle-orm/pg-core/columns/enum'
import { relations } from 'drizzle-orm/relations'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(), // UUID 主键，默认随机值
    clerkId: text('clerk_id').notNull(), // Clerk 的用户ID，必填且唯一
    name: text('name').notNull(),
    imageUrl: text('image_url').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  t => [
    uniqueIndex('clerk_id_idx').on(t.clerkId), // 给 clerkId 建唯一索引（命名）
  ]
)

export const userRelations = relations(users, ({ many }) => ({
  videos: many(videos),
  videoViews: many(videoViews),
  videoReactions: many(videoReactions),
  subscriptions: many(subscriptions, {
    relationName: 'subscriptions_viewer_id_fkey',
  }),
  subscribers: many(subscriptions, {
    relationName: 'subscriptions_creator_id_fkey',
  }),
}))

export const subscriptions = pgTable(
  'subscriptions',
  {
    viewerId: uuid('viewer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    creatorId: uuid('creator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  t => [
    primaryKey({
      name: 'subscriptions_pk',
      columns: [t.viewerId, t.creatorId],
    }),
  ]
)

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  viewer: one(users, {
    fields: [subscriptions.viewerId],
    references: [users.id],
    relationName: 'subscriptions_viewer_id_fkey',
  }),
  creator: one(users, {
    fields: [subscriptions.creatorId],
    references: [users.id],
    relationName: 'subscriptions_creator_id_fkey',
  }),
}))

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  t => [uniqueIndex('name').on(t.name)]
)

export const videoVisibility = pgEnum('video_visibility', ['private', 'public'])

export const videos = pgTable('videos', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  muxStatus: text('mux_status'),
  muxAssetId: text('mux_asset_id').unique(),
  muxUploadId: text('mux_upload_id').unique(),
  muxPlaybackId: text('mux_playback_id').unique(),
  muxTrackId: text('mux_track_id').unique(),
  muxTrackStatus: text('muxTrack_status'),
  thumbnailUrl: text('thumbnail_url'),
  thumbnailKey: text('thumbnail_key'),
  previewUrl: text('preview_url'),
  previewKey: text('preview_key'),
  duration: integer('duration').default(0).notNull(),
  visibility: videoVisibility('visibility').default('private').notNull(),
  userId: uuid('user_id')
    .references(() => users.id, {
      onDelete: 'cascade',
    })
    .notNull(),
  categoryId: uuid('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const videoInsertSchema = createInsertSchema(videos)

export const videoSelectSchema = createSelectSchema(videos)

export const videoUpdateSchema = createUpdateSchema(videos)

export const categoryRelations = relations(categories, ({ many }) => ({ videos: many(videos) }))

export const videoRelations = relations(videos, ({ one, many }) => ({
  user: one(users, {
    fields: [videos.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [videos.categoryId],
    references: [categories.id],
  }),
  videoViews: many(videoViews),
  videoReactions: many(videoReactions),
}))

export const videoViews = pgTable(
  'video_views',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    videoId: uuid('video_id')
      .references(() => videos.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  t => [
    primaryKey({
      name: 'video_views_pk',
      columns: [t.userId, t.videoId],
    }),
  ]
)

export const videoViewRelations = relations(videoViews, ({ one }) => ({
  users: one(users, {
    fields: [videoViews.userId],
    references: [users.id],
  }),
  videos: one(videos, {
    fields: [videoViews.videoId],
    references: [videos.id],
  }),
}))

export const videoViewSelectSchema = createSelectSchema(videoViews)
export const videoViewInsertSchema = createInsertSchema(videoViews)
export const videoViewUpdateSchema = createUpdateSchema(videoViews)

export const reactionType = pgEnum('reaction_type', ['like', 'dislike'])

export const videoReactions = pgTable(
  'video_reactions',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    videoId: uuid('video_id')
      .references(() => videos.id, { onDelete: 'cascade' })
      .notNull(),
    type: reactionType('type').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  t => [
    primaryKey({
      name: 'video_reactions_pk',
      columns: [t.userId, t.videoId],
    }),
  ]
)

export const videoReactionRelations = relations(videoReactions, ({ one }) => ({
  users: one(users, {
    fields: [videoReactions.userId],
    references: [users.id],
  }),
  videos: one(videos, {
    fields: [videoReactions.videoId],
    references: [videos.id],
  }),
}))

export const videoReactionsSelectSchema = createSelectSchema(videoReactions)
export const videoReactionsInsertSchema = createInsertSchema(videoReactions)
export const videoReactionsUpdateSchema = createUpdateSchema(videoReactions)
