export {}

declare global {
  interface Window {
    interactions: {
      playlistEmpty: boolean
      playlistFail: boolean
      playlistReads: number
      playlistContains: boolean
      holdPlaylist: boolean
      releasePlaylist: (() => void) | null
      sidebarFail: boolean
      holdSidebar: boolean
      releaseSidebar: (() => void) | null
      sidebarReads: number
      fail: boolean
      release: (() => void) | null
      writes: number
      pendingComments: Record<string, (fail: boolean) => void>
      pendingWrites: Record<string, () => void>
    }
  }
}
