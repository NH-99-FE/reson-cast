import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'

interface ResponsiveModalProps {
  children: React.ReactNode
  open: boolean
  title: string
  onOpenChange?: (open: boolean) => void
  variant?: 'responsive' | 'dialog'
  preventOutsideClose?: boolean
  onEscapeKeyDown?: (event: KeyboardEvent) => void
}

export const ResponsiveModal = ({
  children,
  onOpenChange,
  open,
  title,
  preventOutsideClose,
  onEscapeKeyDown,
  variant = 'responsive',
}: ResponsiveModalProps) => {
  const IsMobile = useIsMobile()
  if (IsMobile && variant !== 'dialog') {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          onInteractOutside={event => {
            if (preventOutsideClose) event.preventDefault()
          }}
          onEscapeKeyDown={onEscapeKeyDown}
        >
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          {children}
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={event => {
          if (preventOutsideClose) event.preventDefault()
        }}
        onEscapeKeyDown={onEscapeKeyDown}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
