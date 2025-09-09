'use client'
import MuxPlayer from '@mux/mux-player-react'
import { useEffect, useState } from 'react'

import { THUMBNAIL_FALLBACK } from '@/modules/videos/constants'

interface VideoPlayerProps {
  playbackId?: string | null | undefined
  thumbnailUrl?: string | null | undefined
  autoPlay?: boolean
  onPlay?: () => void
}

export const VideoPlayerSkeleton = () => {
  return <div className="aspect-video rounded-xl bg-black"></div>
}

export const VideoPlayer = ({ playbackId, thumbnailUrl, autoPlay, onPlay }: VideoPlayerProps) => {
  return (
    <MuxPlayer
      playbackId={playbackId || ''}
      poster={thumbnailUrl || THUMBNAIL_FALLBACK}
      playerInitTime={0}
      autoPlay={autoPlay}
      thumbnailTime={0}
      className="h-full w-full object-contain"
      accentColor="#FF2056"
      onPlay={onPlay}
    />
  )
}
