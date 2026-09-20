import { expect, test } from '@playwright/test'

const pageErrors = new WeakMap<import('@playwright/test').Page, string[]>()
test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([])
})

// Requests stay unresolved until the test explicitly releases them.
const release = async (page: import('@playwright/test').Page, fail = false) => {
  await page.waitForFunction(() => !!window.interactions.release)
  await page.evaluate(fail => {
    const state = window.interactions
    state.fail = fail
    state.release?.()
    state.release = null
  }, fail)
}
test('reactions update before the server responds, switch exclusively, and roll back failures', async ({ page }) => {
  await page.goto('/interactions')
  const like = page.getByRole('button', { name: '点赞', exact: true })
  const dislike = page.getByRole('button', { name: '不喜欢', exact: true })
  await like.click()
  await expect(like).toHaveText('11')
  await expect(like).toHaveAttribute('aria-pressed', 'true')
  await expect(dislike).toBeDisabled()
  await release(page)
  await expect(like).toBeEnabled()
  await dislike.click()
  await expect(like).toHaveText('10')
  await expect(dislike).toHaveText('3')
  await release(page, true)
  await expect(dislike).toBeEnabled()
  await expect(like).toHaveText('11')
  await expect(dislike).toHaveText('2')
  await expect(like).toHaveAttribute('aria-pressed', 'true')
  await like.click()
  await expect(like).toHaveText('10')
  await release(page)
  await expect(like).toBeEnabled()
  await expect(like).toHaveAttribute('aria-pressed', 'false')
})
test('subscription label and count update immediately and restore on failed unsubscribe', async ({ page }) => {
  await page.goto('/interactions')
  await page.getByRole('button', { name: '关注', exact: true }).click()
  await expect(page.getByRole('button', { name: '已关注', exact: true })).toBeDisabled()
  await expect(page.getByTestId('subscribers')).toHaveText('6')
  await release(page)
  await expect(page.getByRole('button', { name: '已关注', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '已关注', exact: true }).click()
  await expect(page.getByRole('button', { name: '关注', exact: true })).toBeDisabled()
  await expect(page.getByTestId('subscribers')).toHaveText('5')
  await release(page, true)
  await expect(page.getByRole('button', { name: '已关注', exact: true })).toBeEnabled()
  await expect(page.getByTestId('subscribers')).toHaveText('6')
})

test('concurrent comment reactions preserve other optimistic updates and reconcile after failure', async ({ page }) => {
  await page.goto('/interactions')
  const first = page.getByTestId('first').getByRole('button', { name: '点赞评论', exact: true })
  const second = page.getByTestId('second').getByRole('button', { name: '点赞评论', exact: true })
  await first.click()
  await second.click()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await page.waitForFunction(() => !!window.interactions.pendingComments.first && !!window.interactions.pendingComments.second)
  await page.evaluate(() => window.interactions.pendingComments.first(true))
  await expect(first).toBeEnabled()
  await expect(first).toHaveAttribute('aria-pressed', 'false')
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await page.evaluate(() => window.interactions.pendingComments.second(false))
  await expect(second).toBeEnabled()
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await expect(first).toHaveAttribute('aria-pressed', 'false')
})

test('a failed video reaction does not overwrite a concurrent subscription', async ({ page }) => {
  await page.goto('/interactions')
  const like = page.getByRole('button', { name: '点赞', exact: true })
  await like.click()
  await page.getByRole('button', { name: '关注', exact: true }).click()
  await expect(like).toHaveText('11')
  await expect(page.getByTestId('subscribers')).toHaveText('6')
  await page.waitForFunction(
    () => !!window.interactions.pendingWrites['videoReactions.like'] && !!window.interactions.pendingWrites['subscriptions.create']
  )
  await page.evaluate(() => {
    window.interactions.fail = true
    window.interactions.pendingWrites['videoReactions.like']()
  })
  await expect(like).toBeEnabled()
  await expect(like).toHaveText('10')
  await expect(page.getByRole('button', { name: '已关注', exact: true })).toBeDisabled()
  await expect(page.getByTestId('subscribers')).toHaveText('6')
  await page.evaluate(() => {
    window.interactions.fail = false
    window.interactions.pendingWrites['subscriptions.create']()
  })
  await expect(page.getByRole('button', { name: '已关注', exact: true })).toBeEnabled()
  await expect(page.getByTestId('subscribers')).toHaveText('6')
  await expect(like).toHaveText('10')
})

const sidebar = (page: import('@playwright/test').Page) => page.locator('[aria-label="订阅"]')
const sidebarAuthors = (page: import('@playwright/test').Page) => sidebar(page).locator('a[href^="/users/"]')

test('sidebar keeps its all-subscriptions link and stable rows while the first request is pending', async ({ page }) => {
  await page.goto('/interactions?sidebar=slow')
  await expect(sidebar(page).getByRole('link', { name: '查看全部订阅' })).toBeVisible()
  await expect(sidebar(page).locator('[aria-busy="true"]')).toHaveCount(1)
  await expect(sidebar(page).locator('[data-slot="skeleton"]')).toHaveCount(10)
  const before = await sidebar(page).getByRole('link', { name: '查看全部订阅' }).boundingBox()
  await page.waitForFunction(() => !!window.interactions.releaseSidebar)
  await page.evaluate(() => {
    window.interactions.holdSidebar = false
    window.interactions.releaseSidebar?.()
  })
  await expect(sidebarAuthors(page)).toHaveCount(5)
  const after = await sidebar(page).getByRole('link', { name: '查看全部订阅' }).boundingBox()
  expect(after?.y).toBe(before?.y)
  await expect(sidebar(page).locator('[data-slot="skeleton"]')).toHaveCount(0)
})

test('initial failure allows retry and navigation; background failure preserves the cached authors', async ({ page }) => {
  await page.goto('/interactions?sidebar=fail')
  const retry = sidebar(page).getByRole('button', { name: '暂时无法加载 · 重试' })
  await expect(retry).toBeVisible()
  await expect(sidebar(page).getByRole('link', { name: '查看全部订阅' })).toBeVisible()
  await page.evaluate(() => {
    window.interactions.sidebarFail = false
  })
  await retry.click()
  await expect(sidebarAuthors(page)).toHaveCount(5)
  const authors = await sidebarAuthors(page).allTextContents()
  const reads = await page.evaluate(() => {
    window.interactions.sidebarFail = true
    return window.interactions.sidebarReads
  })
  await page.getByRole('button', { name: '刷新侧栏' }).click()
  await page.waitForFunction(reads => window.interactions.sidebarReads >= reads + 2, reads)
  await expect(sidebarAuthors(page)).toHaveText(authors)
  await expect(retry).toHaveCount(0)
  await expect(sidebar(page).locator('[data-slot="skeleton"]')).toHaveCount(0)
})

test('empty subscriptions explain the feature; signed-out visitors make no sidebar request', async ({ page }) => {
  await page.goto('/interactions?sidebar=empty')
  await expect(sidebar(page).getByText('订阅后，可在这里快速找到创作者')).toBeVisible()
  await expect(sidebar(page).getByRole('link', { name: '查看全部订阅' })).toBeVisible()
  await page.goto('/interactions?sidebar=guest')
  await expect(page.getByRole('button', { name: '关注', exact: true })).toBeVisible()
  await expect(sidebar(page)).toHaveCount(0)
  expect(await page.evaluate(() => window.interactions.sidebarReads)).toBe(0)
})

test('subscription changes update the sidebar immediately and restore its ordering after failure', async ({ page }) => {
  await page.goto('/interactions')
  await expect(sidebarAuthors(page)).toHaveCount(5)
  const original = await sidebarAuthors(page).allTextContents()
  await page.getByRole('button', { name: '关注', exact: true }).click()
  await expect(sidebarAuthors(page).first()).toHaveText('新订阅作者')
  await expect(sidebarAuthors(page)).toHaveCount(5)
  await release(page, true)
  await expect(page.getByRole('button', { name: '关注', exact: true })).toBeEnabled()
  await expect(sidebarAuthors(page)).toHaveText(original)
  await page.getByRole('button', { name: '关注', exact: true }).click()
  await release(page)
  await expect(page.getByRole('button', { name: '已关注', exact: true })).toBeEnabled()
  await expect(sidebarAuthors(page).first()).toHaveText('新订阅作者')
  await page.getByRole('button', { name: '已关注', exact: true }).click()
  await expect(sidebar(page).getByRole('link', { name: '新订阅作者', exact: true })).toHaveCount(0)
  await release(page, true)
  await expect(page.getByRole('button', { name: '已关注', exact: true })).toBeEnabled()
  await expect(sidebarAuthors(page).first()).toHaveText('新订阅作者')
})

test('full-list pagination leaves the sidebar at five; concurrent removals roll back independently and refill', async ({ page }) => {
  await page.goto('/interactions?full=1')
  await expect(page.locator('main a[href^="/users/"]')).toHaveCount(8)
  await expect(sidebarAuthors(page)).toHaveCount(5)
  const first = page.locator('main a[href="/users/1"] button')
  const second = page.locator('main a[href="/users/2"] button')
  await first.click()
  await second.click()
  await expect(sidebar(page).locator('a[href="/users/1"]')).toHaveCount(0)
  await expect(sidebar(page).locator('a[href="/users/2"]')).toHaveCount(0)
  await page.waitForFunction(
    () => !!window.interactions.pendingWrites['subscriptions.remove:1'] && !!window.interactions.pendingWrites['subscriptions.remove:2']
  )
  await page.evaluate(() => {
    window.interactions.fail = true
    window.interactions.pendingWrites['subscriptions.remove:1']()
  })
  await expect(first).toBeEnabled()
  await expect(sidebar(page).locator('a[href="/users/1"]')).toHaveCount(1)
  await expect(sidebar(page).locator('a[href="/users/2"]')).toHaveCount(0)
  await page.evaluate(() => {
    window.interactions.fail = false
    window.interactions.pendingWrites['subscriptions.remove:2']()
  })
  await expect(page.locator('main a[href="/users/2"]')).toHaveCount(0)
  await expect(sidebarAuthors(page)).toHaveText(['订阅作者 1', '订阅作者 3', '订阅作者 4', '订阅作者 5', '订阅作者 6'])
})

test('hydrated sidebar renders without a client request or skeleton', async ({ page }, testInfo) => {
  await page.goto('/interactions?sidebar=hydrated')
  await expect(sidebarAuthors(page)).toHaveCount(5)
  await expect(sidebar(page).locator('[data-slot="skeleton"]')).toHaveCount(0)
  expect(await page.evaluate(() => window.interactions.sidebarReads)).toBe(0)
  await sidebar(page).screenshot({ path: testInfo.outputPath('subscriptions-populated.png') })
})

test('a successful subscription remains visible even if its background reconciliation fails', async ({ page }) => {
  await page.goto('/interactions')
  await expect(sidebarAuthors(page)).toHaveCount(5)
  await page.evaluate(() => {
    window.interactions.sidebarFail = true
  })
  await page.getByRole('button', { name: '关注', exact: true }).click()
  await release(page)
  await expect(page.getByRole('button', { name: '已关注', exact: true })).toBeEnabled()
  await expect(sidebarAuthors(page).first()).toHaveText('新订阅作者')
  await expect(sidebarAuthors(page)).toHaveCount(5)
  await expect(sidebar(page).getByRole('button', { name: '暂时无法加载 · 重试' })).toHaveCount(0)
})

for (const initialState of ['fail', 'slow']) {
  test(`a successful subscription seeds an uncached sidebar after an initial ${initialState} request`, async ({ page }) => {
    await page.goto(`/interactions?sidebar=${initialState}`)
    if (initialState === 'fail') {
      await expect(sidebar(page).getByRole('button', { name: '暂时无法加载 · 重试' })).toBeVisible()
    } else {
      await page.waitForFunction(() => !!window.interactions.releaseSidebar)
      await expect(sidebar(page).locator('[aria-busy="true"]')).toHaveCount(1)
    }
    await page.evaluate(() => {
      window.interactions.holdSidebar = false
      window.interactions.sidebarFail = true
    })
    await expect(sidebarAuthors(page)).toHaveCount(0)
    await page.getByRole('button', { name: '关注', exact: true }).click()
    await expect(sidebarAuthors(page)).toHaveText(['新订阅作者'])
    await release(page)
    await expect(page.getByRole('button', { name: '已关注', exact: true })).toBeEnabled()
    await expect(sidebarAuthors(page)).toHaveText(['新订阅作者'])
    await expect(sidebar(page).getByRole('button', { name: '暂时无法加载 · 重试' })).toHaveCount(0)
    await expect(sidebar(page).getByRole('link', { name: '查看全部订阅' })).toBeVisible()
    // The confirmed author is retained, but a later successful refresh still fills the list.
    await page.evaluate(() => {
      window.interactions.sidebarFail = false
      window.interactions.releaseSidebar?.()
    })
    await page.getByRole('button', { name: '刷新侧栏' }).click()
    await expect(sidebarAuthors(page)).toHaveText(['新订阅作者', '订阅作者 1', '订阅作者 2', '订阅作者 3', '订阅作者 4'])
  })
}

test('a failed subscription never seeds an uncached sidebar', async ({ page }) => {
  await page.goto('/interactions?sidebar=fail')
  await expect(sidebar(page).getByRole('button', { name: '暂时无法加载 · 重试' })).toBeVisible()
  await page.getByRole('button', { name: '关注', exact: true }).click()
  await expect(sidebarAuthors(page)).toHaveText(['新订阅作者'])
  await release(page, true)
  await expect(page.getByRole('button', { name: '关注', exact: true })).toBeEnabled()
  await expect(sidebarAuthors(page)).toHaveCount(0)
  await expect(sidebar(page).getByRole('button', { name: '暂时无法加载 · 重试' })).toBeVisible()
  await expect(sidebar(page).getByText('订阅后，可在这里快速找到创作者')).toHaveCount(0)
})
