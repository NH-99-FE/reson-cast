import { dehydrate, HydrationBoundary, QueryClientProvider } from '@tanstack/react-query'
import { createTRPCReact, getQueryKey } from '@trpc/react-query'
import { observable } from '@trpc/server/observable'

import { makeQueryClient } from '../../src/trpc/query-client'

export const trpc = createTRPCReact()
const scenario = new URLSearchParams(window.location.search).get('sidebar')
const author = id => ({
  id,
  name: id === 'creator' ? '新订阅作者' : `订阅作者 ${id}`,
  imageUrl:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16"%3E%3Crect width="16" height="16" fill="%2394a3b8"/%3E%3C/svg%3E',
})
export const state = {
  playlistEmpty: new URLSearchParams(window.location.search).get('playlist') === 'empty',
  playlistFail: new URLSearchParams(window.location.search).get('playlist') === 'fail',
  playlistReads: 0,
  playlistContains: false,
  holdPlaylist: false,
  releasePlaylist: null,
  authors: scenario === 'empty' ? [] : Array.from({ length: 8 }, (_, i) => author(String(i + 1))),
  sidebarFail: scenario === 'fail',
  holdSidebar: scenario === 'slow',
  releaseSidebar: null,
  sidebarReads: 0,
  signedIn: scenario !== 'guest',

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
  if (path === 'playlists.getManyForVideo') {
    state.playlistReads++
    if (state.holdPlaylist)
      await new Promise(resolve => {
        state.releasePlaylist = resolve
      })
    if (state.playlistFail) throw new Error('Playlist read failed')
    return {
      items: state.playlistEmpty ? [] : [{ id: 'playlist', name: '测试列表', containsVideo: state.playlistContains }],
      nextCursor: null,
    }
  }
  if (path === 'playlists.getVideos') return { items: state.playlistContains ? [{ id: 'video' }] : [], nextCursor: null }
  if (path === 'playlists.getOne') return { id: input.id, name: '测试列表' }
  if (path === 'playlists.remove') {
    if (state.fail) throw new Error('Playlist deletion failed')
    state.playlistEmpty = true
    return { id: input.id }
  }
  if (path === 'playlists.create') {
    state.playlistEmpty = false
    return { id: 'playlist', name: input.name }
  }
  if (path === 'playlists.addVideo' || path === 'playlists.removeVideo') {
    state.writes++
    await new Promise(resolve => {
      state.release = resolve
    })
    if (state.fail) throw new Error('Playlist write failed')
    state.playlistContains = path === 'playlists.addVideo'
    return input
  }
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
      user: { ...author('creator'), viewerSubscribed: state.subscribed, subscriberCount: 5 + Number(state.subscribed) },
    }
  if (path === 'users.getOne')
    return { ...author(input.id), viewerSubscribed: state.authors.some(item => item.id === input.id), subscriberCount: 5 }
  if (path === 'subscriptions.getSidebar') {
    state.sidebarReads++
    if (state.holdSidebar)
      await new Promise(resolve => {
        state.releaseSidebar = resolve
      })
    if (state.sidebarFail) throw new Error('Sidebar read failed')
    return state.authors.slice(0, 5)
  }
  if (path === 'subscriptions.getMany') {
    const start = input.cursor?.offset ?? 0
    return {
      items: state.authors
        .slice(start, start + input.limit)
        .map(user => ({ creatorId: user.id, viewerId: 'viewer', user: { ...user, subscriberCount: 5 } })),
      nextCursor: start + input.limit < state.authors.length ? { offset: start + input.limit } : null,
    }
  }
  if (path.startsWith('videoReactions.') || path.startsWith('subscriptions.')) {
    state.writes++
    await new Promise(resolve => {
      state.release = resolve
      state.pendingWrites[path] = resolve
      state.pendingWrites[`${path}:${input.userId}`] = resolve
    })
    if (state.fail) throw new Error('Simulated backend failure')
    if (path.startsWith('videoReactions.')) {
      const reaction = path.split('.')[1]
      state.reaction = state.reaction === reaction ? null : reaction
    } else {
      state.subscribed = path.endsWith('create')
      state.authors = state.authors.filter(item => item.id !== input.userId)
      if (state.subscribed) state.authors.unshift(author(input.userId))
    }
    return {}
  }
  throw new Error(`Unexpected operation: ${path}`)
}
const serverQueryClient = makeQueryClient()
if (scenario === 'hydrated') {
  serverQueryClient.setQueryData(getQueryKey(trpc.subscriptions.getSidebar, undefined, 'query'), state.authors.slice(0, 5))
}
const hydratedState = dehydrate(serverQueryClient)
serverQueryClient.clear()
const queryClient = makeQueryClient()
queryClient.setDefaultOptions({
  ...queryClient.getDefaultOptions(),
  queries: { retry: false, staleTime: Infinity },
  mutations: { retry: false },
})
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
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={hydratedState}>{children}</HydrationBoundary>
    </QueryClientProvider>
  </trpc.Provider>
)
