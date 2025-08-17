'use client'

import { Loader2Icon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { trpc } from '@/trpc/client'

const StudioUploadModal = () => {
  const utils = trpc.useUtils()
  const create = trpc.videos.create.useMutation({
    onSuccess: () => {
      toast.success('创建成功')
      utils.studio.getMany.invalidate()
    },
  })
  return (
    <Button variant="secondary" onClick={() => create.mutate()} disabled={create.isPending}>
      {create.isPending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
      创建
    </Button>
  )
}

export default StudioUploadModal
