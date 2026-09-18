import { Receiver } from '@upstash/qstash'

export async function verifyDispatch(request: Request, currentSigningKey: string, nextSigningKey: string, url: string) {
  const signature = request.headers.get('upstash-signature')
  if (!signature) return false
  try {
    return await new Receiver({ currentSigningKey, nextSigningKey }).verify({ signature, body: await request.text(), url })
  } catch {
    return false
  }
}
