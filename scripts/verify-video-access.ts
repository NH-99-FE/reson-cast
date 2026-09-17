import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../package.json', import.meta.url))
require('dotenv').config({ path: '.env', quiet: true })
async function main() {
  if (process.env.RUN_DATABASE_TESTS !== '1') throw new Error('Set RUN_DATABASE_TESTS=1 to permit temporary database fixtures')
  const { appRouter } = await import('../src/trpc/routers/_app')
  const sql = require('@neondatabase/serverless').neon(process.env.DATABASE_URL)
  const ownerId = randomUUID(),
    otherId = randomUUID(),
    videoId = randomUUID(),
    commentId = randomUUID(),
    playlistId = randomUUID()
  const ownerClerk = `security-test-${ownerId}`,
    otherClerk = `security-test-${otherId}`
  try {
    await sql`insert into users(id,clerk_id,name,image_url) values (${ownerId},${ownerClerk},'Temporary access test',''),(${otherId},${otherClerk},'Temporary access test','')`
    await sql`insert into videos(id,title,user_id,visibility) values (${videoId},'Temporary private access test',${ownerId},'private')`
    await sql`insert into comments(id,user_id,video_id,value) values (${commentId},${ownerId},${videoId},'Temporary access test')`
    await sql`insert into playlists(id,name,user_id) values (${playlistId},'Temporary access test',${otherId})`
    const owner = appRouter.createCaller({ clerkUserId: ownerClerk })
    const other = appRouter.createCaller({ clerkUserId: otherClerk })
    const guest = appRouter.createCaller({ clerkUserId: null })
    const allowed = await owner.videos.getOne({ id: videoId })
    if (allowed.id !== videoId) throw new Error('OwnerDenied')
    console.log('PASS: author can read private video')
    for (const [name, caller] of [
      ['guest', guest],
      ['other account', other],
    ] as const) {
      for (const [operation, fn] of [
        ['details', () => caller.videos.getOne({ id: videoId })],
        ['playback', () => caller.videos.getPlayback({ id: videoId })],
        ['comments', () => caller.comments.getMany({ videoId, limit: 5 })],
        ['suggestions', () => caller.suggestions.getMany({ videoId, limit: 5 })],
      ] as const) {
        try {
          await fn()
          throw new Error('AccessAllowed')
        } catch (e) {
          if ((e as { code?: string }).code !== 'NOT_FOUND') throw e
        }
        console.log(`PASS: ${name} denied ${operation}`)
      }
      const search = await caller.search.getMany({ query: 'Temporary private access test', limit: 100 })
      if (search.items.some(item => item.id === videoId)) throw new Error('PrivateSearchLeak')
      console.log(`PASS: ${name} search hides private video`)
    }
    for (const [name, fn] of [
      ['comment creation', () => other.comments.create({ videoId, value: 'must be denied' })],
      ['video reaction', () => other.videoReactions.like({ videoId })],
      ['comment reaction', () => other.commentReactions.like({ commentId })],
      ['view recording', () => other.videoViews.create({ videoId })],
      ['playlist addition', () => other.playlists.addVideo({ videoId, playlistId })],
    ] as const) {
      try {
        await fn()
        throw new Error('WriteAllowed')
      } catch (e) {
        if ((e as { code?: string }).code !== 'NOT_FOUND') throw e
      }
      console.log(`PASS: other account denied ${name}`)
    }
    await sql`update videos set deletion_requested_at=now() where id=${videoId}`
    try {
      await owner.videos.getOne({ id: videoId })
      throw new Error('DeletedVisible')
    } catch (e) {
      if ((e as { code?: string }).code !== 'NOT_FOUND') throw e
    }
    console.log('PASS: deleting video denied even to author')
  } finally {
    await sql`delete from users where id in (${ownerId},${otherId})`
    const rows = await sql`select count(*)::int as n from videos where id=${videoId}`
    if (rows[0].n !== 0) throw new Error('FixtureCleanupFailed')
    console.log('Temporary database fixtures cleaned')
  }
}
main().catch(e => {
  console.error('Integration failed:', e?.code ?? e?.constructor?.name)
  process.exitCode = 1
})
