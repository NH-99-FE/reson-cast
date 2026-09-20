import { expect, test } from '@playwright/test'

const openPicker = async (page: import('@playwright/test').Page) => {
  await page.locator('main button').first().click()
  await page.getByRole('menuitem', { name: '加入播放列表' }).click()
  await expect(page.getByRole('dialog', { name: '加入播放列表' })).toBeVisible()
}

// The harness uses real components and tRPC/Query caches with controllable service responses.
test('playlist mutations wait for refreshed membership and update cached playlist videos', async ({ page }) => {
  await page.goto('/interactions?playlist=normal')
  await openPicker(page)
  const row = page.getByRole('button', { name: '测试列表', exact: true })
  await expect(row).toHaveAttribute('aria-pressed', 'false')
  await row.click()
  await expect(row).toBeDisabled()
  await page.waitForFunction(() => !!window.interactions.release)
  await page.evaluate(() => {
    const state = window.interactions
    state.holdPlaylist = true
    state.release?.()
  })
  await page.waitForFunction(() => !!window.interactions.releasePlaylist)
  await expect(row).toBeDisabled()
  await expect(page.getByTestId('playlist-videos')).toHaveText('1')
  await page.evaluate(() => {
    const state = window.interactions
    state.holdPlaylist = false
    state.releasePlaylist?.()
    state.release = null
  })
  await expect(row).toBeEnabled()
  await expect(row).toHaveAttribute('aria-pressed', 'true')
  await row.click()
  await page.waitForFunction(() => !!window.interactions.release)
  await page.evaluate(() => window.interactions.release?.())
  await expect(row).toBeEnabled()
  await expect(row).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('playlist-videos')).toHaveText('0')
  await page.keyboard.press('Escape')
  await openPicker(page)
  await expect(row).toBeEnabled()
})

test('empty lists offer creation and newly created lists appear on reopening', async ({ page }) => {
  await page.goto('/interactions?playlist=empty')
  await openPicker(page)
  await expect(page.getByText('还没有播放列表，请先创建一个')).toBeVisible()
  await expect(page.getByRole('link', { name: '创建播放列表' })).toHaveAttribute('href', '/playlists')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '新建', exact: true }).click()
  await page.getByPlaceholder('请输入标题').fill('测试列表')
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await openPicker(page)
  await expect(page.getByRole('button', { name: '测试列表' })).toBeVisible()
})

test('read errors can be retried and failed additions preserve membership', async ({ page }) => {
  await page.goto('/interactions?playlist=fail')
  await openPicker(page)
  await expect(page.getByRole('alert')).toHaveText('播放列表加载失败，请重试重试')
  await page.evaluate(() => {
    window.interactions.playlistFail = false
  })
  await page.getByRole('button', { name: '重试', exact: true }).click()
  const row = page.getByRole('button', { name: '测试列表' })
  await row.click()
  await page.waitForFunction(() => !!window.interactions.release)
  await page.evaluate(() => {
    const state = window.interactions
    state.fail = true
    state.release?.()
  })
  await expect(row).toBeEnabled()
  await expect(row).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('playlist-videos')).toHaveText('0')
})

test('signed-out visitors see a sign-in action without requesting private playlists', async ({ page }) => {
  await page.goto('/interactions?playlist=normal&sidebar=guest')
  await openPicker(page)
  await expect(page.getByRole('button', { name: '登录后加入播放列表' })).toBeVisible()
  expect(await page.evaluate(() => window.interactions.playlistReads)).toBe(0)
})

for (const fail of [false, true]) {
  test(`reopening the picker after ${fail ? 'failed' : 'successful'} playlist deletion shows current lists`, async ({ page }) => {
    await page.goto('/interactions?playlist=normal')
    await openPicker(page)
    await expect(page.getByRole('button', { name: '测试列表' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.evaluate(fail => {
      window.interactions.fail = fail
    }, fail)
    const deleteButton = page.getByTestId('playlist-header').getByRole('button')
    await deleteButton.click()
    await page.getByRole('button', { name: '确认', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(deleteButton).toBeEnabled()
    await openPicker(page)
    if (fail) {
      await expect(page.getByRole('button', { name: '测试列表' })).toBeVisible()
    } else {
      await expect(page.getByText('还没有播放列表，请先创建一个')).toBeVisible()
      await expect(page.getByRole('button', { name: '测试列表' })).toHaveCount(0)
    }
  })
}
