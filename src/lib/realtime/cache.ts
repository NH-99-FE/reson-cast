import type { Query } from '@tanstack/react-query'

import type { StudioEvent } from './events'

export function matchesStudioQuery(query: Pick<Query, 'queryKey'>, events?: StudioEvent[]) {
  const [path, options] = query.queryKey as [string[], { input?: { id?: string; kind?: string } }?]
  if (!Array.isArray(path)) return false
  const name = path.join('.')
  if (name === 'studio.getMany') return true
  if (name !== 'studio.getOne' && name !== 'videos.getGenerationStatus') return false
  if (!events) return true
  return events.some(
    event =>
      options?.input?.id === event.videoId &&
      (name === 'studio.getOne' ||
        event.type === 'deletion.changed' ||
        (event.type === 'generation.changed' && options?.input?.kind === event.kind))
  )
}

/** Cancel pre-event initial fetches as well as stale background fetches before reading current state. */
export async function refreshStudioQueries(client: import('@tanstack/react-query').QueryClient, events?: StudioEvent[]) {
  const predicate = (query: Query) => matchesStudioQuery(query, events)
  await client.cancelQueries({ predicate })
  await client.invalidateQueries({ predicate, refetchType: 'active' })
}
