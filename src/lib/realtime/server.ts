import 'server-only'

import { Client } from '@upstash/qstash'
import { Rest } from 'ably'

let ably: Rest | undefined
export function realtimeServer() {
  if (!process.env.ABLY_API_KEY) throw new Error('Ably is not configured')
  return (ably ??= new Rest({ key: process.env.ABLY_API_KEY, httpRequestTimeout: 10000, httpMaxRetryCount: 0 }))
}

/** The database scanner is authoritative; this is only a latency optimization. */
export async function wakeOutbox() {
  try {
    const base = process.env.UPSTASH_WORKFLOW_URL
    if (!base || !process.env.QSTASH_TOKEN) throw new Error('Missing outbox dispatch configuration')
    await new Client({ token: process.env.QSTASH_TOKEN, retry: { retries: 0 } }).publishJSON({
      url: `${base.replace(/\/+$/, '')}/api/realtime/dispatch`,
      body: {},
      retries: 3,
    })
  } catch {
    console.error('Outbox wake failed; scheduled scanner will recover')
  }
}
