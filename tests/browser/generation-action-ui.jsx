import { useState } from 'react'
import { createRoot } from 'react-dom/client'

import { GenerationAction } from '../../src/modules/studio/ui/components/generation-action'

function RecoveryExample() {
  const [resumed, setResumed] = useState(0)
  return (
    <>
      <button>前一个控件</button>
      <GenerationAction
        label="标题"
        disabled={false}
        disabledReason=""
        task={{
          loading: false,
          locked: true,
          syncing: false,
          paused: true,
          message: '已暂停自动查询',
          retryLabel: '继续查询',
          start: () => {},
          resume: () => setResumed(count => count + 1),
        }}
      />
      <button>后一个控件</button>
      <output aria-label="恢复次数">{resumed}</output>
    </>
  )
}

createRoot(document.getElementById('root')).render(<RecoveryExample />)
