import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { cn } from '@/lib/utils'

interface VideoDescriptionProps {
  compactViews: string
  expandedViews: string
  compactDate: string
  expandedDate: string
  description?: string | null
}

export const VideoDescription = ({ compactViews, compactDate, expandedViews, expandedDate, description }: VideoDescriptionProps) => {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      onClick={() => setIsExpanded(current => !current)}
      className="cursor-pointer rounded-xl bg-secondary/50 p-3 transition hover:bg-secondary/70"
    >
      <div>
        <span>{isExpanded ? expandedViews : compactViews}</span>浏览量
        <span>{isExpanded ? expandedDate : compactDate}</span>
      </div>
      <div>
        <p className={cn('text-sm whitespace-pre-wrap', !isExpanded && 'line-clamp-1')}>{description || '还没有简介'}</p>
        <div className="mt-4 flex items-center gap-1 text-sm font-medium">
          {!isExpanded ? (
            <>
              显示更多
              <ChevronUpIcon className="size-4" />
            </>
          ) : (
            <>
              显示更少
              <ChevronDownIcon className="size-4" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
