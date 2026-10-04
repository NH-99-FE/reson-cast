import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'

interface ResponsiveModalProps {
  children: React.ReactNode
  open: boolean
  title: string
  description?: string
  dialogClassName?: string
  headerClassName?: string
  descriptionClassName?: string
  onOpenChange?: (open: boolean) => void
  variant?: 'responsive' | 'dialog'
  onInteractOutside?: React.ComponentProps<typeof DialogContent>['onInteractOutside']
  onEscapeKeyDown?: (event: KeyboardEvent) => void
}

export const ResponsiveModal = ({
  children,
  onOpenChange,
  open,
  title,
  description,
  dialogClassName,
  headerClassName,
  descriptionClassName = 'sr-only',
  onInteractOutside,
  onEscapeKeyDown,
  variant = 'responsive',
}: ResponsiveModalProps) => {
  const IsMobile = useIsMobile()
  if (IsMobile && variant !== 'dialog') {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          {...(!description ? { 'aria-describedby': undefined } : {})}
          onInteractOutside={onInteractOutside}
          onEscapeKeyDown={onEscapeKeyDown}
        >
          <DrawerHeader className={headerClassName}>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription className={descriptionClassName}>{description}</DrawerDescription>}
          </DrawerHeader>
          {children}
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={dialogClassName}
        {...(!description ? { 'aria-describedby': undefined } : {})}
        onInteractOutside={onInteractOutside}
        onEscapeKeyDown={onEscapeKeyDown}
      >
        <DialogHeader className={headerClassName}>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription className={descriptionClassName}>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
