'use client'

import { useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { Realtime, type TokenDetails } from 'ably'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { refreshStudioQueries } from '@/lib/realtime/cache'
import { studioChannel, type StudioEvent, studioEventSchema } from '@/lib/realtime/events'

type ConnectionStatus = 'connecting' | 'connected' | 'unavailable'
const RealtimeStatusContext = createContext<{ status: ConnectionStatus; reconnect: () => void } | null>(null)
const DISCONNECT_NOTICE_MS = 10_000

async function getToken(signal?: AbortSignal): Promise<TokenDetails> {
  const response = await fetch('/api/realtime/auth', { method: 'POST', cache: 'no-store', signal })
  if (!response.ok) throw new Error('实时连接鉴权失败')
  return response.json()
}

export function StudioRealtimeProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth()
  const client = useQueryClient()
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [retry, setRetry] = useState(0)
  const refresh = useCallback(() => {
    // Active queries only: no background traffic for unmounted studio pages.
    void refreshStudioQueries(client)
  }, [client])
  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    let connection: Realtime | undefined
    let channel: ReturnType<Realtime['channels']['get']> | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let disconnectTimer: ReturnType<typeof setTimeout> | undefined
    const updateStatus = (connected: boolean) => {
      if (connected) {
        clearTimeout(disconnectTimer)
        disconnectTimer = undefined
        setStatus('connected')
      } else {
        setStatus(previous => (previous === 'unavailable' ? previous : 'connecting'))
        // Keep the same deadline through successive reconnect attempts.
        disconnectTimer ??= setTimeout(() => setStatus('unavailable'), DISCONNECT_NOTICE_MS)
      }
    }
    updateStatus(false)
    const seen = new Set<string>()
    const pending: StudioEvent[] = []
    let disposed = false
    const visible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', visible)
    void getToken(controller.signal)
      .then(initial => {
        if (disposed) return
        let first: TokenDetails | undefined = initial
        connection = new Realtime({
          authCallback: (_params, callback) => {
            const token = first
            first = undefined
            void (token ? Promise.resolve(token) : getToken(controller.signal))
              .then(value => {
                if (!disposed) callback(null, value)
              })
              .catch(() => {
                if (!disposed) callback('实时连接鉴权失败', null)
              })
          },
        })
        channel = connection.channels.get(studioChannel(initial.clientId!))
        connection.connection.on(change => {
          if (disposed) return
          updateStatus(change.current === 'connected' && channel?.state === 'attached')
          if (change.current === 'connected') refresh()
        })
        channel.on('attached', () => {
          if (!disposed) {
            updateStatus(true)
            refresh()
          }
        })
        channel.on('update', change => {
          if (!disposed && !change.resumed) refresh()
        })
        channel.on('failed', () => {
          if (!disposed) updateStatus(false)
        })
        channel.on('suspended', () => {
          if (!disposed) updateStatus(false)
        })
        void channel
          .subscribe(message => {
            if (disposed) return
            const parsed = studioEventSchema.safeParse(message.data)
            if (!parsed.success || seen.has(parsed.data.id)) return
            seen.add(parsed.data.id)
            if (seen.size > 1000) seen.delete(seen.values().next().value!)
            pending.push(parsed.data)
            if (timer) return
            timer = setTimeout(() => {
              timer = undefined
              const batch = pending.splice(0)
              void refreshStudioQueries(client, batch)
            }, 150)
          })
          .catch(() => {
            if (!disposed) updateStatus(false)
          })
      })
      .catch(() => {
        if (!disposed) updateStatus(false)
      })
    return () => {
      disposed = true
      controller.abort()
      if (timer) clearTimeout(timer)
      clearTimeout(disconnectTimer)
      document.removeEventListener('visibilitychange', visible)
      channel?.unsubscribe()
      channel?.off()
      connection?.connection.off()
      connection?.close()
      seen.clear()
    }
  }, [userId, client, refresh, retry])
  const reconnect = () => {
    refresh()
    setStatus('connecting')
    setRetry(value => value + 1)
  }
  return <RealtimeStatusContext.Provider value={{ status, reconnect }}>{children}</RealtimeStatusContext.Provider>
}

export function StudioRealtimeIndicator() {
  const realtime = useContext(RealtimeStatusContext)
  // Reserve space so the title does not shift while reconnecting.
  if (!realtime || realtime.status === 'connecting') return <span aria-hidden="true" className="inline-block size-6 shrink-0" />
  const connected = realtime.status === 'connected'
  const label = connected ? '内容变更会自动更新' : '自动更新已暂停，点击重新连接'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={connected ? undefined : realtime.reconnect}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden="true" className={`size-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
