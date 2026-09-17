import { config } from 'dotenv'

config({ path: '.env', quiet: true })

async function main() {
  if (process.env.RUN_VIDEO_RECOVERY !== '1') throw new Error('Set RUN_VIDEO_RECOVERY=1 to retry persisted video work')
  const { db } = await import('../src/db')
  const { videoFileCleanup, videoGenerationJobs } = await import('../src/db/schema')
  const { eq, isNull } = await import('drizzle-orm')
  const { cleanupVideoFiles } = await import('../src/modules/videos/server/services/thumbnails')
  const { retryVideoGeneration } = await import('../src/modules/videos/server/services/generation')
  let failed = 0
  const files = await db
    .selectDistinct({ videoId: videoFileCleanup.videoId })
    .from(videoFileCleanup)
    .where(isNull(videoFileCleanup.cleanedAt))
    .limit(100)
  for (const { videoId } of files) {
    try {
      if (await cleanupVideoFiles(videoId)) failed++
    } catch {
      failed++
      console.error('File cleanup retry failed', { videoId })
    }
  }
  const jobs = await db.select().from(videoGenerationJobs).where(eq(videoGenerationJobs.status, 'queued')).limit(100)
  for (const job of jobs) {
    try {
      if ((await retryVideoGeneration(job.id, job.userId)).error) failed++
    } catch {
      failed++
      console.error('Generation dispatch retry failed', { jobId: job.id })
    }
  }
  console.log({ cleanupVideos: files.length, queuedJobs: jobs.length, failed })
  if (failed) process.exitCode = 1
}
main().catch(() => {
  console.error('Video recovery failed; check configuration and database availability')
  process.exitCode = 1
})
