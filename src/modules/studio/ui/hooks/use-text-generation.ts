'use client'

import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import type { VideoAIKind } from '@/lib/video-ai'
import { trpc } from '@/trpc/client'

import { useGenerationTask } from './use-generation-task'
import type { VideoFormValues } from './video-form-values'

export function useTextGeneration({
  accountId,
  videoId,
  kind,
  form,
  onSaved,
}: {
  accountId: string | null | undefined
  videoId: string
  kind: VideoAIKind
  form: UseFormReturn<VideoFormValues>
  onSaved: () => void
}) {
  const utils = trpc.useUtils()
  const [selectedJobId, setSelectedJobId] = useState<string>()
  const input = { id: videoId, kind }
  const task = useGenerationTask({
    accountId,
    videoId,
    kind,
    onSettled: async (_job, notify) => {
      const video = await utils.client.studio.getOne.query({ id: videoId })
      // A task discovered from another tab/device must not discard local unsaved text.
      if (!form.getFieldState(kind).isDirty) form.resetField(kind, { defaultValue: video[kind] })
      else if (notify) toast.info('生成任务已结束，保留了你尚未保存的编辑')
      utils.studio.getOne.setData({ id: videoId }, video)
      onSaved()
    },
  })
  const suggestion = task.job?.status === 'conflict' && task.job.resolution === 'pending' ? task.job.result : null
  const adoptionJobId = suggestion !== null && selectedJobId === task.job?.id ? selectedJobId : undefined
  const dismiss = trpc.videos.dismissGenerationResult.useMutation({
    onSuccess: async job => {
      await utils.videos.getGenerationStatus.cancel(input)
      utils.videos.getGenerationStatus.setData(input, current => (current?.id === job.id ? job : current))
      setSelectedJobId(undefined)
      form.setFocus(kind)
      void utils.videos.getGenerationStatus.invalidate(input)
      toast.success('已忽略此生成结果')
    },
    onError: error => {
      void utils.videos.getGenerationStatus.invalidate(input)
      toast.error(error.message || '忽略失败，请重试')
    },
  })
  return {
    ...task,
    start: () => {
      if (!form.getFieldState(kind).isDirty && !adoptionJobId && !dismiss.isPending) void task.start()
    },
    suggestion,
    adoptionJobId,
    dismissing: dismiss.isPending,
    dismissSuggestion: () => {
      if (!task.locked && task.job && suggestion !== null && !dismiss.isPending) {
        dismiss.mutate({ ...input, jobId: task.job.id })
      }
    },
    confirmAdoption: async (jobId: string | undefined) => {
      if (!jobId) return
      setSelectedJobId(current => (current === jobId ? undefined : current))
      await utils.videos.getGenerationStatus.cancel(input)
      utils.videos.getGenerationStatus.setData(input, current => (current?.id === jobId ? { ...current, resolution: 'adopted' } : current))
      void utils.videos.getGenerationStatus.invalidate(input)
    },
    adoptSuggestion: () => {
      if (!task.locked && task.job && suggestion !== null && !dismiss.isPending) {
        setSelectedJobId(task.job.id)
        form.setValue(kind, suggestion, { shouldDirty: true, shouldValidate: true })
      }
    },
  }
}
