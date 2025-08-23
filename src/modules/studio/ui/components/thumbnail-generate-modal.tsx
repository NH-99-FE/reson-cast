import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { trpc } from '@/trpc/client'

interface ThumbnailGenerateModalProps {
  videoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const formSchema = z.object({
  prompt: z.string().min(10),
})

export const ThumbnailGenerateModal = ({ videoId, onOpenChange, open }: ThumbnailGenerateModalProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: '',
    },
  })

  // AI生成缩略图
  const generateThumbnail = trpc.videos.generateThumbnail.useMutation({
    onSuccess: () => {
      toast.success('AI开始在后台处理')
      onOpenChange(false)
      form.reset()
    },
    onError: () => {
      toast.error('AI生成失败')
    },
  })

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    generateThumbnail.mutate({
      id: videoId,
      prompt: values.prompt,
    })
  }
  return (
    <ResponsiveModal open={open} title="AI生成封面" onOpenChange={onOpenChange}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            name="prompt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>提示词</FormLabel>
                <FormControl>
                  <Textarea {...field} className="resize-zone min-h-30" cols={30} rows={5} placeholder="请描述你想要的封面" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Button type="submit" color="primary" disabled={generateThumbnail.isPending}>
              生成
            </Button>
          </div>
        </form>
      </Form>
    </ResponsiveModal>
  )
}
