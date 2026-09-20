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
test('declining preserves upload; confirming aborts and ignores racing success', async ({ page }, testInfo) => {
  await start(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: '放弃本次上传' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  expect(await page.evaluate(() => window.uploadTest.aborted)).toBe(0)
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('confirmation.png') })
  await page.getByRole('button', { name: '继续上传', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => window.uploadTest.deleted)).toBe(0)
  expect(await page.evaluate(() => window.uploadTest.aborted)).toBe(0)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '放弃上传', exact: true }).click()
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
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '放弃上传', exact: true }).click()
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

test('completion while confirmation is open closes it and keeps the uploaded video', async ({ page }) => {
  await start(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: '放弃本次上传' })).toBeVisible()
  await page.evaluate(() => document.querySelector('mux-uploader')!.dispatchEvent(new CustomEvent('success')))
  await expect(page.getByRole('region', { name: '放弃本次上传' })).toHaveCount(0)
  expect(await page.evaluate(() => window.uploadTest.deleted)).toBe(0)
  expect(await page.evaluate(() => window.uploadTest.navigated)).toEqual(['/studio/videos/video'])
})

test('confirmation stays a centered dialog on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/upload')
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await start(page)
  await page.keyboard.press('Escape')
  const dialog = page.getByRole('region', { name: '放弃本次上传' })
  await expect(dialog).toBeVisible()
  await expect(page.locator('[data-slot="drawer-content"]')).toHaveCount(0)
  const bounds = await dialog.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('confirmation-mobile.png') })
  await page.getByRole('button', { name: '继续上传', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => window.uploadTest.deleted)).toBe(0)
})

test('close and Escape return to progress without cancelling', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  const confirmation = page.getByRole('region', { name: '放弃本次上传' })
  await expect(confirmation).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(confirmation).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(confirmation).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '上传视频' })).toBeVisible()
  expect(await page.evaluate(() => window.uploadTest.aborted)).toBe(0)
  expect(await page.evaluate(() => window.uploadTest.deleted)).toBe(0)
})

test('dialog shrinks and expands at fixed width without unmounting the uploader', async ({ page }) => {
  await start(page)
  const heights = await page.evaluate(async () => {
    const original = document.querySelector('mux-uploader')!
    const panel = document.querySelector('[data-upload-confirmation]')!
    const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    const height = () => panel.getBoundingClientRect().height
    const close = document.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!
    const dialog = document.querySelector('[role="dialog"]')!
    await Promise.all(dialog.getAnimations().map(animation => animation.finished))
    const before = dialog.getBoundingClientRect().toJSON()
    close.click()
    await frame()
    await frame()
    const opening = height()
    await new Promise(resolve => setTimeout(resolve, 350))
    const expanded = height()
    const compact = dialog.getBoundingClientRect().toJSON()
    const hiddenProgressHeight = document.querySelector('[data-upload-progress-panel]')!.getBoundingClientRect().height
    const button = Array.from(panel.querySelectorAll('button')).find(node => node.textContent === '继续上传')!
    button.click()
    await frame()
    await frame()
    const closing = height()
    await new Promise(resolve => setTimeout(resolve, 350))
    return {
      before,
      compact,
      hiddenProgressHeight,
      opening,
      expanded,
      closing,
      collapsed: height(),
      mounted: original === document.querySelector('mux-uploader'),
    }
  })
  expect(heights.expanded).toBeGreaterThan(50)
  expect(heights.compact.height).toBeLessThan(heights.before.height - 100)
  expect(heights.compact.width).toBe(heights.before.width)
  expect(heights.hiddenProgressHeight).toBe(0)
  expect(heights.opening).toBeLessThan(heights.expanded)
  expect(heights.closing).toBeGreaterThan(0)
  expect(heights.collapsed).toBe(0)
  expect(heights.mounted).toBe(true)
  await expect(page.locator('mux-uploader-progress[type="bar"][mux-uploader="video-uploader"]')).toBeVisible()
  expect(await page.evaluate(() => window.uploadTest.aborted)).toBe(0)
})

test('upload ignores outside clicks and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await start(page)
  await page.mouse.click(5, 5)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('region', { name: '放弃本次上传' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('region', { name: '放弃本次上传' })).toBeVisible()
  expect(await page.locator('[data-upload-confirmation]').evaluate(el => getComputedStyle(el).transitionProperty)).toBe('none')
  await page.getByRole('button', { name: '继续上传' }).click()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '放弃上传', includeHidden: true })).not.toBeFocused()
})
