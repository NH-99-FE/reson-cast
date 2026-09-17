import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'

interface ThumbnailGenerateModalProps {
  generating: boolean
  onGenerate: (prompt: string) => Promise<boolean>
  open: boolean
  onOpenChange: (open: boolean) => void
}

const formSchema = z.object({
  prompt: z.string().trim().min(10, '请至少输入10个字符').max(2000, '提示词最多2000个字符'),
})

export const ThumbnailGenerateModal = ({ generating, onGenerate, onOpenChange, open }: ThumbnailGenerateModalProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: '',
    },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (await onGenerate(values.prompt)) {
      onOpenChange(false)
      form.reset()
    }
  }
  return (
    <ResponsiveModal open={open} title="AI生成封面" onOpenChange={onOpenChange}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            control={form.control}
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
            <Button type="submit" color="primary" disabled={generating}>
              生成
            </Button>
          </div>
        </form>
      </Form>
    </ResponsiveModal>
  )
}
