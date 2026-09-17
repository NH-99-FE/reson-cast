import { expect, test } from '@playwright/test'

test('generation, form editing, recovery and cleanup flows', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto('/')
  await expect(page.locator('body')).toHaveAttribute('data-result', /passed|failed/, { timeout: 110_000 })
  const report = await page.locator('#report').innerText()
  expect(await page.locator('body').getAttribute('data-result'), report).toBe('passed')
  expect(pageErrors).toEqual([])
})
