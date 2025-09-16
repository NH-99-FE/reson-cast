import { TrendingVideosSection } from '@/modules/home/ui/sections/trending-videos-section'

export const TrendingView = () => {
  return (
    <div className="mx-auto mb-10 flex max-w-[2400px] flex-col gap-y-6 px-4 pt-2.5">
      <div>
        <h1 className="text-2xl font-bold">热点</h1>
        <p className="text-xs text-muted-foreground">当前最受欢迎的视频</p>
      </div>
      <TrendingVideosSection />
    </div>
  )
}
