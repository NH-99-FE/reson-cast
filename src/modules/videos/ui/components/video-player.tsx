'use client'
import { useAuth } from '@clerk/nextjs'
import MuxPlayer from '@mux/mux-player-react'
import { getImageProps } from 'next/image'
import { type ComponentRef, useCallback, useEffect, useState } from 'react'

import { isPublicThumbnail } from '@/lib/video-image-source'
import { THUMBNAIL_FALLBACK } from '@/modules/videos/constants'
import { trpc } from '@/trpc/client'

interface VideoPlayerProps {
  videoId: string
  thumbnailUrl?: string | null | undefined
  autoPlay?: boolean
  onPlay?: () => void
}

const isAccessError = (code?: string) => code === 'UNAUTHORIZED' || code === 'FORBIDDEN' || code === 'NOT_FOUND'

export const VideoPlayerSkeleton = () => {
  return <div className="aspect-video rounded-xl bg-black"></div>
}

export const VideoPlayer = ({ videoId, thumbnailUrl, autoPlay, onPlay }: VideoPlayerProps) => {
  const poster = isPublicThumbnail(thumbnailUrl)
    ? getImageProps({ src: thumbnailUrl!, alt: '', width: 1280, height: 720 }).props.src
    : thumbnailUrl || THUMBNAIL_FALLBACK
  const attachPlayer = useCallback((player: ComponentRef<typeof MuxPlayer> | null) => {
    if (!player) return

    // Stop media before React detaches the custom element on navigation or replacement.
    return () => {
      player.autoplay = false
      player.pause()
    }
  }, [])
  const { userId, isLoaded } = useAuth()
  const playbackKey = `${videoId}:${userId ?? 'guest'}`
  const [deniedPlaybackKey, setDeniedPlaybackKey] = useState<string | null>(null)
  const playback = trpc.videos.getPlayback.useQuery(
    { id: videoId },
    {
      enabled: isLoaded,
      staleTime: 0,
      refetchInterval: query => {
        if (isAccessError(query.state.error?.data?.code)) return false
        return query.state.status === 'error' || !query.state.data ? 5000 : 5 * 60 * 1000
      },
      retry: false,
    }
  )
  const accessDenied = isAccessError(playback.error?.data?.code)
  useEffect(() => {
    // A later network error must not revive cached tokens after access was denied.
    if (accessDenied) setDeniedPlaybackKey(playbackKey)
    else if (playback.isSuccess) setDeniedPlaybackKey(null)
  }, [accessDenied, playback.isSuccess, playbackKey])

  if (accessDenied || deniedPlaybackKey === playbackKey || (playback.isError && !playback.data))
    return (
      <div role="alert" className="p-6 text-white">
        {accessDenied || deniedPlaybackKey === playbackKey ? '视频无法播放或你没有访问权限' : '播放信息暂时加载失败，正在重试'}
      </div>
    )
  return (
    <MuxPlayer
      ref={attachPlayer}
      key={playbackKey}
      debug={false}
      tokens={playback.data?.tokens}
      playbackId={playback.data?.playbackId || ''}
      preferPlayback="mse"
      poster={poster}
      playerInitTime={0}
      autoPlay={autoPlay}
      thumbnailTime={0}
      className="h-full w-full object-contain"
      accentColor="#FF2056"
      onPlay={onPlay}
    />
  )
}
