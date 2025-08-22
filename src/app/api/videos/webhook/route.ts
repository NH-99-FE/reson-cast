import {
  VideoAssetCreatedWebhookEvent,
  VideoAssetDeletedWebhookEvent,
  VideoAssetErroredWebhookEvent,
  VideoAssetReadyWebhookEvent,
  VideoAssetTrackReadyWebhookEvent,
} from '@mux/mux-node/resources/webhooks'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { UTApi } from 'uploadthing/server'

import { db } from '@/db'
import { videos } from '@/db/schema'
import { mux } from '@/lib/mux'

const SIGNING_SECRET = process.env.MUX_WEBHOOK_SECRET!

type WebhookEvent =
  | VideoAssetCreatedWebhookEvent
  | VideoAssetErroredWebhookEvent
  | VideoAssetReadyWebhookEvent
  | VideoAssetTrackReadyWebhookEvent
  | VideoAssetDeletedWebhookEvent

export async function POST(request: Request) {
  if (!SIGNING_SECRET) {
    throw new Error('MUX密钥未提供')
  }

  const headersPayload = await headers()
  const muxSignature = headersPayload.get('mux-signature')

  if (!muxSignature) {
    return new Response('签名缺失', { status: 401 })
  }

  const payload = await request.json()
  const body = JSON.stringify(payload)

  mux.webhooks.verifySignature(
    body,
    {
      'mux-signature': muxSignature,
    },
    SIGNING_SECRET
  )

  switch (payload.type as WebhookEvent['type']) {
    case 'video.asset.created': {
      const data = payload.data as VideoAssetCreatedWebhookEvent['data']
      if (!data.upload_id) {
        return new Response('未找到上传id', { status: 400 })
      }
      await db
        .update(videos)
        .set({
          muxAssetId: data.id,
          muxStatus: data.status,
        })
        .where(eq(videos.muxUploadId, data.upload_id))
      break
    }
    case 'video.asset.ready': {
      const data = payload.data as VideoAssetReadyWebhookEvent['data']
      const playbackId = data.playback_ids?.[0].id

      if (!data.upload_id) {
        return new Response('缺少uploadId', { status: 400 })
      }

      if (!playbackId) {
        return new Response('没有playbackId', { status: 400 })
      }

      // 检查视频是否已经处理过，避免重复处理
      const [existingVideo] = await db.select().from(videos).where(eq(videos.muxUploadId, data.upload_id))

      if (!existingVideo) {
        return new Response('视频不存在', { status: 404 })
      }

      // 如果缩略图和预览图以及上传，跳过上传步骤
      if (existingVideo.thumbnailKey && existingVideo.previewKey && existingVideo.muxStatus === 'ready') {
        return new Response('视频已处理', { status: 200 })
      }

      const tempThumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`
      const tempPreviewUrl = `https://image.mux.com/${playbackId}/animated.gif`

      const duration = data.duration ? Math.round(data.duration * 1000) : 0

      const utapi = new UTApi()
      const [uploadedThumbnail, uploadedPreview] = await utapi.uploadFilesFromUrl([tempThumbnailUrl, tempPreviewUrl])

      if (!uploadedThumbnail.data || !uploadedPreview.data) {
        return new Response('无法上传缩略图/预览动态图', { status: 500 })
      }

      const { key: thumbnailKey, ufsUrl: thumbnailUrl } = uploadedThumbnail.data
      const { key: previewKey, ufsUrl: previewUrl } = uploadedPreview.data

      await db
        .update(videos)
        .set({
          muxStatus: data.status,
          muxPlaybackId: playbackId,
          muxAssetId: data.id,
          thumbnailUrl,
          thumbnailKey,
          previewUrl,
          previewKey,
          duration,
        })
        .where(eq(videos.muxUploadId, data.upload_id))
      break
    }

    case 'video.asset.errored': {
      const data = payload.data as VideoAssetErroredWebhookEvent['data']

      if (!data.upload_id) {
        return new Response('uploadId不存在', { status: 400 })
      }

      await db
        .update(videos)
        .set({
          muxStatus: data.status,
        })
        .where(eq(videos.muxUploadId, data.upload_id))
      break
    }

    case 'video.asset.deleted': {
      const data = payload.data as VideoAssetDeletedWebhookEvent['data']

      if (!data.upload_id) {
        return new Response('uploadId不存在', { status: 400 })
      }

      await db.delete(videos).where(eq(videos.muxUploadId, data.upload_id))
      break
    }

    case 'video.asset.track.ready': {
      const data = payload.data as VideoAssetTrackReadyWebhookEvent['data'] & { asset_id: string }

      const assetId = data.asset_id
      const trackId = data.id
      const status = data.status

      if (!assetId) {
        return new Response('assetId不存在', { status: 400 })
      }

      await db
        .update(videos)
        .set({
          muxTrackId: trackId,
          muxTrackStatus: status,
        })
        .where(eq(videos.muxAssetId, assetId))
      break
    }
  }
  return new Response('Webhook已接收', { status: 200 })
}
