import { isMissing } from './video-cleanup'

interface PlaybackProvider {
  revoke: (id: string) => Promise<unknown>
  create: () => Promise<{ id: string }>
  commit: (id: string) => Promise<boolean>
}

/** Keep the old ID in the database until revocation and replacement both succeed. */
export async function completePlaybackRevocation(oldId: string, provider: PlaybackProvider) {
  const revoke = async (id: string) => {
    try {
      await provider.revoke(id)
    } catch (error) {
      if (!isMissing(error)) throw error
    }
  }
  await revoke(oldId)
  const replacement = await provider.create()
  // Only the winning retry publishes its ID. A losing retry removes only its own ID.
  // Do not delete on an ambiguous database error: the commit may have succeeded.
  if (!(await provider.commit(replacement.id))) await revoke(replacement.id)
}
