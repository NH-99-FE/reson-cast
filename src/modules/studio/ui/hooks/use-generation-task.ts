'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { GenerationJob, GenerationKind } from '@/modules/videos/server/services/generation'
import { trpc } from '@/trpc/client'

const WAIT_MS = 5 * 60 * 1000
// Server owns task status; this union only describes the current UI interaction.
type Phase = { name: 'restoring' | 'idle' | 'submitting' | 'syncing' | 'sync-error' | 'paused' } | { name: 'waiting'; deadline: number }
const active = (job: GenerationJob | null | undefined) => job?.status === 'queued' || job?.status === 'running'

export function useGenerationTask({
  accountId,
  videoId,
  kind,
  onSettled,
}: {
  accountId: string | null | undefined
  videoId: string
  kind: GenerationKind
  onSettled: (job: GenerationJob, notify: boolean) => Promise<void>
}) {
  const utils = trpc.useUtils()
  const [phase, setPhase] = useState<Phase>({ name: 'restoring' })
  const mounted = useRef(false)
  const busy = useRef(false)
  const settledId = useRef<string | null>(null)
  const observedActiveId = useRef<string | null>(null)
  const callback = useRef(onSettled)
  useEffect(() => {
    callback.current = onSettled
  }, [onSettled])
  const label = kind === 'title' ? '标题' : kind === 'description' ? '简介' : '封面'
  const input = { id: videoId, kind }
  const query = trpc.videos.getGenerationStatus.useQuery(input, {
    enabled: !!accountId && phase.name !== 'submitting',
    staleTime: 0,
    retry: false,
    refetchInterval: false,
  })
  const job = query.data

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!query.isSuccess || phase.name === 'submitting' || phase.name === 'sync-error') return
    if (phase.name === 'paused' && active(job)) return
    if (active(job)) {
      observedActiveId.current = job!.id
      if (phase.name === 'restoring' || phase.name === 'idle') setPhase({ name: 'waiting', deadline: Date.now() + WAIT_MS })
    } else if (!job || settledId.current === job.id) {
      if (phase.name !== 'idle') setPhase({ name: 'idle' })
    } else if (phase.name !== 'syncing') setPhase({ name: 'syncing' })
  }, [job, query.isSuccess, phase.name])

  useEffect(() => {
    if (phase.name !== 'waiting') return
    const timer = setTimeout(() => setPhase({ name: 'paused' }), Math.max(0, phase.deadline - Date.now()))
    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase.name !== 'syncing' || !job || active(job)) return
    let current = true
    // Historical terminal jobs still refresh cached content, but are not new events.
    const notify = observedActiveId.current === job.id
    void callback
      .current(job, notify)
      .then(() => {
        if (!current) return
        settledId.current = job.id
        setPhase({ name: 'idle' })
        if (!notify) return
        if (job.status === 'completed') toast.success(`${label}已生成并保存`)
        else if (job.status === 'conflict') toast.info('该字段已有其他修改，本次生成未覆盖')
        else toast.error(job.error || `${label}生成失败`)
      })
      .catch(() => {
        if (current) setPhase({ name: 'sync-error' })
      })
    return () => {
      current = false
    }
  }, [phase.name, job, label])

  const start = async (prompt?: string) => {
    if (busy.current || phase.name !== 'idle' || query.isError || active(job) || !accountId) return false
    busy.current = true
    setPhase({ name: 'submitting' })
    try {
      await utils.videos.getGenerationStatus.cancel(input)
      const next =
        kind === 'title'
          ? await utils.client.videos.generateTitle.mutate({ id: videoId })
          : kind === 'description'
            ? await utils.client.videos.generateDescription.mutate({ id: videoId })
            : await utils.client.videos.generateThumbnail.mutate({ id: videoId, prompt: prompt ?? '' })
      if (!mounted.current) return false
      observedActiveId.current = next.id
      utils.videos.getGenerationStatus.setData(input, next)
      setPhase({ name: 'waiting', deadline: Date.now() + WAIT_MS })
      toast.info(`${label}生成完成后自动保存`)
      return true
    } catch (error) {
      if (!mounted.current) return false
      toast.error(error instanceof Error ? error.message : '任务提交失败')
      // Discover a possibly committed task even when its submission response was lost.
      setPhase({ name: 'restoring' })
      await query.refetch()
      return false
    } finally {
      busy.current = false
    }
  }

  const resume = async () => {
    if (busy.current || phase.name === 'syncing') return
    if (phase.name === 'sync-error') {
      setPhase({ name: 'syncing' })
      return
    }
    busy.current = true
    try {
      if (job?.status === 'queued') {
        setPhase({ name: 'submitting' })
        await utils.videos.getGenerationStatus.cancel(input)
        const next = await utils.client.videos.retryGeneration.mutate({ jobId: job.id })
        if (!mounted.current) return
        utils.videos.getGenerationStatus.setData(input, next)
      }
      if (!mounted.current) return
      setPhase({ name: 'waiting', deadline: Date.now() + WAIT_MS })
      await query.refetch()
    } catch (error) {
      if (mounted.current) {
        setPhase({ name: 'paused' })
        toast.error(error instanceof Error ? error.message : '重试失败')
      }
    } finally {
      busy.current = false
    }
  }

  return {
    start,
    resume,
    job,
    locked: phase.name !== 'idle' || query.isError || active(job),
    // Discovering task status must not block normal editing. Confirmed work keeps its lock.
    fieldLocked: active(job) || phase.name === 'submitting' || phase.name === 'syncing' || phase.name === 'sync-error',
    // A retained field lock does not mean work is still progressing (errors / pause).
    loading:
      phase.name === 'submitting' ||
      phase.name === 'syncing' ||
      (phase.name === 'restoring' && query.isFetching) ||
      (phase.name === 'waiting' && !query.isError),
    syncing: phase.name === 'syncing' || phase.name === 'submitting',
    paused: phase.name === 'paused' && !query.isError && !job?.error,
    message:
      phase.name === 'sync-error'
        ? '内容同步失败，请重试同步'
        : query.isError
          ? '进度查询暂时失败，可重试查询'
          : phase.name === 'paused'
            ? '等待较久，后台仍可能处理中，可刷新状态'
            : job?.status === 'queued' && job.error
              ? job.error
              : active(job) || phase.name === 'submitting'
                ? `${label}生成完成后自动保存`
                : null,
    retryLabel:
      phase.name === 'sync-error'
        ? '重试同步'
        : job?.status === 'queued'
          ? '重新提交'
          : phase.name === 'paused'
            ? '刷新状态'
            : query.isError
              ? '重试查询'
              : null,
  }
}
