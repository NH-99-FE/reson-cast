import { Skeleton } from '@/components/ui/skeleton'

const pages: Record<string, { title: string; description?: string; rows?: boolean }> = {
  '/': { title: '主页' },
  '/feed/subscribed': { title: '订阅', description: '来自于你喜欢的视频' },
  '/feed/trending': { title: '热点', description: '当前最受欢迎的视频' },
  '/playlists/history': { title: '历史记录', description: '你看过的视频', rows: true },
  '/playlists/liked': { title: '点赞记录', description: '你点赞的视频', rows: true },
  '/playlists': { title: '播放列表', description: '你的播放列表合集' },
  '/subscriptions': { title: '订阅列表', description: '查看和管理全部订阅', rows: true },
  '/studio': { title: '视频内容', rows: true },
}

export function SidebarPageSkeleton({ href, title }: { href: string; title?: string }) {
  const page = pages[href] ?? { title: title ?? '用户主页' }
  return (
    <div className={`mx-auto mb-10 flex flex-col gap-y-6 px-4 pt-2.5 ${page.rows ? 'max-w-screen-md' : 'max-w-[2400px]'}`}>
      <div>
        <h1 className="text-2xl font-bold">{page.title}</h1>
        {page.description && <p className="text-xs text-muted-foreground">{page.description}</p>}
      </div>
      <div role="status" aria-label={`正在加载${page.title}`} aria-busy="true">
        <span className="sr-only">正在加载{page.title}…</span>
        <div className={page.rows ? 'flex flex-col gap-6' : 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'}>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className={page.rows ? 'flex gap-4' : 'space-y-3'} aria-hidden="true">
              <Skeleton className={page.rows ? 'aspect-video w-40 shrink-0 rounded-xl' : 'aspect-video w-full rounded-xl'} />
              <div className="w-full space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
