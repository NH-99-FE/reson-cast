import { and, eq, isNull, or } from 'drizzle-orm'

import { db } from '@/db'
import { videos } from '@/db/schema'
import { mux } from '@/lib/mux'
import { isMissing } from '@/lib/video-cleanup'
import { imagePath } from '@/lib/video-media'
import { requestVideoDeletion } from '@/modules/videos/server/services/deletion'

export async function POST(request: Request) {
  const secret = process.env.MUX_WEBHOOK_SECRET
  if (!secret) return new Response('Webhook is not configured', { status: 503 })
  let event
  try {
    // Verify the exact bytes sent by Mux, before parsing JSON.
    event = mux.webhooks.unwrap(await request.text(), request.headers, secret)
  } catch {
    return new Response('Invalid signature', { status: 401 })
  }

  if (event.type === 'video.asset.deleted') {
    const [video] = await db
      .select()
      .from(videos)
      .where(or(eq(videos.muxAssetId, event.data.id), event.data.upload_id ? eq(videos.muxUploadId, event.data.upload_id) : undefined))
    if (video && !video.deletionRequestedAt) await requestVideoDeletion(video.id)
    return new Response('OK')
  }
  if (event.type === 'video.asset.track.ready') {
    const assetId = (event.data as typeof event.data & { asset_id?: string }).asset_id
    if (!assetId) return new Response('Missing asset ID', { status: 400 })
    await db
      .update(videos)
      .set({ muxTrackId: event.data.id, muxTrackStatus: event.data.status })
      .where(and(eq(videos.muxAssetId, assetId), isNull(videos.deletionRequestedAt)))
    return new Response('OK')
  }
  if (!['video.asset.created', 'video.asset.ready', 'video.asset.errored'].includes(event.type)) return new Response('OK')
  const data = event.data as { id: string; upload_id?: string; passthrough?: string }
  if (!data.upload_id) return new Response('OK')
  const [video] = await db.select().from(videos).where(eq(videos.muxUploadId, data.upload_id))
  if (!video || video.deletionRequestedAt) {
    // Late callbacks for uploads created by this application must not leave orphan assets.
    if (video || data.passthrough?.startsWith('reson-cast:')) {
      try {
        await mux.video.assets.delete(data.id)
      } catch (error) {
        if (!isMissing(error)) throw error
      }
    }
    return new Response('OK')
  }
  if (video.muxPlaybackIdToRevoke) return new Response('OK')
  // Fetch current state rather than letting an old callback restore an obsolete playback ID/status.
  const asset = await mux.video.assets.retrieve(data.id)
  const playbackId = asset.playback_ids?.find(item => item.policy === 'signed')?.id
  const [updated] = await db
    .update(videos)
    .set({
      muxAssetId: asset.id,
      muxStatus: asset.status,
      // A visibility change can rotate the ID concurrently: only initialize it here.
      ...(video.muxPlaybackId ? {} : { muxPlaybackId: playbackId }),
      duration: Math.round((asset.duration ?? 0) * 1000),
      thumbnailUrl: imagePath(video.id, 'thumbnail'),
      previewUrl: imagePath(video.id, 'preview'),
    })
    .where(
      and(
        eq(videos.id, video.id),
        isNull(videos.deletionRequestedAt),
        isNull(videos.muxPlaybackIdToRevoke),
        video.muxPlaybackId ? eq(videos.muxPlaybackId, video.muxPlaybackId) : isNull(videos.muxPlaybackId)
      )
    )
    .returning({ id: videos.id })
  const [current] = !updated ? await db.select().from(videos).where(eq(videos.id, video.id)) : []
  if (!updated && (!current || current.deletionRequestedAt)) {
    try {
      await mux.video.assets.delete(asset.id)
    } catch (error) {
      if (!isMissing(error)) throw error
    }
  }
  return new Response('OK')
}
