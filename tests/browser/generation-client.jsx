import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTRPCReact } from '@trpc/react-query'
import { observable } from '@trpc/server/observable'
import { useEffect, useState } from 'react'

export const trpc = createTRPCReact()
export const videoId = '8c1f3a65-ef3b-44dc-991c-e59922c6fa73'
export const state = {
  account: 'owner',
  video: {
    id: videoId,
    title: 'Original title',
    description: 'Original description',
    categoryId: null,
    visibility: 'private',
    muxTrackId: 'track',
    muxStatus: 'ready',
    muxTrackStatus: 'ready',
    thumbnailUrl: null,
    thumbnailKey: null,
  },
  listPolls: 0,
  deleted: false,
  runs: {},
  writes: [],
  polls: 0,
  failDetails: false,
  failPolls: false,
  saveDelay: 0,
  dispatchFails: false,
  delayNextStatus: false,
  delayedStatusStarted: false,
  pendingCleanup: 0,
}
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const handle = async ({ path, input }) => {
  if (path === 'categories.getMany') return [{ id: '287f7d7e-f6c1-48a8-b796-5b3e74314f12', name: 'Test category' }]
  if (path === 'studio.getMany') {
    state.listPolls++
    return { items: state.deleted ? [] : [{ ...state.video, createdAt: new Date(), viewCount: 0, commentCount: 0 }], nextCursor: null }
  }
  if (path === 'videos.remove') {
    state.video.deletionError = null
    return { id: videoId }
  }
  if (path === 'studio.getOne') {
    if (state.failDetails) throw new Error('simulated details failure')
    return { ...state.video }
  }
  if (path === 'videos.getPendingFileCleanup') return { count: state.pendingCleanup }
  if (path === 'videos.retryFileCleanup') {
    state.pendingCleanup = 0
    return { count: 0 }
  }
  if (path === 'videos.getGenerationStatus') {
    state.polls++
    if (state.failPolls) throw new Error('simulated polling failure')
    const job = Object.values(state.runs)
      .filter(job => job.kind === input.kind && job.account === state.account && (!input.jobId || input.jobId === job.id))
      .at(-1)
    const snapshot = job ? { ...job } : null
    if (input.kind === 'title' && state.delayNextStatus) {
      state.delayNextStatus = false
      state.delayedStatusStarted = true
      await delay(300)
    }
    return snapshot
  }
  if (['videos.generateTitle', 'videos.generateDescription', 'videos.generateThumbnail'].includes(path)) {
    const kind = path.endsWith('Title') ? 'title' : path.endsWith('Description') ? 'description' : 'thumbnail'
    const id = crypto.randomUUID()
    const active = Object.values(state.runs).find(
      job => job.account === state.account && job.kind === kind && ['queued', 'running'].includes(job.status)
    )
    if (active) return { ...active }
    const job = {
      id,
      kind,
      status: state.dispatchFails ? 'queued' : 'running',
      account: state.account,
      result: null,
      error: state.dispatchFails ? '任务提交未确认，可重新提交' : null,
      videoId,
      createdAt: new Date(),
      finishedAt: null,
    }
    state.runs[id] = job
    return { ...job }
  }
  if (path === 'videos.retryGeneration') {
    const job = state.runs[input.jobId]
    if (!state.dispatchFails) {
      job.status = 'running'
      job.error = null
    }
    return { ...job }
  }
  if (path === 'videos.update') {
    state.writes.push(input)
    await delay(state.saveDelay)
    Object.assign(state.video, input)
    return { ...state.video }
  }
  throw new Error(`Unexpected mock RPC: ${path}`)
}
export function TestProvider({ children }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } }))
  const [client] = useState(() =>
    trpc.createClient({
      links: [
        () => operation =>
          observable(observer => {
            handle(operation.op)
              .then(data => {
                observer.next({ result: { data } })
                observer.complete()
              })
              .catch(error => observer.error(error))
          }),
      ],
    })
  )
  useEffect(() => {
    state.refresh = () => queryClient.invalidateQueries()
    return () => {
      state.refresh = null
    }
  }, [queryClient])
  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
