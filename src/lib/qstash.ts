import { Receiver } from '@upstash/qstash'

export async function verifyQStashRequest(request: Request, currentSigningKey: string, nextSigningKey: string, url: string) {
  const signature = request.headers.get('upstash-signature')
  if (!signature) return false
  try {
    return await new Receiver({ currentSigningKey, nextSigningKey }).verify({ signature, body: await request.text(), url })
  } catch {
    return false
  }
}

export function qstashScheduleOrigin(environment: string | undefined, baseUrl: string | undefined) {
  if (environment !== 'production' && environment !== 'development') {
    throw new Error('Specify the scanner environment: schedule production | schedule development')
  }
  if (!baseUrl) throw new Error('Configure UPSTASH_WORKFLOW_URL')
  const url = new URL(baseUrl)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('UPSTASH_WORKFLOW_URL must be an HTTPS origin without credentials, path, query or fragment')
  }
  const isLocal =
    url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  const isNgrok = ['ngrok-free.app', 'ngrok-free.dev', 'ngrok.app', 'ngrok.io'].some(
    domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
  )
  if (environment === 'production' && (isLocal || isNgrok)) {
    throw new Error('Production scanner must target the deployed application, not localhost or ngrok')
  }
  return url.origin
}
