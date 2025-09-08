import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useState } from 'react'

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

  // 清理描述文本，移除多余的空白字符
  const cleanDescription = description?.trim().replace(/\s+/g, ' ') || '还没有简介'

  return (
    <div
      onClick={() => setIsExpanded(current => !current)}
      className="cursor-pointer rounded-xl bg-secondary/50 p-3 transition hover:bg-secondary/70"
    >
      <div>
        <span>{isExpanded ? expandedViews : compactViews}</span>浏览量
        <span className="ml-4 text-muted-foreground">{isExpanded ? expandedDate : compactDate}</span>
      </div>
      <div>
        <p className={cn('text-sm', !isExpanded && 'line-clamp-1')}>{cleanDescription}</p>
        <div className="mt-2 flex items-center gap-1 text-sm font-medium">
          {!isExpanded ? (
            <>
              展开
              <ChevronDownIcon className="size-4" />
            </>
          ) : (
            <>
              收起
              <ChevronUpIcon className="size-4" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
