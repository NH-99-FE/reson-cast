import { after } from 'next/server'

export function authenticatedWorkflow(handler: (request: Request) => Promise<Response>, scheduleAfter: typeof after = after) {
  return (request: Request) => {
    if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
      return Promise.resolve(new Response('Workflow signing keys are not configured', { status: 503 }))
    }
    if (!request.headers.get('upstash-signature')) {
      return Promise.resolve(new Response('Missing workflow signature', { status: 401 }))
    }
    return handler(request).then(response => {
      if (!response.ok) return response
      scheduleAfter(async () => {
        const { wakeOutbox } = await import('./realtime/server')
        await wakeOutbox()
      })
      return response
    })
  }
}
