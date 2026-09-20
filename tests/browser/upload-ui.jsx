import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'

import StudioUploadModal from '../../src/modules/studio/ui/components/studio-upload-modal'

window.uploadTest = { deleted: 0, aborted: 0, navigated: [], fail: false }
export const trpc = {
  useUtils: () => ({ studio: { getMany: { invalidate() {} } } }),
  videos: {
    create: {
      useMutation: options => {
        const [data, setData] = useState()
        return {
          data,
          isPending: false,
          reset: () => setData(undefined),
          mutate: () => {
            setData({ video: { id: 'video' }, url: 'https://upload.invalid' })
            options.onSuccess()
          },
        }
      },
    },
    remove: {
      useMutation: options => {
        const [isPending, setPending] = useState(false)
        return {
          isPending,
          reset() {},
          mutate: () => {
            window.uploadTest.deleted++
            setPending(true)
            setTimeout(() => {
              setPending(false)
              if (window.uploadTest.fail) options.onError()
              else options.onSuccess()
            }, 10)
          },
        }
      },
    },
  },
}
createRoot(document.getElementById('root')).render(<StudioUploadModal />)
