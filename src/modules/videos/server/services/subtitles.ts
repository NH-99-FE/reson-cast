import { and, eq, isNull, or } from 'drizzle-orm'

import { db } from '@/db'
import { videos } from '@/db/schema'
import { mux } from '@/lib/mux'
import { readyMuxSubtitle } from '@/lib/mux-subtitles'
import { isMissing } from '@/lib/video-cleanup'

export async function syncMuxSubtitle(assetId: string): Promise<'synced' | 'ignored' | 'retry'> {
  let asset
  try {
    asset = await mux.video.assets.retrieve(assetId)
  } catch (error) {
    if (isMissing(error)) return 'ignored'
    throw error
  }
  const subtitle = readyMuxSubtitle(asset.tracks)
  if (!subtitle.muxTrackId) return 'retry'

  // uploadId is saved before the client can upload, even if the asset callback
  // has not written muxAssetId yet.
  const association = or(eq(videos.muxAssetId, asset.id), asset.upload_id ? eq(videos.muxUploadId, asset.upload_id) : undefined)
  const [updated] = await db
    .update(videos)
    .set(subtitle)
    .where(and(association, isNull(videos.deletionRequestedAt)))
    .returning({ id: videos.id })
  if (updated) return 'synced'

  const [existing] = await db.select({ deletionRequestedAt: videos.deletionRequestedAt }).from(videos).where(association).limit(1)
  if (existing?.deletionRequestedAt) return 'ignored'
  // Never acknowledge an unassociated subtitle as successfully persisted.
  return 'retry'
}
