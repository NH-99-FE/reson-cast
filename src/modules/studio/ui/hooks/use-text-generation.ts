'use client'

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
  return {
    ...task,
    start: () => {
      if (!form.getFieldState(kind).isDirty) void task.start()
    },
    suggestion: task.job?.status === 'conflict' ? task.job.result : null,
    adoptSuggestion: () => {
      if (!task.locked && task.job?.status === 'conflict' && task.job.result) form.setValue(kind, task.job.result, { shouldDirty: true })
    },
  }
}
