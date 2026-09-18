'use client'

import { CircleAlertIcon, ClockIcon, Loader2Icon, SparklesIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type Task = {
  loading: boolean
  locked: boolean
  syncing: boolean
  paused: boolean
  message: string | null
  retryLabel: string | null
  job?: { status: string; error: string | null } | null
  start: () => unknown
  resume: () => unknown
}

export function GenerationAction({
  label,
  task,
  disabled,
  disabledReason,
}: {
  label: string
  task: Task
  disabled: boolean
  disabledReason: string
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const recovery = useRef<HTMLButtonElement>(null)
  const restoringFocus = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
  }
  const scheduleClose = () => {
    clearTimer()
    timer.current = setTimeout(() => {
      if (!content.current?.contains(document.activeElement)) setOpen(false)
    }, 200)
  }
  useEffect(() => () => clearTimer(), [])
  const failed = task.job?.status === 'failed'
  const dispatchUnconfirmed = task.job?.status === 'queued' && !!task.job.error
  const needsRecovery = !task.syncing && (!!task.retryLabel || failed || dispatchUnconfirmed)
  const retryLabel = task.retryLabel ?? (dispatchUnconfirmed ? '重新提交' : '重新生成')
  const blocked = disabled || task.locked
  const hint =
    task.message ??
    (failed ? task.job?.error || `${label}生成失败` : task.loading ? '正在查询生成进度' : blocked ? disabledReason : `AI 生成${label}`)
  const icon =
    needsRecovery && task.paused ? (
      <ClockIcon className="size-3 text-muted-foreground" aria-hidden="true" />
    ) : needsRecovery ? (
      <CircleAlertIcon className="size-3 text-amber-600" aria-hidden="true" />
    ) : task.loading ? (
      <Loader2Icon className="size-3 animate-spin" aria-hidden="true" />
    ) : (
      <SparklesIcon className="size-3" aria-hidden="true" />
    )

  if (!needsRecovery) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <span className="inline-flex" tabIndex={blocked ? 0 : undefined} aria-label={blocked ? hint : undefined}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 rounded-full"
              aria-label={`AI 生成${label}`}
              disabled={blocked}
              onClick={() => void task.start()}
            >
              {icon}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Button
          ref={trigger}
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 rounded-full"
          aria-label={`${label}生成需要处理`}
          aria-expanded={open}
          aria-haspopup="dialog"
          onMouseEnter={() => {
            clearTimer()
            setOpen(true)
          }}
          onMouseLeave={scheduleClose}
          onFocus={() => {
            clearTimer()
            if (restoringFocus.current) return
            setOpen(true)
            recovery.current?.focus()
          }}
          onBlur={scheduleClose}
          onClick={() => {
            clearTimer()
            setOpen(true)
            recovery.current?.focus()
          }}
        >
          {icon}
        </Button>
      </PopoverAnchor>
      <PopoverContent
        ref={content}
        className="w-auto max-w-64 space-y-1 px-3 py-2 text-xs"
        onOpenAutoFocus={event => {
          // Hover previews must not steal focus; keyboard access enters the dialog.
          if (document.activeElement !== trigger.current) event.preventDefault()
        }}
        onCloseAutoFocus={event => {
          event.preventDefault()
          clearTimer()
          if (document.activeElement === document.body || content.current?.contains(document.activeElement)) {
            restoringFocus.current = true
            trigger.current?.focus()
            restoringFocus.current = false
          }
        }}
        onMouseEnter={clearTimer}
        onMouseLeave={scheduleClose}
        onFocusCapture={clearTimer}
      >
        <p>{hint}</p>
        <button
          ref={recovery}
          type="button"
          className="text-primary underline underline-offset-4 disabled:opacity-50"
          disabled={task.syncing || (failed && blocked)}
          onClick={() => {
            setOpen(false)
            void (failed && !task.retryLabel ? task.start() : task.resume())
          }}
        >
          {retryLabel}
        </button>
      </PopoverContent>
    </Popover>
  )
}
