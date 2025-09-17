import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { trpc } from '@/trpc/client'

interface PlaylistCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const formSchema = z.object({
  name: z.string().min(1).max(15),
})

export const PlaylistCreateModal = ({ onOpenChange, open }: PlaylistCreateModalProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
    },
  })

  const utils = trpc.useUtils()

  const create = trpc.playlists.create.useMutation({
    onSuccess: () => {
      utils.playlists.getMany.invalidate()
      toast.success('创建成功')
      onOpenChange(false)
      form.reset()
    },
    onError: () => {
      toast.error('创建失败')
    },
  })

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    create.mutate(values)
  }
  return (
    <ResponsiveModal open={open} title="新建播放列表" onOpenChange={onOpenChange}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>标题</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="请输入标题" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Button type="submit" variant="outline" className="rounded-full" disabled={create.isPending}>
              创建
            </Button>
          </div>
        </form>
      </Form>
    </ResponsiveModal>
  )
}
