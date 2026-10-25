import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

function useSheetBottomDragToDismiss(enabled: boolean) {
  const popupRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!enabled) return
    const popup = popupRef.current
    if (!popup) return

    let startY: number | null = null
    let currentDeltaY = 0
    let isDragging = false

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return
      const target = e.target as HTMLElement | null
      const isHandle = Boolean(target?.closest('[data-drag-handle]'))
      if (popup.scrollTop <= 0 || isHandle) {
        startY = touch.clientY
        currentDeltaY = 0
        isDragging = true
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || startY === null) return
      const touch = e.touches[0]
      if (!touch) return
      const deltaY = touch.clientY - startY
      if (deltaY > 0 && popup.scrollTop <= 0) {
        currentDeltaY = deltaY
        popup.style.transform = `translateY(${deltaY}px)`
        popup.style.transition = 'none'
        if (e.cancelable) e.preventDefault()
      } else if (deltaY < 0) {
        isDragging = false
        currentDeltaY = 0
        popup.style.transform = ''
      }
    }

    const onTouchEnd = () => {
      if (!isDragging) return
      isDragging = false
      const deltaY = currentDeltaY
      startY = null
      currentDeltaY = 0

      if (deltaY > 75) {
        popup.style.transition = 'transform 150ms ease-out'
        popup.style.transform = 'translateY(100%)'
        setTimeout(() => {
          const closeBtn = popup.querySelector<HTMLElement>('[data-slot="sheet-close"]')
          if (closeBtn) {
            closeBtn.click()
          } else {
            popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
          }
          popup.style.transform = ''
          popup.style.transition = ''
        }, 150)
      } else {
        popup.style.transition = 'transform 150ms ease-out'
        popup.style.transform = ''
        setTimeout(() => {
          popup.style.transition = ''
        }, 150)
      }
    }

    popup.addEventListener('touchstart', onTouchStart, { passive: true })
    popup.addEventListener('touchmove', onTouchMove, { passive: false })
    popup.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      popup.removeEventListener('touchstart', onTouchStart)
      popup.removeEventListener('touchmove', onTouchMove)
      popup.removeEventListener('touchend', onTouchEnd)
    }
  }, [enabled])

  return popupRef
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  hasOverlay = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
  hasOverlay?: boolean
}) {
  const isBottom = side === "bottom"
  const dragRef = useSheetBottomDragToDismiss(isBottom)

  return (
    <SheetPortal>
      {hasOverlay ? <SheetOverlay /> : null}
      <SheetPrimitive.Popup
        ref={dragRef}
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:min-h-auto data-[side=bottom]:max-h-[90dvh] data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        {isBottom ? (
          <div data-drag-handle="true" className="mx-auto mt-2 flex h-4 w-full cursor-grab items-center justify-center touch-none select-none active:cursor-grabbing">
            <div className="h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden="true" />
          </div>
        ) : null}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3"
                size="icon-sm"
              />
            }
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "cn-font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
