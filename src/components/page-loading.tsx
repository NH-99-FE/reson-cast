import { Skeleton } from '@/components/ui/skeleton'

export const PageLoading = () => (
  <div role="status" aria-label="正在加载页面" className="space-y-6 p-6">
    <span className="sr-only">正在加载页面…</span>
    <Skeleton className="h-8 w-40" />
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="space-y-3" aria-hidden="true">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  </div>
)
