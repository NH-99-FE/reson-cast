import { HistoryVideosSection } from '@/modules/playlists/ui/section/history-videos-section'

export const HistoryView = () => {
  return (
    <div className="mx-auto mb-10 flex max-w-screen-md flex-col gap-y-6 px-4 pt-2.5">
      <div>
        <h1 className="text-2xl font-bold">历史记录</h1>
        <p className="text-xs text-muted-foreground">你看过的视频</p>
      </div>
      <HistoryVideosSection />
    </div>
  )
}
