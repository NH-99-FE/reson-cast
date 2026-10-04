import { ListVideoIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface PlaylistEmptyStateProps {
  title: string
  description: string
  children: ReactNode
}

export const PlaylistEmptyState = ({ title, description, children }: PlaylistEmptyStateProps) => (
  <div className="flex flex-col items-center px-4 py-16 text-center sm:py-24">
    <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted">
      <ListVideoIcon aria-hidden="true" className="size-6 text-muted-foreground" />
    </div>
    <h2 className="text-base font-medium">{title}</h2>
    <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{description}</p>
    <div className="mt-6">{children}</div>
  </div>
)
