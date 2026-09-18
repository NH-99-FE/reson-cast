type Reaction = 'like' | 'dislike' | null

export function toggleReaction<T extends { viewerReaction: Reaction; likeCount: number; dislikeCount: number }>(
  current: T,
  action: Exclude<Reaction, null>
) {
  const next = current.viewerReaction === action ? null : action
  return {
    viewerReaction: next,
    likeCount: Math.max(0, current.likeCount - Number(current.viewerReaction === 'like') + Number(next === 'like')),
    dislikeCount: Math.max(0, current.dislikeCount - Number(current.viewerReaction === 'dislike') + Number(next === 'dislike')),
  }
}
