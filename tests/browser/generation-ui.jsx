import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'

import { cardThumbnailSource, publicMuxThumbnailPath, publicThumbnailPath } from '../../src/lib/video-image-source'
import { StudioRealtimeProvider } from '../../src/modules/studio/ui/components/studio-realtime-provider'
import { FormSection as StudioFormSection } from '../../src/modules/studio/ui/sections/form-section'
import { VideosSection as StudioVideosSection } from '../../src/modules/studio/ui/sections/videos-section'
import { delay, state, TestProvider, videoId } from './generation-client'
import { connections } from './realtime-ably'

window.fetch = async () =>
  Response.json({ clientId: state.account, keyName: 'key', ttl: 600000, nonce: 'nonce', timestamp: Date.now(), mac: 'mac' })
const FormSection = props => (
  <StudioRealtimeProvider>
    <StudioFormSection {...props} />
  </StudioRealtimeProvider>
)
const VideosSection = () => (
  <StudioRealtimeProvider>
    <StudioVideosSection />
  </StudioRealtimeProvider>
)
const send = (type, kind = null) =>
  connections.at(-1).send({
    id: crypto.randomUUID(),
    videoId,
    type,
    kind,
    version: 1,
    jobId: kind ? latestRun(kind).id : null,
  })

const nativeTimeout = window.setTimeout
let shortenDeadline = false
window.setTimeout = (fn, ms, ...args) => nativeTimeout(fn, shortenDeadline && ms > 290000 ? 100 : ms, ...args)
const report = document.getElementById('report')
const root = createRoot(document.getElementById('root'))
const results = []
const check = (ok, message) => {
  if (!ok) throw new Error(message)
}
const wait = async fn => {
  for (let i = 0; i < 400; i++) {
    if (fn()) return
    await delay(25)
  }
  throw new Error('Timed out: ' + fn.toString())
}
const title = () => document.querySelector('input[name="title"]')
const desc = () => document.querySelector('textarea[name="description"]')
const button = label =>
  [...document.querySelectorAll('[data-slot=popover-content] button'), ...document.querySelectorAll('button')].find(
    el =>
      el.textContent.trim() === label ||
      el.getAttribute('aria-label') === label ||
      (label.startsWith('AI 生成') && el.getAttribute('aria-label') === `${label.slice(5)}生成需要处理`)
  )
const openRecovery = async (label, field = '标题') => {
  await wait(() => button(`${field}生成需要处理`))
  button(`${field}生成需要处理`).click()
  await wait(() => button(label))
}
const edit = (el, value) => {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
let mount = 0
async function show() {
  root.render(
    <TestProvider key={`${state.account}:${++mount}`}>
      <FormSection videoId={videoId} />
    </TestProvider>
  )
  await wait(() => title() && !title().disabled && !button('AI 生成标题')?.disabled)
}
async function leave() {
  root.render(<p>Left page</p>)
  await wait(() => !title())
}
const latestRun = kind =>
  Object.values(state.runs)
    .filter(run => run.kind === kind)
    .at(-1)
async function complete(kind, status = 'completed', value = `AI ${kind}`) {
  state.video[kind] = value
  latestRun(kind).status = status
  send('generation.changed', kind)
  await wait(() => !(kind === 'title' ? title() : desc()).disabled)
}
const test = async (name, fn) => {
  await fn()
  results.push(name)
  report.textContent = results.map(name => 'PASS: ' + name).join('\n')
}

async function run() {
  sessionStorage.clear()
  await show()
  await test('opening a video without generation jobs stays idle and does not poll', async () => {
    await wait(() => !button('AI 生成标题').disabled && !button('AI 生成简介').disabled)
    check(!button('AI 生成标题').querySelector('.animate-spin'), 'idle title shows a spinner')
    const polls = state.polls
    await delay(2700)
    check(state.polls === polls, 'idle video keeps polling')
  })
  await test('initial status failure stops spinners and can be retried', async () => {
    await leave()
    state.failPolls = true
    root.render(
      <TestProvider key={`status-error:${++mount}`}>
        <FormSection videoId={videoId} />
      </TestProvider>
    )
    await openRecovery('重试查询')
    check(!button('AI 生成标题').querySelector('.animate-spin'), 'failed title query spins forever')
    check(!button('AI 生成简介').querySelector('.animate-spin'), 'failed description query spins forever')
    check(!title().disabled && !desc().disabled, 'status failure blocks normal editing')
    check(button('标题生成需要处理') && button('简介生成需要处理'), 'unknown status must show recovery icons')
    edit(title(), 'Saved while status unavailable')
    await wait(() => !button('保存').disabled)
    button('保存').click()
    await wait(() => state.video.title === 'Saved while status unavailable' && button('保存').disabled)
    check(button('标题生成需要处理'), 'failed background query must retain recovery icon after saving')
    state.failPolls = false
    button('重试查询').click()
    await wait(() => !button('标题生成需要处理') && !document.querySelector('[data-slot=popover-content]'))
    await openRecovery('重试查询', '简介')
    button('重试查询').click()
    await wait(() => !button('标题生成需要处理') && !button('简介生成需要处理'))
    await wait(() => !button('AI 生成标题').disabled && !button('AI 生成简介').disabled)
  })
  await test('dirty target blocks generation; saving sets a clean baseline', async () => {
    edit(title(), 'Saved user title')
    await wait(() => button('AI 生成标题').disabled && !button('保存').disabled)
    button('保存').click()
    await wait(() => !button('AI 生成标题').disabled)
    check(button('保存').disabled, 'save should become clean')
    check(state.writes.at(-1).title === 'Saved user title' && Object.keys(state.writes.at(-1)).length === 2, 'partial save required')
  })
  await test('healthy queued title and description keep loading until running', async () => {
    state.dispatchQueued = true
    for (const [kind, label] of [
      ['title', '标题'],
      ['description', '简介'],
    ]) {
      button(`AI 生成${label}`).click()
      await wait(() => latestRun(kind)?.status === 'queued')
      await delay(100)
      check(!button(`${label}生成需要处理`), 'healthy queued task shows recovery icon')
      check(button(`AI 生成${label}`).querySelector('.animate-spin'), 'healthy queued task must keep spinning')
      latestRun(kind).status = 'running'
      send('generation.changed', kind)
      await delay(100)
      check(!button(`${label}生成需要处理`), 'running task shows recovery icon')
      check(button(`AI 生成${label}`).querySelector('.animate-spin'), 'running task must keep spinning')
      await complete(kind)
    }
    state.dispatchQueued = false
  })
  await test('generated field locks; completion preserves other unsaved edits', async () => {
    button('AI 生成标题').click()
    await wait(() => title().disabled && latestRun('title'))
    edit(desc(), 'Unsaved description')
    await complete('title')
    check(title().value === 'AI title', 'title not synchronized')
    check(desc().value === 'Unsaved description', 'other edits lost')
    button('保存').click()
    await wait(() => button('保存').disabled)
    check(!('title' in state.writes.at(-1)), 'saved generation incorrectly remains dirty')
  })
  await test('returning to a completed task synchronizes silently without generating or polling', async () => {
    const notifications = toast.getHistory().length
    const jobs = Object.keys(state.runs).length
    await leave()
    await show()
    check(title().value === state.video.title, 'historical completion lost saved content')
    check(toast.getHistory().length === notifications, 'historical task emitted a new notification')
    check(Object.keys(state.runs).length === jobs, 'restoring history created another task')
    const polls = state.polls
    await delay(2700)
    check(state.polls === polls, 'completed history keeps polling')
  })
  await test('edits during a save survive and remain dirty against the saved baseline', async () => {
    state.saveDelay = 150
    edit(desc(), 'First edit')
    await wait(() => !button('保存').disabled)
    button('保存').click()
    await delay(30)
    edit(desc(), 'Later edit')
    await wait(() => state.video.description === 'First edit' && !button('保存').disabled)
    check(desc().value === 'Later edit', 'in-flight edit lost')
    state.saveDelay = 0
    button('保存').click()
    await wait(() => button('保存').disabled)
  })
  await test('parallel title and description generation settle independently', async () => {
    button('AI 生成标题').click()
    button('AI 生成简介').click()
    await wait(() => title().disabled && desc().disabled && latestRun('description'))
    document.querySelector('[role=combobox]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await wait(() => document.querySelector('[role=option]'))
    document.querySelector('[role=option]').click()
    await wait(() => !button('保存').disabled)
    button('保存').click()
    await wait(() => button('保存').disabled)
    check(Object.keys(state.writes.at(-1)).sort().join(',') === 'categoryId,id', 'category save included generating fields')
    await complete('title', 'completed', 'Parallel title')
    check(desc().disabled, 'other generation unlocked too early')
    await complete('description', 'completed', 'Parallel description')
    check(button('保存').disabled, 'AI fields should be clean')
  })
  await test('conflict refreshes the externally saved value; synchronization failure is recoverable', async () => {
    button('AI 生成标题').click()
    await wait(() => title().disabled)
    state.failDetails = true
    state.video.title = 'Other page title'
    latestRun('title').status = 'conflict'
    latestRun('title').result = 'Generated suggestion'
    send('generation.changed', 'title')
    await openRecovery('重试同步')
    check(title().disabled, 'sync failure must retain lock')
    check(!button('AI 生成标题').querySelector('.animate-spin'), 'failed synchronization keeps spinning')
    state.failDetails = false
    button('重试同步').click()
    await wait(() => !title().disabled)
    check(title().value === 'Other page title' && button('保存').disabled, 'conflict did not refresh clean value')
    button('采用到编辑框').click()
    await wait(() => title().value === 'Generated suggestion' && !button('保存').disabled)
    check(state.video.title === 'Other page title', 'adoption must not silently save')
    button('保存').click()
    await wait(() => button('保存').disabled)
  })
  await test('leaving stops polling; returning restores a pending task then synchronizes completion', async () => {
    button('AI 生成标题').click()
    await wait(() => title().disabled && latestRun('title').status === 'running')
    await leave()
    sessionStorage.clear()
    const polls = state.polls
    await delay(2700)
    check(state.polls === polls, 'unmounted page still polls')
    root.render(
      <TestProvider key={`restore:${++mount}`}>
        <FormSection videoId={videoId} />
      </TestProvider>
    )
    await wait(() => title()?.disabled && button('AI 生成标题'))
    await complete('title', 'completed', 'Restored result')
    check(title().value === 'Restored result', 'restored result missing')
  })
  await test('timeout keeps the lock and record; manual refresh completes the same task', async () => {
    shortenDeadline = true
    button('AI 生成标题').click()
    await openRecovery('刷新状态')
    check(title().disabled && latestRun('title').status === 'running', 'timeout unlocked or erased server task')
    check(!button('AI 生成标题').querySelector('.animate-spin'), 'paused query keeps spinning')
    const polls = state.polls
    await delay(2700)
    check(state.polls === polls, 'paused task must not poll')
    shortenDeadline = false
    latestRun('title').status = 'completed'
    state.video.title = 'Late result'
    button('刷新状态').click()
    await wait(() => !title().disabled)
    check(title().value === 'Late result', 'resume did not sync')
  })
  await test('account switch isolates pending records and does not poll the previous account', async () => {
    button('AI 生成标题').click()
    await wait(() => title().disabled)
    await leave()
    state.account = 'other'
    await show()
    check(!title().disabled, 'other account restored owner task')
    const polls = state.polls
    await delay(2700)
    check(state.polls === polls, 'other account polled owner task')
    await leave()
    state.account = 'owner'
    latestRun('title').status = 'failed'
    root.render(
      <TestProvider key={`owner:${++mount}`}>
        <FormSection videoId={videoId} />
      </TestProvider>
    )
    await wait(() => title() && !title().disabled)
    check(title().value === state.video.title, 'failed task did not refresh existing value')
  })
  await test('an old status response cannot replace a newly submitted task', async () => {
    state.delayNextStatus = true
    state.delayedStatusStarted = false
    void state.refresh()
    await wait(() => state.delayedStatusStarted)
    await openRecovery('重新生成')
    button('重新生成').click()
    await wait(() => title().disabled && latestRun('title').status === 'running')
    await delay(450)
    check(title().disabled, 'late status response unlocked a running task')
    await complete('title', 'completed', 'Fresh task result')
  })
  await test('failed dispatch retries the same durable job', async () => {
    state.dispatchFails = true
    button('AI 生成标题').click()
    await openRecovery('重新提交')
    const originalId = latestRun('title').id
    state.dispatchFails = false
    button('重新提交').click()
    await wait(() => latestRun('title').status === 'running')
    check(latestRun('title').id === originalId, 'retry created a second task')
    await complete('title', 'completed', 'Retried result')
  })
  await test('event-triggered query failure retains the lock and retries the same task', async () => {
    button('AI 生成标题').click()
    await wait(() => title().disabled && latestRun('title').status === 'running')
    const originalId = latestRun('title').id
    state.failPolls = true
    send('generation.changed', 'title')
    await openRecovery('重试查询')
    check(!button('AI 生成标题').querySelector('.animate-spin'), 'query error keeps spinning')
    check(title().disabled, 'unknown task outcome must retain the field lock')
    const polls = state.polls
    await delay(2700)
    check(state.polls === polls, 'failed status query kept polling')
    state.failPolls = false
    button('重试查询').click()
    await wait(() => !button('标题生成需要处理'))
    check(latestRun('title').id === originalId, 'query retry created another task')
    await complete('title', 'completed', 'Recovered query result')
  })
  await test('old cover cleanup failure has an explicit recovery action', async () => {
    state.pendingCleanup = 1
    await state.refresh()
    await wait(() => button('重试清理'))
    button('重试清理').click()
    await wait(() => !button('重试清理'))
  })
  await test('replacing and restoring the cover reloads the existing image element', async () => {
    for (const key of ['cover-a', 'cover-b', null]) {
      const previous = document.querySelector('img[alt="thumbnail"]')
      state.video.thumbnailKey = key
      state.video.thumbnailUrl = '/mock-cover'
      await state.refresh()
      await wait(() => document.querySelector('img[alt="thumbnail"]') !== previous)
    }
  })
  await test('studio public covers share canonical sources across the form, player and list; private covers retain authentication', async () => {
    const authenticatedUrl = `/api/videos/${videoId}/image/thumbnail?v=current`
    for (const visibility of ['public', 'private']) {
      for (const thumbnailKey of [null, 'cover-a', 'cover-b', null]) {
        Object.assign(state.video, { visibility, thumbnailKey, thumbnailUrl: authenticatedUrl, muxPlaybackId: 'studio-mux' })
        const source =
          visibility === 'public'
            ? thumbnailKey
              ? publicThumbnailPath(videoId, thumbnailKey)
              : publicMuxThumbnailPath(videoId, 'studio-mux')
            : authenticatedUrl
        const poster = visibility === 'public' ? source : `${source}&cover=${encodeURIComponent(thumbnailKey ?? 'mux')}`
        await state.refresh()
        await wait(
          () =>
            document.querySelector('img[alt="thumbnail"]')?.getAttribute('src') === cardThumbnailSource(source) &&
            document.querySelector('[data-testid="mock-player"]')?.dataset.thumbnailUrl === poster
        )
        const image = document.querySelector('img[alt="thumbnail"]')
        check(image.dataset.unoptimized === String(!(visibility === 'public' && thumbnailKey)), 'incorrect studio image optimization')
        check(image.getAttribute('sizes') === '153px', 'editor thumbnail needs its fixed display size')

        root.render(
          <TestProvider key={`cover-list:${++mount}`}>
            <VideosSection />
          </TestProvider>
        )
        await wait(() => document.querySelector('img')?.getAttribute('src') === cardThumbnailSource(source))
        check(
          document.querySelector('img').dataset.unoptimized === String(!(visibility === 'public' && thumbnailKey)),
          'incorrect studio list image optimization'
        )
        await show()
      }
    }
  })
  await test('deletion retry stays event-driven until the item disappears', async () => {
    state.video.deletionRequestedAt = new Date()
    state.video.deletionError = 'failed'
    root.render(
      <TestProvider key={`list:${++mount}`}>
        <VideosSection />
      </TestProvider>
    )
    await wait(() => button('重试删除'))
    const polls = state.listPolls
    await delay(5300)
    check(state.listPolls === polls, 'failed deletion kept polling')
    button('重试删除').click()
    await wait(() => document.body.textContent.includes('正在删除'))
    const resumed = state.listPolls
    await delay(5300)
    check(state.listPolls === resumed, 'pending deletion must not poll')
    state.deleted = true
    send('deletion.changed')
    await wait(() => !document.body.textContent.includes('正在删除'))
  })
  document.body.dataset.result = 'passed'
  report.textContent += '\nALL BROWSER CHECKS PASSED'
}
run().catch(error => {
  document.body.dataset.result = 'failed'
  report.textContent += '\nFAIL: ' + error.stack
  console.error(error)
})
