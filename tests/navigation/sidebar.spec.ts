import { expect, test } from '@playwright/test'

test('cold navigation keeps the old page and draft, with feedback only on the latest link', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const blocked = new Set<string>()
  let release!: () => void
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  await page.route('**/*', async route => {
    if (route.request().headers().rsc === '1') {
      blocked.add(new URL(route.request().url()).pathname)
      await gate
    }
    await route.continue()
  })
  await page.goto('/')
  await expect(page.locator('nav')).toHaveAttribute('data-ready', 'true')
  await page.getByRole('textbox', { name: '草稿' }).fill('未提交内容')
  try {
    await page.getByRole('link', { name: '热门', exact: true }).click()
    await expect(page.locator('a[href="/feed/trending"] [data-pending=true]').first()).toHaveCSS('animation-delay', '0.1s')
    await expect(page.getByRole('heading', { name: '原页面内容' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: '草稿' })).toHaveValue('未提交内容')
    await expect(page.getByRole('link', { name: '主页', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect.poll(() => blocked.has('/feed/trending')).toBe(true)
    // Still blocked: feedback follows the latest click without clearing the draft.
    await page.getByRole('link', { name: '历史记录', exact: true }).click()
    await expect(page.locator('a[href="/playlists/history"] [data-pending=true]')).toHaveCount(1)
    await expect(page.locator('a[href="/feed/trending"] [data-pending=true]')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: '草稿' })).toHaveValue('未提交内容')
    await expect.poll(() => blocked.has('/playlists/history')).toBe(true)
  } finally {
    release()
  }
  await expect(page.getByRole('heading', { name: '真实页面：playlists/history' })).toBeVisible()
  await expect(page).toHaveURL('/playlists/history')
  await page.goBack()
  await expect(page.getByRole('heading', { name: '原页面内容' })).toBeVisible()
  expect(errors).toEqual([])
})

test('authentication cancellation and new-tab clicks do not replace the current page', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('nav')).toHaveAttribute('data-ready', 'true')
  await page.getByRole('link', { name: '需要登录' }).click()
  await expect(page.getByRole('heading', { name: '原页面内容' })).toBeVisible()
  await expect(page).toHaveURL('/')
  await page.getByRole('link', { name: '热门', exact: true }).click({ modifiers: ['ControlOrMeta'] })
  await expect(page.getByRole('heading', { name: '原页面内容' })).toBeVisible()
  const popupPromise = page.waitForEvent('popup', { timeout: 5000 })
  await page.getByRole('link', { name: '新标签页', exact: true }).click()
  const popup = await popupPromise
  await expect(page.getByRole('heading', { name: '原页面内容' })).toBeVisible()
  await expect(page.getByRole('link', { name: '主页', exact: true })).toHaveAttribute('aria-current', 'page')
  await popup.close()
})

for (const failure of ['connection-aborted', 'http-503'] as const) {
  test(`failed route request (${failure}) recovers through document navigation and allows another tab`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    let failRequest!: () => void
    const gate = new Promise<void>(resolve => {
      failRequest = resolve
    })
    let failedRequests = 0
    let documentRequests = 0
    // Fail only the RSC request. Next must recover using a real document request;
    // do not mock the router, its pending state, or the successful page response.
    await page.route('**/feed/trending*', async route => {
      const request = route.request()
      if (request.headers().rsc === '1') {
        await gate
        failedRequests++
        if (failure === 'connection-aborted') await route.abort('failed')
        else await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Temporarily unavailable' })
        return
      }
      if (request.isNavigationRequest()) documentRequests++
      await route.continue()
    })

    await page.goto('/')
    await expect(page.locator('nav')).toHaveAttribute('data-ready', 'true')
    try {
      await page.getByRole('link', { name: '热门', exact: true }).click()
      await expect(page.locator('a[href="/feed/trending"] [data-pending=true]').first()).toBeAttached()
      await expect(page.getByRole('link', { name: '主页', exact: true })).toHaveAttribute('aria-current', 'page')
      await expect(page.getByRole('heading', { name: '原页面内容' })).toBeVisible()
    } finally {
      failRequest()
    }

    await expect(page.getByRole('heading', { name: '真实页面：feed/trending' })).toBeVisible()
    await expect(page.locator('nav')).toHaveAttribute('data-ready', 'true')
    await expect(page).toHaveURL('/feed/trending')
    await expect(page.getByRole('status', { name: '正在加载热点' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '热门', exact: true })).toHaveAttribute('aria-current', 'page')
    expect(failedRequests).toBeGreaterThan(0)
    expect(documentRequests).toBeGreaterThan(0)

    await page.getByRole('link', { name: '历史记录', exact: true }).click()
    await expect(page.getByRole('heading', { name: '真实页面：playlists/history' })).toBeVisible()
    await expect(page.getByRole('link', { name: '历史记录', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('link', { name: '热门', exact: true })).not.toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[data-pending=true]')).toHaveCount(0)
    await page.goBack()
    await expect(page.getByRole('heading', { name: '真实页面：feed/trending' })).toBeVisible()
    await expect(page.getByRole('link', { name: '热门', exact: true })).toHaveAttribute('aria-current', 'page')
    expect(errors).toEqual([])
  })
}

test('production prefetch and data loading keep one matching skeleton', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const prefetched = page.waitForResponse(
    response =>
      new URL(response.url()).pathname === '/prefetched' &&
      response.request().headers()['next-router-prefetch'] === '1' &&
      !response.request().headers()['next-router-segment-prefetch']
  )
  await page.goto('/')
  await expect(page.locator('nav')).toHaveAttribute('data-ready', 'true')
  await prefetched
  // Wait for background prefetches to settle, not the preliminary route-tree response.
  await page.waitForLoadState('networkidle')
  let release!: () => void
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  await page.route('**/prefetched*', async route => {
    if (route.request().headers().rsc === '1') await gate
    await route.continue()
  })
  let routeBoxes: unknown
  try {
    await page.getByRole('link', { name: '预取页面', exact: true }).click()
    await expect(page.getByRole('status', { name: '正在加载热点' })).toBeVisible({ timeout: 1000 })
    await expect(page.locator('main [data-slot="skeleton"]')).toHaveCount(90)
    routeBoxes = await page.locator('main [data-slot="skeleton"]').evaluateAll(nodes =>
      nodes.map(node => {
        const { x, y, width, height } = node.getBoundingClientRect()
        return { x, y, width, height }
      })
    )
    await expect(page).toHaveURL('/prefetched')
    await expect(page.getByRole('link', { name: '预取页面', exact: true })).toHaveAttribute('aria-current', 'page')
  } finally {
    release()
  }
  await expect(page.locator('[data-stage="data-loading"]')).toBeVisible()
  await expect(page.getByRole('status', { name: '正在加载热点' })).toHaveCount(0)
  await expect(page.locator('main [data-slot="skeleton"]')).toHaveCount(90)
  const dataBoxes = await page.locator('main [data-slot="skeleton"]').evaluateAll(nodes =>
    nodes.map(node => {
      const { x, y, width, height } = node.getBoundingClientRect()
      return { x, y, width, height }
    })
  )
  expect(dataBoxes).toEqual(routeBoxes)
  await expect(page.getByRole('heading', { name: '预取页面真实内容' })).toBeVisible()
  await expect(page.locator('main [data-slot="skeleton"]')).toHaveCount(0)
  expect(errors).toEqual([])
})

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`author navigation shares the route and data skeleton at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const prefetched = ['creator-1', 'creator-2'].map(id =>
      page.waitForResponse(
        response =>
          new URL(response.url()).pathname === `/users/${id}` &&
          response.request().headers()['next-router-prefetch'] === '1' &&
          !response.request().headers()['next-router-segment-prefetch']
      )
    )
    await page.goto('/')
    await expect(page.locator('nav')).toHaveAttribute('data-ready', 'true')
    await Promise.all(prefetched)
    await page.waitForLoadState('networkidle')
    const skeletons = page.locator('main [data-slot="skeleton"]')
    const boxes = () =>
      skeletons.evaluateAll(nodes =>
        nodes.map(node => {
          const { x, y, width, height } = node.getBoundingClientRect()
          return { x, y, width, height }
        })
      )
    for (const [id, label] of [
      ['creator-1', '订阅作者一'],
      ['creator-2', '订阅作者二'],
    ]) {
      let release!: () => void
      const gate = new Promise<void>(resolve => {
        release = resolve
      })
      const pattern = `**/users/${id}*`
      await page.route(pattern, async route => {
        if (route.request().headers().rsc === '1') await gate
        await route.continue()
      })
      let routeBoxes: unknown
      try {
        await page.getByRole('link', { name: label, exact: true }).click()
        await expect(page.getByRole('status', { name: '正在加载用户主页', exact: true })).toBeVisible({ timeout: 1000 })
        await expect(page.getByRole('status', { name: '正在加载主页', exact: true })).toHaveCount(0)
        await expect(skeletons).toHaveCount(101)
        routeBoxes = await boxes()
        if (id === 'creator-1') await page.screenshot({ path: testInfo.outputPath(`author-loading-${viewport.width}.png`) })
        else await expect(page.getByRole('heading', { name: '作者：creator-1', exact: true })).toHaveCount(0)
      } finally {
        release()
      }
      await expect(page.locator('[data-stage="user-data-loading"]')).toBeVisible()
      await expect(page.getByRole('status', { name: '正在加载用户主页', exact: true })).toHaveCount(0)
      await expect(skeletons).toHaveCount(101)
      expect(await boxes()).toEqual(routeBoxes)
      await expect(page.getByRole('heading', { name: `作者：${id}`, exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: `作者视频：${id}`, exact: true })).toBeVisible()
      await expect(skeletons).toHaveCount(0)
      await expect(page).toHaveURL(`/users/${id}`)
      await page.unroute(pattern)
    }
    expect(errors).toEqual([])
  })
}
