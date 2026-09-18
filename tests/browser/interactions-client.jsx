import { QueryClientProvider } from '@tanstack/react-query'
import { createTRPCReact } from '@trpc/react-query'
import { observable } from '@trpc/server/observable'

import { makeQueryClient } from '../../src/trpc/query-client'

export const trpc = createTRPCReact()
export const state = {
  comments: {},
  pendingComments: {},
  pendingWrites: {},
  reaction: null,
  subscribed: false,
  fail: false,
  writes: 0,
  release: null,
}
window.interactions = state
const handle = async ({ path, input }) => {
  if (path === 'comments.getMany')
    return {
      items: ['first', 'second'].map(id => ({
        id,
        videoId: 'video',
        parentId: null,
        userId: 'creator',
        value: id,
        createdAt: new Date(),
        replyCount: 0,
        user: { clerkId: 'creator', name: 'Creator', imageUrl: '' },
        videoOwnerClerkId: 'creator',
        viewerReaction: state.comments[id] ?? null,
        likeCount: Number(state.comments[id] === 'like'),
        dislikeCount: Number(state.comments[id] === 'dislike'),
      })),
      nextCursor: null,
    }
  if (path.startsWith('commentReactions.')) {
    await new Promise((resolve, reject) => {
      state.pendingComments[input.commentId] = fail => (fail ? reject(new Error('Failed reaction')) : resolve())
    })
    const action = path.split('.')[1]
    state.comments[input.commentId] = state.comments[input.commentId] === action ? null : action
    return {}
  }
  if (path === 'videos.getOne')
    return {
      viewerReaction: state.reaction,
      likeCount: 10 + Number(state.reaction === 'like'),
      dislikeCount: 2 + Number(state.reaction === 'dislike'),
      user: { viewerSubscribed: state.subscribed, subscriberCount: 5 + Number(state.subscribed) },
    }
  if (path === 'users.getOne') return { viewerSubscribed: state.subscribed, subscriberCount: 5 + Number(state.subscribed) }
  if (path.startsWith('videoReactions.') || path.startsWith('subscriptions.')) {
    state.writes++
    await new Promise(resolve => {
      state.release = resolve
      state.pendingWrites[path] = resolve
    })
    if (state.fail) throw new Error('Simulated backend failure')
    if (path.startsWith('videoReactions.')) {
      const reaction = path.split('.')[1]
      state.reaction = state.reaction === reaction ? null : reaction
    } else state.subscribed = path.endsWith('create')
    return {}
  }
  throw new Error(`Unexpected operation: ${path}`)
}
const queryClient = makeQueryClient()
queryClient.setDefaultOptions({ queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } })
const client = trpc.createClient({
  links: [
    () =>
      ({ op }) =>
        observable(observer => {
          handle(op).then(
            data => {
              observer.next({ result: { data } })
              observer.complete()
            },
            error => observer.error(error)
          )
        }),
  ],
})
export const Provider = ({ children }) => (
  <trpc.Provider client={client} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </trpc.Provider>
)
