import { verifyQStashRequest } from '@/lib/qstash'

export const maxDuration = 60

export async function POST(request: Request) {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY
  const next = process.env.QSTASH_NEXT_SIGNING_KEY
  const base = process.env.UPSTASH_WORKFLOW_URL?.replace(/\/+$/, '')
  if (!current || !next || !base) return new Response('Maintenance unavailable', { status: 503 })
  if (!(await verifyQStashRequest(request, current, next, `${base}/api/videos/maintenance/uploads`))) {
    return new Response('Unauthorized', { status: 401 })
  }
  try {
    const { runUploadCleanup } = await import('@/modules/videos/server/services/upload-cleanup')
    const result = await runUploadCleanup()
    console.info('Upload cleanup', result)
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return new Response('Upload maintenance failed', { status: 503 })
  }
}
