import { expect, test } from '@playwright/test'

const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

test('real Next Image optimizes public custom covers while private covers use direct URLs', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/test-cover.png', route => route.fulfill({ contentType: 'image/gif', body: gif }))
  await page.route('**/_next/image?*', route => route.fulfill({ contentType: 'image/gif', body: gif }))
  await page.goto('/images')
  await expect(page.getByAltText('public custom')).toHaveAttribute('src', /\/_next\/image\?url=%2Fapi%2Fpublic%2Fvideo-thumbnails/)
  await expect(page.getByAltText('public custom')).toHaveAttribute('srcset', /\/_next\/image/)
  await expect(page.getByAltText('private custom')).toHaveAttribute('src', /\/test-cover\.png$/)
  await expect(page.getByAltText('private custom')).not.toHaveAttribute('srcset')
  expect(errors).toEqual([])
})

test('preview downloads only on interaction and leaves the cover visible while loading or failing', async ({ page }) => {
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
  await page.mouse.move(800, 600)
  await expect(preview).toHaveCount(0)
  // A browser may reuse an already decoded image within the same document.
  await page.reload()
  await cover.hover()
  await expect.poll(() => requests).toBe(2)
  await expect(preview).toHaveClass(/opacity-0/)
  await expect(cover).toBeVisible()
  await page.getByTestId('no-preview').hover()
  await expect(page.getByTestId('no-preview').locator('img')).toHaveCount(1)
  expect(requests).toBe(2)
})

test('touch starts a preview and cancellation removes it', async ({ page }) => {
  await page.route('**/test-cover.png', route => route.fulfill({ contentType: 'image/gif', body: gif }))
  await page.route('**/test-preview.gif', route => route.fulfill({ contentType: 'image/gif', body: gif }))
  await page.goto('/images')
  const cover = page.getByAltText('Test video')
  const preview = page.getByTestId('thumbnail').locator('img[aria-hidden="true"]')
  await cover.dispatchEvent('pointerdown', { pointerType: 'touch', bubbles: true })
  await expect(preview).toHaveCount(1)
  await cover.dispatchEvent('pointercancel', { pointerType: 'touch', bubbles: true })
  await expect(preview).toHaveCount(0)
})
