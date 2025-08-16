import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm/relations'

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

export const videos = pgTable('videos', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
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

export const userRelations = relations(users, ({ many }) => ({ videos: many(videos) }))

export const categoryRelations = relations(categories, ({ many }) => ({ videos: many(videos) }))

export const videoRelations = relations(videos, ({ one }) => ({
  user: one(users, {
    fields: [videos.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [videos.categoryId],
    references: [categories.id],
  }),
}))
