import { verifyQStashRequest } from '@/lib/qstash'
import {
  cleanupFailureDetails,
  createCleanupExecutor,
  generationCleanupPolicy,
  runGenerationCleanup,
} from '@/modules/videos/server/services/generation-cleanup'
import { GENERATION_CLEANUP_PATH } from '@/modules/videos/server/services/generation-cleanup-schedule'

export const maxDuration = 60

export async function POST(request: Request) {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY
  const next = process.env.QSTASH_NEXT_SIGNING_KEY
  const base = process.env.UPSTASH_WORKFLOW_URL?.replace(/\/+$/, '')
  if (!current || !next || !base) return new Response('Maintenance unavailable', { status: 503 })
  if (!(await verifyQStashRequest(request, current, next, `${base}${GENERATION_CLEANUP_PATH}`))) {
    return new Response('Unauthorized', { status: 401 })
  }
  try {
    // Retention and limits are server-owned; the request cannot override them.
    const policy = generationCleanupPolicy()
    const result = await runGenerationCleanup(createCleanupExecutor(), policy)
    console.info('Generation cleanup', result)
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Generation cleanup failed', cleanupFailureDetails(error))
    return new Response('Maintenance failed; inspect server logs before retrying', { status: 503 })
  }
}
