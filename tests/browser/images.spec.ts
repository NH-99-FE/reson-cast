import { createServer } from 'node:http'

import { expect, test } from '@playwright/test'

import { publicMuxThumbnailResponse } from '../../src/lib/video-image-response'
import { publicMuxThumbnailPath, thumbnailVersion } from '../../src/lib/video-image-source'

const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

test('real Next Image optimizes public custom covers while private covers use direct URLs', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/test-cover.png', route => route.fulfill({ contentType: 'image/gif', body: gif }))
  await page.route('**/_next/image?*', route => route.fulfill({ contentType: 'image/gif', body: gif }))
  await page.route('**/api/public/video-mux-thumbnails/**', route => route.fulfill({ contentType: 'image/gif', body: gif }))
  await page.goto('/images')
  await expect(page.getByAltText('public custom')).toHaveAttribute('src', /\/_next\/image\?url=%2Fapi%2Fpublic%2Fvideo-thumbnails/)
  await expect(page.getByAltText('public custom')).toHaveAttribute('srcset', /\/_next\/image/)
  await expect(page.getByAltText('private custom')).toHaveAttribute('src', /\/test-cover\.png$/)
  await expect(page.getByAltText('private custom')).not.toHaveAttribute('srcset')
  await expect
    .poll(() => page.getByAltText('public mux').evaluate((image: HTMLImageElement) => new URL(image.src).pathname))
    .toBe(publicMuxThumbnailPath('00000000-0000-4000-8000-000000000002', 'test-mux', 640))
  await expect(page.getByAltText('public mux')).not.toHaveAttribute('srcset')
  await expect(page.getByAltText('private mux')).toHaveAttribute('src', /\/test-cover\.png$/)
  expect(errors).toEqual([])
})

test('public Mux covers hit the browser cache across documents without another access check or Mux fetch', async ({ page, baseURL }) => {
  const videoId = '00000000-0000-4000-8000-000000000002'
  const path = publicMuxThumbnailPath(videoId, 'test-mux', 640)
  let checks = 0
  let fetches = 0
  // Use a real HTTP response: Playwright route interception disables the browser cache.
  const server = createServer(async (request, response) => {
    try {
      if (request.url === path) {
        const image = await publicMuxThumbnailResponse(
          { videoId, version: thumbnailVersion('test-mux'), width: '640' },
          {
            publicVideo: async () => {
              checks++
              return { thumbnailKey: null, muxPlaybackId: 'test-mux' }
            },
            signMux: async () => 'https://image.mux.com/test-mux/thumbnail.webp?token=server-only',
            fetchImage: (async () => {
              fetches++
              return new Response(gif, { headers: { 'Content-Type': 'image/gif' } })
            }) as typeof fetch,
          }
        )
        response.writeHead(image.status, Object.fromEntries(image.headers))
        response.end(Buffer.from(await image.arrayBuffer()))
      } else if (request.url === '/first' || request.url === '/second') {
        response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' })
        response.end(`<!doctype html><html><body><div id="root"></div><script src="${baseURL}/images.js"></script></body></html>`)
      } else {
        response.writeHead(404, { 'Cache-Control': 'no-store' })
        response.end()
      }
    } catch {
      response.writeHead(500, { 'Cache-Control': 'no-store' })
      response.end()
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture server address')
  const origin = `http://127.0.0.1:${address.port}`
  try {
    const firstResponse = page.waitForResponse(`${origin}${path}`)
    await page.goto(`${origin}/first`)
    expect((await firstResponse).headers()['cache-control']).toContain('max-age=3600')
    const cover = page.getByAltText('public mux')
    await expect.poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1)
    expect(checks).toBe(1)
    expect(fetches).toBe(1)
    await page.goto(`${origin}/second`)
    await expect.poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1)
    const cached = await page.evaluate(url => {
      const entry = performance.getEntriesByName(url)[0] as PerformanceResourceTiming
      return { transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize }
    }, `${origin}${path}`)
    expect(cached.transferSize).toBe(0)
    expect(cached.encodedBodySize).toBeGreaterThan(0)
    expect(checks).toBe(1)
    expect(fetches).toBe(1)
  } finally {
    await page.goto('about:blank')
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
  }
})

test('preview loads on interaction, reuses the mounted image, and keeps the cover visible while loading or failing', async ({ page }) => {
  let requests = 0
  let finish: (() => void) | undefined
  await page.route('**/test-cover.png', route => route.fulfill({ contentType: 'image/gif', body: gif }))
  await page.route('**/test-preview.gif', async route => {
    requests++
    if (requests === 1) {
      await new Promise<void>(resolve => {
        finish = resolve
      })
      await route.fulfill({ contentType: 'image/gif', body: gif, headers: { 'Cache-Control': 'no-store' } })
    } else await route.fulfill({ status: 403, body: '' })
  })
  await page.goto('/images')
  const thumbnail = page.getByTestId('thumbnail')
  const cover = thumbnail.getByAltText('Test video')
  const preview = thumbnail.locator('img[aria-hidden="true"]')
  await expect(cover).toBeVisible()
  await expect(preview).toHaveCount(0)
  expect(requests).toBe(0)
  await cover.hover()
  await expect.poll(() => requests).toBe(1)
  await expect(preview).toHaveClass(/opacity-0/)
  await expect(cover).not.toHaveClass(/opacity-0/)
  finish!()
  await expect(preview).toHaveClass(/opacity-100/)
  const loadedPreview = await preview.elementHandle()
  await page.mouse.move(800, 600)
  await expect(preview).toHaveCount(1)
  await expect(preview).toBeHidden()
  await cover.hover()
  await expect(preview).toHaveClass(/opacity-100/)
  await expect(preview).toBeVisible()
  expect(await preview.evaluate((element, original) => element === original, loadedPreview)).toBe(true)
  expect(requests).toBe(1)
  // A new document still checks access; the next request is denied.
  await page.reload()
  await expect(preview).toHaveCount(0)
  await cover.hover()
  await expect.poll(() => requests).toBe(2)
  await expect(preview).toHaveCount(0)
  await expect(cover).toBeVisible()
  await page.getByTestId('no-preview').hover()
  await expect(page.getByTestId('no-preview').locator('img')).toHaveCount(1)
  expect(requests).toBe(2)
})

test('touch starts a preview and release or cancellation hides it for reuse', async ({ page }) => {
  let requests = 0
  await page.route('**/test-cover.png', route => route.fulfill({ contentType: 'image/gif', body: gif }))
  await page.route('**/test-preview.gif', route => {
    requests++
    return route.fulfill({ contentType: 'image/gif', body: gif, headers: { 'Cache-Control': 'no-store' } })
  })
  await page.goto('/images')
  const cover = page.getByAltText('Test video')
  const preview = page.getByTestId('thumbnail').locator('img[aria-hidden="true"]')
  await cover.dispatchEvent('pointerdown', { pointerType: 'touch', bubbles: true })
  await expect(preview).toBeVisible()
  await cover.dispatchEvent('pointerup', { pointerType: 'touch', bubbles: true })
  await expect(preview).toHaveCount(1)
  await expect(preview).toBeHidden()
  await cover.dispatchEvent('pointerdown', { pointerType: 'touch', bubbles: true })
  await expect(preview).toBeVisible()
  await cover.dispatchEvent('pointercancel', { pointerType: 'touch', bubbles: true })
  await expect(preview).toHaveCount(1)
  await expect(preview).toBeHidden()
  expect(requests).toBe(1)
})

for (const interaction of ['hover', 'touch'] as const) {
  test(`failed preview retries on the next ${interaction} interaction and reuses the recovered image`, async ({ page }) => {
    let requests = 0
    await page.route('**/test-cover.png', route => route.fulfill({ contentType: 'image/gif', body: gif }))
    await page.route('**/test-preview.gif', route => {
      requests++
      return requests === 1
        ? route.fulfill({ status: 403, body: '', headers: { 'Cache-Control': 'no-store' } })
        : route.fulfill({ contentType: 'image/gif', body: gif, headers: { 'Cache-Control': 'no-store' } })
    })
    await page.goto('/images')
    const thumbnail = page.getByTestId('thumbnail')
    const cover = thumbnail.getByAltText('Test video')
    const preview = thumbnail.locator('img[aria-hidden="true"]')
    const activate = async () => {
      if (interaction === 'hover') await cover.hover()
      else await cover.dispatchEvent('pointerdown', { pointerType: 'touch', bubbles: true })
    }
    const deactivate = async () => {
      if (interaction === 'hover') await page.mouse.move(800, 600)
      else await cover.dispatchEvent('pointercancel', { pointerType: 'touch', bubbles: true })
    }
    await activate()
    await expect.poll(() => requests).toBe(1)
    await expect
      .poll(() => preview.evaluateAll(images => images.length === 0 || images.every(image => (image as HTMLImageElement).complete)))
      .toBe(true)
    await expect(cover).toBeVisible()
    await expect(preview).toBeHidden()
    expect(requests).toBe(1)
    await deactivate()
    await activate()
    await expect.poll(() => requests).toBe(2)
    await expect(preview).toBeVisible()
    await deactivate()
    await activate()
    await expect(preview).toBeVisible()
    expect(requests).toBe(2)
  })
}
