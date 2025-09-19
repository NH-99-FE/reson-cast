import { inferRouterOutputs } from '@trpc/server'

import { AppRouter } from '@/trpc/routers/_app'

export type userGetOneOutput = inferRouterOutputs<AppRouter>['users']['getOne']
