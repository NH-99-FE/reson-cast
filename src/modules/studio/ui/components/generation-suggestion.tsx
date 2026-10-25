'use client'

import { HistoryIcon, XIcon } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function GenerationSuggestion({ label, suggestion, onAdopt }: { label: string; suggestion: string; onAdopt: () => void }) {
  const [open, setOpen] = useState(false)
  const headingId = useId()
  const descriptionId = useId()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 gap-1.5 px-2 text-xs font-normal text-muted-foreground"
          aria-label={`查看未采用的${label}生成结果`}
        >
          <HistoryIcon className="size-3" aria-hidden="true" />
          生成结果
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        className="flex max-h-[var(--radix-popover-content-available-height)] w-96 max-w-[calc(100vw-2rem)] flex-col gap-3"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 id={headingId} className="text-sm font-medium">
              未采用的{label}
            </h3>
            <p id={descriptionId} className="text-xs text-muted-foreground">
              采用后将替换编辑框内容，保存后生效。
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            aria-label="关闭生成结果"
            onClick={() => setOpen(false)}
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
        <div
          tabIndex={0}
          role="region"
          aria-label={`${label}生成结果内容`}
          className="max-h-64 min-h-0 overflow-y-auto rounded-md bg-muted/50 p-3 text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap focus-visible:outline-2 focus-visible:outline-ring"
        >
          {suggestion}
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onAdopt()
              setOpen(false)
            }}
          >
            采用到编辑框
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
