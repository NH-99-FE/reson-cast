import {
  CategoryStripSkeleton,
  PlaylistsSkeleton,
  StudioVideosSkeleton,
  SubscriptionsSkeleton,
  VideoGridSkeleton,
  VideoListSkeleton,
} from '@/components/page-content-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

const pages = {
  '/': { title: '主页', content: VideoGridSkeleton, layout: 'grid' },
  '/feed/subscribed': { title: '订阅', description: '来自于你喜欢的视频', content: VideoGridSkeleton, layout: 'grid' },
  '/feed/trending': { title: '热点', description: '当前最受欢迎的视频', content: VideoGridSkeleton, layout: 'grid' },
  '/playlists/history': { title: '历史记录', description: '你看过的视频', content: VideoListSkeleton, layout: 'list' },
  '/playlists/liked': { title: '点赞记录', description: '你点赞的视频', content: VideoListSkeleton, layout: 'list' },
  '/playlists': { title: '播放列表', description: '你的播放列表合集', content: PlaylistsSkeleton, layout: 'grid' },
  '/subscriptions': { title: '订阅列表', description: '查看和管理全部订阅', content: SubscriptionsSkeleton, layout: 'list' },
  '/studio': { title: '频道内容', description: '管理你的频道内容和视频', content: StudioVideosSkeleton, layout: 'studio' },
} satisfies Record<string, { title: string; description?: string; content: () => React.ReactNode; layout: string }>

export function SidebarPageSkeleton({ href, title }: { href: string; title?: string }) {
  const page: { title: string; description?: string; content: () => React.ReactNode; layout: string } = pages[
    href as keyof typeof pages
  ] ?? { title: title ?? '用户主页', content: VideoGridSkeleton, layout: 'grid' }
  const Content = page.content
  const className =
    page.layout === 'studio'
      ? 'flex flex-col gap-y-6 pt-2.5'
      : `mx-auto mb-10 flex flex-col gap-y-6 px-4 pt-2.5 ${page.layout === 'list' ? 'max-w-screen-md' : 'max-w-[2400px]'}`

  // Route and data loading share the same content, spacing and responsive layout.
  return (
    <div className={className} role="status" aria-label={`正在加载${page.title}`} aria-busy="true">
      <span className="sr-only">正在加载{page.title}…</span>
      {href === '/' ? (
        <CategoryStripSkeleton />
      ) : (
        <div className={page.layout === 'studio' ? 'px-4' : 'flex items-center justify-between'}>
          <div>
            <h1 className="text-2xl font-bold">{page.title}</h1>
            {page.description && <p className="text-xs text-muted-foreground">{page.description}</p>}
          </div>
          {href === '/playlists' && <Skeleton className="size-9 rounded-full" />}
        </div>
      )}
      <Content />
    </div>
  )
}
