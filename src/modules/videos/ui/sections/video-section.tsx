'use client'

import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { cn } from '@/lib/utils'
import { trpc } from '@/trpc/client'

import { VideoBanner } from '../components/video-banner'
import { VideoPlayer } from '../components/video-player'
import { VideoTopRow } from '../components/video-top-row'

interface VideoSectionProps {
  videoId: string
}

export const VideoSection = ({ videoId }: VideoSectionProps) => {
  return (
    <Suspense fallback={<p>加载中...</p>}>
      <ErrorBoundary fallback={<p>出错了！</p>}>
        <VideoSectionSuspense videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  )
}

const VideoSectionSuspense = ({ videoId }: VideoSectionProps) => {
  const [video] = trpc.videos.getOne.useSuspenseQuery({ id: videoId })

  return (
    <>
      <div className={cn('relative aspect-video overflow-hidden rounded-xl bg-black', video.muxStatus !== 'ready' && 'rounded-b-none')}>
        <VideoPlayer autoPlay onPlay={() => {}} playbackId={video.muxPlaybackId} thumbnailUrl={video.thumbnailUrl} />
      </div>
      <VideoBanner status={video.muxStatus} />
      <VideoTopRow video={video} />
    </>
  )
}
