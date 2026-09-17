// Provider-independent cleanup logic: retrying after a partial failure is safe.
export interface CleanupResources {
  muxUploadId: string | null
  muxAssetId: string | null
  thumbnailKey: string | null
  previewKey: string | null
}
export interface CleanupProvider {
  upload: (id: string) => Promise<{ status: string; asset_id?: string }>
  cancelUpload: (id: string) => Promise<unknown>
  deleteAsset: (id: string) => Promise<unknown>
  deleteFiles: (keys: (string | null)[]) => Promise<unknown>
}
export function isMissing(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404
}
async function ignoreMissing(action: () => Promise<unknown>) {
  try {
    await action()
  } catch (error) {
    if (!isMissing(error)) throw error
  }
}
export async function cleanupResources(video: CleanupResources, provider: CleanupProvider) {
  const assets = new Set(video.muxAssetId ? [video.muxAssetId] : [])
  if (video.muxUploadId) {
    const id = video.muxUploadId
    try {
      let upload = await provider.upload(id)
      if (upload.status === 'waiting') {
        try {
          await provider.cancelUpload(id)
        } catch (error) {
          // Cancellation can race with asset creation. Re-read before deciding it failed.
          upload = await provider.upload(id)
          if (upload.status === 'waiting') throw error
        }
        upload = await provider.upload(id)
      }
      if (upload.status === 'waiting') throw new Error('Upload is still active')
      if (upload.status === 'asset_created' && !upload.asset_id) throw new Error('Upload asset is not available yet')
      if (upload.asset_id) assets.add(upload.asset_id)
    } catch (error) {
      if (!isMissing(error)) throw error
    }
  }
  for (const id of assets) await ignoreMissing(() => provider.deleteAsset(id))
  await provider.deleteFiles([video.thumbnailKey, video.previewKey])
}
