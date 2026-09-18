import { createRoot } from 'react-dom/client'

import { StudioRealtimeIndicator, StudioRealtimeProvider } from '../../src/modules/studio/ui/components/studio-realtime-provider'
import { FormSection } from '../../src/modules/studio/ui/sections/form-section'
import { VideosSection } from '../../src/modules/studio/ui/sections/videos-section'
import { state, TestProvider, videoId } from './generation-client'
import { connections } from './realtime-ably'

window.fetch = async () => Response.json({ clientId: state.account, token: 'test-jwt', issued: Date.now(), expires: Date.now() + 600000 })
const root = createRoot(document.getElementById('root'))
let serial = 0
const show = (list = false) =>
  root.render(
    <TestProvider key={`${state.account}:${serial++}`}>
      <StudioRealtimeProvider>
        <header>
          工作空间
          <StudioRealtimeIndicator />
        </header>
        {list ? <VideosSection /> : <FormSection videoId={videoId} />}
      </StudioRealtimeProvider>
    </TestProvider>
  )
window.realtimeTest = {
  state,
  connections,
  show,
  leave: () => root.render(<p>Left</p>),
  send: (type = 'video.changed', kind = null, id = crypto.randomUUID()) => {
    const event = { id, videoId, type, kind, version: 1, jobId: kind ? crypto.randomUUID() : null }
    connections.at(-1).send(event)
    return event
  },
}
show()
