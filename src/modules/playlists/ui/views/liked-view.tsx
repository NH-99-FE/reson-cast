import { LikedVideosSection } from '@/modules/playlists/ui/section/liked-videos-section'

export const LikedView = () => {
  return (
    <div className="mx-auto mb-10 flex max-w-screen-md flex-col gap-y-6 px-4 pt-2.5">
      <div>
        <h1 className="text-2xl font-bold">点赞记录</h1>
        <p className="text-xs text-muted-foreground">你点赞的视频</p>
      </div>
      <LikedVideosSection />
    </div>
  )
}
