'use client'

import { useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { Realtime, type TokenDetails } from 'ably'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { refreshStudioQueries } from '@/lib/realtime/cache'
import { studioChannel, type StudioEvent, studioEventSchema } from '@/lib/realtime/events'

async function getToken(signal?: AbortSignal): Promise<TokenDetails> {
  const response = await fetch('/api/realtime/auth', { method: 'POST', cache: 'no-store', signal })
  if (!response.ok) throw new Error('实时连接鉴权失败')
  return response.json()
}

export function StudioRealtimeProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth()
  const client = useQueryClient()
  const [status, setStatus] = useState('connecting')
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
          setStatus(change.current)
          if (change.current === 'connected') refresh()
        })
        channel.on('attached', () => {
          if (!disposed) {
            setStatus('connected')
            refresh()
          }
        })
        channel.on('update', change => {
          if (!disposed && !change.resumed) refresh()
        })
        channel.on('failed', () => {
          if (!disposed) setStatus('failed')
        })
        channel.on('suspended', () => {
          if (!disposed) setStatus('suspended')
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
            if (!disposed) setStatus('failed')
          })
      })
      .catch(() => {
        if (!disposed) setStatus('failed')
      })
    return () => {
      disposed = true
      controller.abort()
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', visible)
      channel?.unsubscribe()
      channel?.off()
      connection?.connection.off()
      connection?.close()
      seen.clear()
    }
  }, [userId, client, refresh, retry])
  return (
    <>
      <div role="status" className="flex items-center justify-between gap-3 border-b px-4 py-2 text-sm text-muted-foreground">
        <span>
          {status === 'connected'
            ? '实时同步已连接'
            : status === 'connecting'
              ? '正在连接实时同步…'
              : '实时同步暂未连接，后台任务会继续处理'}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            refresh()
            if (status !== 'connected') {
              setStatus('connecting')
              setRetry(value => value + 1)
            }
          }}
        >
          刷新状态
        </Button>
      </div>
      {children}
    </>
  )
}
