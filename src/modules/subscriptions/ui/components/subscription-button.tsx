import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ButtonProps = React.ComponentProps<typeof Button>

interface SubscriptionButtonProps {
  onClick: ButtonProps['onClick']
  disabled: boolean
  isSubscribed: boolean
  className?: string
  size?: ButtonProps['size']
}

export const SubscriptionButton = ({ onClick, disabled, isSubscribed, className, size }: SubscriptionButtonProps) => {
  return (
    <Button
      size={size}
      variant={isSubscribed ? 'secondary' : 'default'}
      className={cn('rounded-full', className)}
      onClick={onClick}
      disabled={disabled}
    >
      {isSubscribed ? '已关注' : '关注'}
    </Button>
  )
}
