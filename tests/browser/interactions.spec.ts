import { expect, test } from '@playwright/test'

declare global {
  interface Window {
    interactions: {
      fail: boolean
      release: (() => void) | null
      writes: number
      pendingComments: Record<string, (fail: boolean) => void>
      pendingWrites: Record<string, () => void>
    }
  }
}

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
