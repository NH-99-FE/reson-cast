import { categoriesRouter } from '@/modules/categories/server/procedures'
import { commentsRouter } from '@/modules/comments/server/procedures'
import { studioRouter } from '@/modules/studio/server/procedures'
import { subscriptionsRouter } from '@/modules/subscriptions/server/procedure'
import { videoReactionsRouter } from '@/modules/video-reactions/server/procedures'
import { videoViewsRouter } from '@/modules/video-views/server/procedures'
import { videosRouter } from '@/modules/videos/server/procedures'

import { createTRPCRouter } from '../init'
export const appRouter = createTRPCRouter({
  studio: studioRouter,
  categories: categoriesRouter,
  videos: videosRouter,
  videoViews: videoViewsRouter,
  videoReactions: videoReactionsRouter,
  subscriptions: subscriptionsRouter,
  comments: commentsRouter,
})
// export type definition of API
export type AppRouter = typeof appRouter
