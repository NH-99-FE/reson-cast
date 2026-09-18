import type { TokenDetails } from 'ably'
import { SignJWT } from 'jose'

/** Sign locally so the browser can connect without exchanging a TokenRequest. */
export async function signRealtimeToken(
  apiKey: string | undefined,
  params: { clientId: string; ttl: number; capability: string },
  now = Date.now()
): Promise<TokenDetails> {
  const separator = apiKey?.indexOf(':') ?? -1
  if (!apiKey || separator <= 0 || separator === apiKey.length - 1) throw new Error('Ably is not configured')
  const issued = Math.floor(now / 1000)
  const expires = issued + Math.floor(params.ttl / 1000)
  const token = await new SignJWT({ 'x-ably-clientId': params.clientId, 'x-ably-capability': params.capability })
    .setProtectedHeader({ typ: 'JWT', alg: 'HS256', kid: apiKey.slice(0, separator) })
    .setIssuedAt(issued)
    .setExpirationTime(expires)
    .sign(new TextEncoder().encode(apiKey.slice(separator + 1)))
  return {
    token,
    clientId: params.clientId,
    capability: params.capability,
    issued: issued * 1000,
    expires: expires * 1000,
  }
}
