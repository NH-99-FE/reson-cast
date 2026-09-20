import { expect, type Page, test } from '@playwright/test'

declare global {
  interface Window {
    uploadTest: { deleted: number; aborted: number; navigated: string[]; fail: boolean }
  }
}

async function start(page: Page) {
  await page.evaluate(() => {
    const element = document.querySelector('mux-uploader')!
    Object.defineProperty(element, 'upload', {
      value: {
        abort() {
          window.uploadTest.aborted++
          // Exercise success arriving synchronously from an abort/completion race.
          element.dispatchEvent(new CustomEvent('success'))
        },
      },
    })
    element.dispatchEvent(new CustomEvent('uploadstart'))
  })
}
test.beforeEach(async ({ page }) => {
  await page.goto('/upload')
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})
test('closing before selecting a file cancels without confirmation', async ({ page }) => {
  page.on('dialog', () => {
    throw new Error('Unexpected confirmation')
  })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => window.uploadTest.deleted)).toBe(1)
})
test('declining preserves upload; confirming aborts and ignores racing success', async ({ page }) => {
  await start(page)
  page.once('dialog', dialog => dialog.dismiss())
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => window.uploadTest.deleted)).toBe(0)
  page.once('dialog', dialog => dialog.accept())
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const result = await page.evaluate(() => window.uploadTest)
  expect(result.deleted).toBe(1)
  expect(result.aborted).toBeGreaterThan(0)
  expect(result.navigated).toEqual([])
})
test('failed cancellation remains retryable', async ({ page }) => {
  await page.evaluate(() => {
    window.uploadTest.fail = true
  })
  await page.keyboard.press('Escape')
  const retry = page.getByRole('button', { name: '重试取消' })
  await expect(retry).toBeEnabled()
  await page.evaluate(() => {
    window.uploadTest.fail = false
  })
  await retry.click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => window.uploadTest.deleted)).toBe(2)
})
test('successful upload retains the record and opens editing', async ({ page }) => {
  await start(page)
  await page.evaluate(() => {
    const uploader = document.querySelector('mux-uploader')!
    uploader.dispatchEvent(new CustomEvent('success'))
    uploader.dispatchEvent(new CustomEvent('success'))
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const result = await page.evaluate(() => window.uploadTest)
  expect(result.deleted).toBe(0)
  expect(result.navigated).toEqual(['/studio/videos/video'])
})

test('a new upload starts fresh after cancelling an active upload', async ({ page }) => {
  await start(page)
  page.once('dialog', dialog => dialog.accept())
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: '创建', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  page.on('dialog', () => {
    throw new Error('A fresh upload must not require confirmation before file selection')
  })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => window.uploadTest.deleted)).toBe(2)
})
