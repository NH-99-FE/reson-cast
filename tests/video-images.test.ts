import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { mock, test } from 'node:test'

import { TRPCError } from '@trpc/server'
import { imageOptimizer } from 'next/dist/server/image-optimizer'
import { imageConfigDefault } from 'next/dist/shared/lib/image-config'

import nextConfig from '../next.config'
import { publicMuxThumbnailResponse, publicThumbnailResponse, videoImageResponse } from '../src/lib/video-image-response'
import {
  cardThumbnailSource,
  publicMuxThumbnailPath,
  publicThumbnailPath,
  thumbnailVersion,
  videoThumbnailSource,
} from '../src/lib/video-image-source'

const videoId = '00000000-0000-4000-8000-000000000002'

test('card width preserves versions, validates sizes, and defaults full-size requests to 1280', async () => {
  const path = `/api/videos/${videoId}/image/thumbnail`
  assert.equal(cardThumbnailSource(`${path}?v=mux`), `${path}?v=mux&width=640`)
  const publicPath = publicThumbnailPath(videoId, 'cover')
  assert.equal(cardThumbnailSource(publicPath), publicPath)
  const widths: number[] = []
  const access = {
    readableVideo: async () => ({ thumbnailKey: null, previewKey: null, muxPlaybackId: 'mux' }),
    signFile: async () => 'unused',
    signMux: async (_id: string, _kind: string, width: number) => {
      widths.push(width)
      return 'https://image.mux.com/test/thumbnail.webp'
    },
  }
  for (const width of ['640', undefined]) {
    assert.equal((await videoImageResponse({ videoId, kind: 'thumbnail', width }, access)).status, 307)
  }
  assert.deepEqual(widths, [640, 1280])
  assert.equal((await videoImageResponse({ videoId, kind: 'thumbnail', width: '99999' }, access)).status, 404)
  assert.deepEqual(widths, [640, 1280])
})

test('public source accepts additional uploaded image formats with sandboxed attachment responses', async () => {
  for (const contentType of ['image/svg+xml', 'image/bmp', 'image/tiff', 'image/x-icon']) {
    const response = await publicThumbnailResponse(
      { videoId, version: thumbnailVersion('cover') },
      {
        publicVideo: async () => ({ thumbnailKey: 'cover' }),
        signFile: async () => 'https://files.example/cover',
        fetchImage: (async () => new Response('image bytes', { headers: { 'Content-Type': contentType } })) as typeof fetch,
      }
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), contentType)
    assert.equal(response.headers.get('content-disposition'), 'attachment')
    assert.match(response.headers.get('content-security-policy')!, /sandbox/)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  }
})

test('Next image endpoint serves extensionless SVG covers and banners without rasterizing them', async () => {
  const buffer = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>'
  )
  for (const href of [publicThumbnailPath(videoId, 'cover'), 'https://utfs.io/f/extensionless-banner']) {
    const result = await imageOptimizer(
      { buffer, contentType: 'image/svg+xml', cacheControl: 'no-store', etag: 'svg-test' },
      { href, width: 640, quality: 75, mimeType: 'image/webp' },
      { images: { ...imageConfigDefault, ...nextConfig.images }, experimental: {} },
      { isDev: false, silent: true }
    )
    assert.equal(result.contentType, 'image/svg+xml')
    assert.deepEqual(result.buffer, buffer)
  }
  assert.equal(nextConfig.images?.contentDispositionType, 'attachment')
  assert.match(nextConfig.images?.contentSecurityPolicy ?? '', /script-src 'none'/)
  assert.match(nextConfig.images?.contentSecurityPolicy ?? '', /sandbox/)
})
test('only public custom covers select the canonical optimizer source', () => {
  const video = { id: videoId, visibility: 'public', thumbnailKey: 'cover', thumbnailUrl: '/api/videos/cover' }
  assert.equal(videoThumbnailSource(video), publicThumbnailPath(videoId, 'cover'))
  assert.equal(videoThumbnailSource({ ...video, visibility: 'private' }), video.thumbnailUrl)
  assert.equal(videoThumbnailSource({ ...video, thumbnailKey: null }), video.thumbnailUrl)
  assert.equal(videoThumbnailSource({ ...video, deletionRequestedAt: new Date() }), video.thumbnailUrl)
  assert.equal(nextConfig.images?.minimumCacheTTL, 60)
  assert.ok(nextConfig.images?.remotePatterns?.every(pattern => pattern.search === ''))
  assert.ok(nextConfig.images?.localPatterns?.every(pattern => pattern.search === '' && !pattern.pathname?.startsWith('/api/videos/')))
})

test('public Mux covers have stable version URLs for cards and posters; private/deleted covers retain authentication', () => {
  const video = { id: videoId, visibility: 'public', thumbnailKey: null, muxPlaybackId: 'mux', thumbnailUrl: '/authenticated' }
  const poster = publicMuxThumbnailPath(videoId, 'mux')
  assert.equal(videoThumbnailSource(video), poster)
  assert.equal(cardThumbnailSource(poster), publicMuxThumbnailPath(videoId, 'mux', 640))
  assert.equal(cardThumbnailSource(publicMuxThumbnailPath(videoId, 'mux', 640)), publicMuxThumbnailPath(videoId, 'mux', 640))
  assert.equal(videoThumbnailSource({ ...video, visibility: 'private' }), video.thumbnailUrl)
  assert.equal(videoThumbnailSource({ ...video, deletionRequestedAt: new Date() }), video.thumbnailUrl)
  assert.equal(videoThumbnailSource({ ...video, muxPlaybackId: null }), video.thumbnailUrl)
  assert.notEqual(videoThumbnailSource({ ...video, muxPlaybackId: 'replacement' }), poster)
  assert.equal(videoThumbnailSource({ ...video, thumbnailKey: 'custom' }), publicThumbnailPath(videoId, 'custom'))
})

test('public Mux covers stream bounded images with one-hour caching, without redirecting or exposing signed URLs', async () => {
  const signed: unknown[] = []
  const fetched: unknown[] = []
  for (const width of ['640', '1280']) {
    const response = await publicMuxThumbnailResponse(
      { videoId, version: thumbnailVersion('mux'), width },
      {
        publicVideo: async () => ({ thumbnailKey: null, muxPlaybackId: 'mux' }),
        signMux: async (id, kind, width) => {
          signed.push({ id, kind, width })
          return 'https://image.mux.com/mux/thumbnail.webp?token=secret'
        },
        fetchImage: (async (url, init) => {
          fetched.push({ url, cache: init?.cache })
          return new Response('image bytes', { headers: { 'Content-Type': 'image/webp' } })
        }) as typeof fetch,
      }
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'public, max-age=3600, s-maxage=3600, must-revalidate')
    assert.equal(response.headers.get('content-type'), 'image/webp')
    assert.equal(response.headers.get('location'), null)
    assert.equal(response.headers.get('vary'), null)
    assert.equal(await response.text(), 'image bytes')
  }
  assert.deepEqual(signed, [
    { id: 'mux', kind: 'thumbnail', width: 640 },
    { id: 'mux', kind: 'thumbnail', width: 1280 },
  ])
  assert.deepEqual(fetched, Array(2).fill({ url: 'https://image.mux.com/mux/thumbnail.webp?token=secret', cache: 'no-store' }))
})

test('public Mux source rejects unavailable videos, stale playback IDs, custom covers, invalid inputs, and failed upstream images', async () => {
  let video: { thumbnailKey: string | null; muxPlaybackId: string | null } | undefined
  let signed = 0
  let contentType: string | undefined = 'image/webp'
  let status = 200
  const access = {
    publicVideo: async () => video,
    signMux: async () => {
      signed++
      return 'https://image.mux.com/mux/thumbnail.webp?token=secret'
    },
    fetchImage: (async () =>
      new Response('bytes', { status, headers: contentType ? { 'Content-Type': contentType } : {} })) as typeof fetch,
  }
  const params = { videoId, version: thumbnailVersion('mux'), width: '640' }
  for (const unavailable of [
    undefined, // The public query excludes private and deleted videos, including owner requests.
    { thumbnailKey: null, muxPlaybackId: null },
    { thumbnailKey: null, muxPlaybackId: 'replacement' },
    { thumbnailKey: 'custom', muxPlaybackId: 'mux' },
  ]) {
    video = unavailable
    const response = await publicMuxThumbnailResponse(params, access)
    assert.equal(response.status, 404)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
  video = { thumbnailKey: null, muxPlaybackId: 'mux' }
  for (const invalid of [{ width: '99999' }, { videoId: 'invalid' }, { version: 'not-hex' }]) {
    assert.equal((await publicMuxThumbnailResponse({ ...params, ...invalid }, access)).status, 404)
  }
  assert.equal(signed, 0)
  for (const upstream of [
    { status: 403, contentType: 'image/webp' },
    { status: 200, contentType: 'text/html' },
    { status: 200, contentType: undefined },
  ]) {
    ;({ status, contentType } = upstream)
    const response = await publicMuxThumbnailResponse(params, access)
    assert.equal(response.status, 502)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('location'), null)
  }
})

test('public source rejects private/deleted videos and old versions before fetching; never redirects a bearer URL', async () => {
  let video: { thumbnailKey: string | null } | undefined = { thumbnailKey: 'cover' }
  let fetched = 0
  const access = {
    publicVideo: async () => video,
    signFile: async () => 'https://private.example/cover?signature=secret',
    fetchImage: (async () => {
      fetched++
      return new Response('bytes', { headers: { 'Content-Type': 'image/png' } })
    }) as typeof fetch,
  }
  const params = { videoId, version: thumbnailVersion('cover') }
  const result = await publicThumbnailResponse(params, access)
  assert.equal(result.status, 200)
  assert.equal(result.headers.get('location'), null)
  assert.equal(result.headers.get('cache-control'), 'private, no-store')
  assert.equal(await result.text(), 'bytes')
  video = { thumbnailKey: 'replacement' }
  assert.equal((await publicThumbnailResponse(params, access)).status, 404)
  video = undefined
  assert.equal((await publicThumbnailResponse(params, access)).status, 404)
  assert.equal(fetched, 1)
  video = { thumbnailKey: 'cover' }
  const unsafe = await publicThumbnailResponse(params, {
    ...access,
    fetchImage: (async () => new Response('<html/>', { headers: { 'Content-Type': 'text/html' } })) as typeof fetch,
  })
  assert.equal(unsafe.status, 502)
})

test('image access redirects without fetching bytes and rechecks access after visibility changes', async () => {
  let readable = true
  let checks = 0
  const signed: unknown[] = []
  const access = {
    readableVideo: async () => {
      checks++
      if (!readable) throw new TRPCError({ code: 'NOT_FOUND' })
      return { thumbnailKey: 'cover', previewKey: 'preview', muxPlaybackId: null }
    },
    signFile: async (key: string, expiresIn: number) => {
      signed.push({ key, expiresIn })
      return `https://files.example/${key}?signature=test`
    },
    signMux: async () => {
      throw new Error('unexpected Mux request')
    },
  }
  const fetch = mock.method(globalThis, 'fetch', () => {
    throw new Error('must not fetch image bytes')
  })
  try {
    for (const kind of ['thumbnail', 'preview']) {
      const response = await videoImageResponse({ videoId, kind }, access)
      assert.equal(response.status, 307)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      assert.equal(response.headers.get('vary'), 'Cookie, Authorization')
      assert.match(response.headers.get('location')!, /^https:\/\/files.example\//)
      assert.equal(await response.text(), '')
    }
    assert.deepEqual(signed, [
      { key: 'cover', expiresIn: 60 },
      { key: 'preview', expiresIn: 60 },
    ])
    readable = false
    const denied = await videoImageResponse({ videoId, kind: 'thumbnail' }, access)
    assert.equal(denied.status, 404)
    assert.equal(denied.headers.get('location'), null)
    assert.equal(checks, 3)
    assert.equal(signed.length, 2)
    for (const params of [
      { videoId: 'invalid', kind: 'thumbnail' },
      { videoId, kind: 'other' },
    ]) {
      assert.equal((await videoImageResponse(params, access)).status, 404)
    }
    assert.equal(checks, 3)
  } finally {
    fetch.mock.restore()
  }
})

test('Mux redirects select the requested image kind and missing sources return 404', async () => {
  let muxPlaybackId: string | null = 'playback'
  const access = {
    readableVideo: async () => ({ thumbnailKey: null, previewKey: null, muxPlaybackId }),
    signFile: async () => {
      throw new Error('unexpected file request')
    },
    signMux: async (id: string, kind: string) => `https://image.mux.com/${id}/${kind}?token=test`,
  }
  assert.equal(
    (await videoImageResponse({ videoId, kind: 'preview' }, access)).headers.get('location'),
    'https://image.mux.com/playback/preview?token=test'
  )
  muxPlaybackId = null
  assert.equal((await videoImageResponse({ videoId, kind: 'thumbnail' }, access)).status, 404)
})

test('Mux image tokens expire after one minute and sign bounded image dimensions', async () => {
  process.env.MUX_TOKEN_ID = 'test'
  process.env.MUX_TOKEN_SECRET = 'test'
  process.env.MUX_SIGNING_KEY_ID = 'test-key'
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  process.env.MUX_SIGNING_PRIVATE_KEY = Buffer.from(privateKey.export({ type: 'pkcs1', format: 'pem' })).toString('base64')
  const { muxImage } = await import('../src/lib/video-media')
  const cardUrl = new URL(await muxImage('playback', 'thumbnail', 640))
  const cardClaims = JSON.parse(Buffer.from(cardUrl.searchParams.get('token')!.split('.')[1], 'base64url').toString())
  assert.equal(cardClaims.width, '640')
  for (const kind of ['thumbnail', 'preview'] as const) {
    const before = Math.floor(Date.now() / 1000)
    const url = new URL(await muxImage('playback', kind))
    const claims = JSON.parse(Buffer.from(url.searchParams.get('token')!.split('.')[1], 'base64url').toString())
    assert.equal(claims.sub, 'playback')
    assert.equal(claims.aud, kind === 'thumbnail' ? 't' : 'g')
    assert.ok(claims.exp >= before + 59 && claims.exp <= Math.floor(Date.now() / 1000) + 60)
    assert.equal(claims.width, kind === 'thumbnail' ? '1280' : '480')
    if (kind === 'preview') assert.equal(claims.fps, '8')
    assert.equal(url.pathname, `/playback/${kind === 'thumbnail' ? 'thumbnail.webp' : 'animated.gif'}`)
    assert.deepEqual([...url.searchParams.keys()], ['token'])
  }
})
