import type { ReactNode } from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet'
import { cn } from '../../lib/utils'

interface MobileBottomSheetProps {
  trigger: ReactNode
  triggerLabel?: string
  triggerClassName?: string
  title: string
  children: ReactNode
  footer?: ReactNode
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  hasBackdrop?: boolean
  height?: 'full' | 'half' | 'auto'
  showCloseButton?: boolean
}

export function MobileBottomSheet({
  trigger,
  triggerLabel,
  triggerClassName,
  title,
  children,
  footer,
  isOpen,
  onOpenChange,
  hasBackdrop = true,
  height = 'auto',
  showCloseButton = true,
}: MobileBottomSheetProps) {
  const isHalf = height === 'half'

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger
        aria-label={triggerLabel}
        className={cn('min-h-11 rounded-2xl', triggerClassName)}
      >
        {trigger}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        hasOverlay={hasBackdrop}
        showCloseButton={showCloseButton}
        className={cn(
          'mybook-bottom-sheet min-h-0 rounded-t-3xl p-0 shadow-2xl',
          isHalf ? 'max-h-[50dvh] h-[50dvh]' : 'min-h-auto max-h-[90dvh]',
          !hasBackdrop && 'border-t border-[var(--app-border)] bg-[var(--app-surface)] shadow-[0_-12px_32px_rgba(0,0,0,0.15)]'
        )}
      >
        <SheetHeader className="min-h-0 px-6 pb-0 pt-4">
          <SheetTitle className="sr-only">{title}</SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
        </SheetHeader>
        <div
          className={cn(
            'overflow-y-auto overscroll-contain px-6 pt-0 text-base leading-7',
            isHalf ? 'max-h-[calc(50dvh-4rem)]' : 'max-h-[calc(90dvh-4rem)]',
            footer ? 'pb-3' : 'pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]',
          )}
        >
          {children}
        </div>
        {footer ? (
          <SheetFooter className="px-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2">
            {footer}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
