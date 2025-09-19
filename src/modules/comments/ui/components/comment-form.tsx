import { useClerk } from '@clerk/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { commentsInsertSchema } from '@/db/schema'
import { UserAvatar } from '@/modules/studio/ui/components/user-avatar'
import { trpc } from '@/trpc/client'

interface CommentFormProps {
  videoId: string
  parentId?: string
  onSuccess?: () => void
  onCancel?: () => void
  variant?: 'comment' | 'reply'
}

export const CommentForm = ({ videoId, onSuccess, onCancel, parentId, variant = 'comment' }: CommentFormProps) => {
  const { user } = useClerk()

  const utils = trpc.useUtils()
  const clerk = useClerk()
  const create = trpc.comments.create.useMutation({
    onSuccess: () => {
      utils.comments.getMany.invalidate({ videoId })
      utils.comments.getMany.invalidate({ videoId, parentId })

      form.reset()
      toast.success('评论成功')
      onSuccess?.()
    },
    onError: err => {
      toast.error('出错了')
      if (err.data?.code === 'UNAUTHORIZED') {
        clerk.openSignIn()
      }
    },
  })

  const commentFormSchema = commentsInsertSchema.omit({ userId: true })

  const form = useForm<z.infer<typeof commentFormSchema>>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: {
      videoId,
      parentId,
      value: '',
    },
  })

  const value = form.watch('value')

  const handleSubmit = (values: z.infer<typeof commentFormSchema>) => {
    create.mutate(values)
  }

  const handleCancel = () => {
    form.reset()
    onCancel?.()
  }

  return (
    <Form {...form}>
      <form className="group flex gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
        <UserAvatar
          imageUrl={user?.imageUrl || '/user-placeholder.svg'}
          name={user?.fullName || '用户'}
          size={variant === 'comment' ? 'lg' : 'sm'}
        />
        <div className="flex-1">
          <FormField
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder={variant === 'reply' ? '恶语伤人，请善意回复' : '留下你的友善评论吧'}
                    className="min-h-16 resize-none overflow-hidden bg-transparent"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-2 flex justify-end gap-2">
            {onCancel && (
              <Button variant="ghost" type="button" onClick={handleCancel}>
                取消
              </Button>
            )}
            <Button type="submit" size="sm" disabled={create.isPending || !value?.trim()}>
              {variant === 'reply' ? '回复' : '评论'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
