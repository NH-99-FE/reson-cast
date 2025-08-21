import { VideosSection } from '@/modules/studio/ui/sections/videos-section'

export const StudioView = () => {
  return (
    <div className="flex flex-col gap-y-6 pt-2.5">
      <div className="px-4">
        <h1 className="text-2xl font-bold">频道内容</h1>
        <p className="text-xs text-muted-foreground">管理你的频道内容和视频</p>
      </div>
      <VideosSection />
    </div>
  )
}
