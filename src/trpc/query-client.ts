import { defaultShouldDehydrateQuery, QueryClient } from '@tanstack/react-query'
import superjson from 'superjson'

export function makeQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: query => defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  })
  client.getMutationCache().subscribe(event => {
    // onSettled is awaited while mutations are still pending. Reconcile only
    // after the terminal state is dispatched, including failed mutations.
    if (event.type !== 'updated' || (event.action.type !== 'success' && event.action.type !== 'error')) return
    const videoId = event.mutation.options.meta?.videoInteraction
    if (typeof videoId !== 'string') return
    if (client.isMutating({ predicate: mutation => mutation.options.meta?.videoInteraction === videoId }) !== 0) return
    void client.invalidateQueries({ queryKey: [['videos', 'getOne'], { input: { id: videoId }, type: 'query' }] })
  })
  return client
}
