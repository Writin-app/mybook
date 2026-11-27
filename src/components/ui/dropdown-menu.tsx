import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function useBottomSheetDragToDismiss(enabled: boolean) {
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
          popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
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

function DropdownMenuContent({
  bottomSheet = false,
  showBackdrop,
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  children,
  ...props
}: MenuPrimitive.Popup.Props & {
  bottomSheet?: boolean
  showBackdrop?: boolean
} &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  const backdrop = showBackdrop ?? bottomSheet
  const dragRef = useBottomSheetDragToDismiss(bottomSheet)

  return (
    <MenuPrimitive.Portal>
      {backdrop && <MenuPrimitive.Backdrop data-slot="dropdown-menu-backdrop" className="fixed inset-0 z-50 bg-[var(--token-overlay-backdrop-overlay-backdrop-2,#0F10144d)] backdrop-blur-xs transition-opacity data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />}
      <MenuPrimitive.Positioner
        className={cn("isolate z-50 outline-none", bottomSheet && "fixed! inset-x-0! top-auto! bottom-0! w-full! transform-none!")}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          ref={dragRef}
          data-slot="dropdown-menu-content"
          data-bottom-sheet={bottomSheet || undefined}
          className={cn("z-50 max-h-(--available-height) min-w-[max(12rem,var(--anchor-width))] w-auto max-w-[min(320px,calc(100vw-2rem))] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-[var(--token-dimension-radius-12)] border border-[var(--token-overlay-border-primary)] bg-[var(--token-overlay-background-primary)] p-[var(--token-dimension-spacing-4)] text-[var(--token-overlay-foreground-primary)] shadow-[0_0_0_1px_var(--token-overlay-backdrop-edge),0_2px_2px_var(--token-overlay-backdrop-contact),0_4px_4px_var(--token-overlay-backdrop-ambient)] duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95", className, bottomSheet && "w-full min-h-auto max-h-[90dvh] overscroll-contain rounded-b-none rounded-t-2xl p-3 pb-[max(1rem,env(safe-area-inset-bottom))] origin-bottom data-open:slide-in-from-bottom-4 data-closed:slide-out-to-bottom-4 data-open:zoom-in-100 data-closed:zoom-out-100 shadow-2xl [&_[role=menuitem]]:min-h-11 [&_[role=menuitem]]:text-sm [&_[role=menuitem]]:px-3 [&_[role=menuitem]]:gap-2.5" )}
          {...props}
        >
          {bottomSheet ? (
            <div data-drag-handle="true" className="mx-auto mb-2 flex h-4 w-full cursor-grab items-center justify-center touch-none select-none active:cursor-grabbing">
              <div className="h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden="true" />
            </div>
          ) : null}
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuLabel({
  className,
  inset,
  leadingIcon,
  trailingAction,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  inset?: boolean
  leadingIcon?: React.ReactNode
  trailingAction?: React.ReactNode
}) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "flex items-center gap-[var(--token-dimension-spacing-4)] px-[var(--token-dimension-spacing-8)] py-[var(--token-dimension-spacing-4)] font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)] font-medium text-[var(--token-colors-foreground-elevated)] data-inset:pl-7",
        className
      )}
      {...props}
    >
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailingAction ? <span className="shrink-0">{trailingAction}</span> : null}
    </div>
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  leadingIcon,
  trailingContent,
  children,
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean
  variant?: "default" | "destructive"
  leadingIcon?: React.ReactNode
  trailingContent?: React.ReactNode
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-[var(--token-dimension-spacing-8)] rounded-[var(--token-dimension-radius-8)] px-[var(--token-dimension-spacing-8)] py-[var(--token-dimension-spacing-6)] font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14)] leading-[18px] text-[var(--token-colors-foreground-primary)] outline-hidden select-none focus:bg-[var(--token-colors-background-muted)] focus:text-[var(--token-colors-foreground-primary)] active:bg-[var(--token-colors-background-subtle)] data-inset:pl-7 data-[variant=destructive]:text-[var(--token-colors-foreground-destructive-strong)] data-[variant=destructive]:focus:bg-[var(--token-feedback-destructive-background)] data-[variant=destructive]:focus:text-[var(--token-colors-foreground-destructive-strong)] data-disabled:pointer-events-none data-disabled:text-[var(--token-actions-disabled-foreground)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-[var(--token-colors-foreground-destructive-strong)]",
        className
      )}
      {...props}
    >
      {leadingIcon ? <span className="flex shrink-0 items-center justify-center">{leadingIcon}</span> : null}
      {leadingIcon || trailingContent ? (
        <span className="min-w-0 flex-1 truncate">{children}</span>
      ) : (
        children
      )}
      {trailingContent ? <span className="ml-auto flex shrink-0 items-center gap-[var(--token-dimension-spacing-6)]">{trailingContent}</span> : null}
    </MenuPrimitive.Item>
  )
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  shortcut,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
  shortcut?: React.ReactNode
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-popup-open:bg-accent data-popup-open:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <span className="ml-auto flex items-center gap-1.5">
        {shortcut ? <kbd className="text-xs text-muted-foreground">{shortcut}</kbd> : null}
        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
      </span>
    </MenuPrimitive.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn("w-auto min-w-[96px] rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  leadingIcon,
  trailingContent,
  ...props
}: MenuPrimitive.CheckboxItem.Props & {
  inset?: boolean
  leadingIcon?: React.ReactNode
  trailingContent?: React.ReactNode
}) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-start gap-[var(--token-dimension-spacing-8)] rounded-[var(--token-dimension-radius-8)] px-[var(--token-dimension-spacing-8)] py-[var(--token-dimension-spacing-6)] font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14)] leading-[18px] text-[var(--token-colors-foreground-primary)] outline-hidden select-none focus:bg-[var(--token-colors-background-muted)] focus:text-[var(--token-colors-foreground-primary)] active:bg-[var(--token-colors-background-subtle)] data-inset:pl-7 data-disabled:pointer-events-none data-disabled:text-[var(--token-actions-disabled-foreground)] [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      checked={checked}
      {...props}
    >
      <span
        className="pointer-events-none flex w-4 shrink-0 items-start justify-center pt-[2px]"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <span
          className={cn(
            "flex size-[14px] items-center justify-center rounded-[var(--token-dimension-radius-4,4px)] border transition-colors",
            checked
              ? "border-[var(--token-colors-background-informative)] bg-[var(--token-colors-background-informative)] text-[var(--token-colors-foreground-primary-inverse,#ffffff)]"
              : "border-[var(--token-colors-border-secondary)] bg-[var(--token-actions-outline-background,white)]"
          )}
        >
          <MenuPrimitive.CheckboxItemIndicator>
            <HugeiconsIcon icon={Tick02Icon} size={10} strokeWidth={2.5} />
          </MenuPrimitive.CheckboxItemIndicator>
        </span>
      </span>
      {leadingIcon ? <span className="flex shrink-0 items-center justify-center pt-px">{leadingIcon}</span> : null}
      {leadingIcon || trailingContent ? (
        <span className="min-w-0 flex-1 truncate">{children}</span>
      ) : (
        children
      )}
      {trailingContent ? (
        <span className="ml-auto flex shrink-0 items-center gap-[var(--token-dimension-spacing-6)]">
          {trailingContent}
        </span>
      ) : null}
    </MenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  leadingIcon,
  trailingContent,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  inset?: boolean
  leadingIcon?: React.ReactNode
  trailingContent?: React.ReactNode
}) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-[var(--token-dimension-spacing-8)] rounded-[var(--token-dimension-radius-8)] px-[var(--token-dimension-spacing-8)] py-[var(--token-dimension-spacing-6)] font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14)] leading-[18px] text-[var(--token-colors-foreground-primary)] outline-hidden select-none focus:bg-[var(--token-colors-background-muted)] focus:text-[var(--token-colors-foreground-primary)] active:bg-[var(--token-colors-background-subtle)] data-inset:pl-7 data-disabled:pointer-events-none data-disabled:text-[var(--token-actions-disabled-foreground)] [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none flex size-4 shrink-0 items-center justify-center text-[var(--token-colors-foreground-primary)]"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2} />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {leadingIcon ? <span className="flex shrink-0 items-center justify-center">{leadingIcon}</span> : null}
      {leadingIcon || trailingContent ? (
        <span className="min-w-0 flex-1 truncate">{children}</span>
      ) : (
        children
      )}
      {trailingContent ? (
        <span className="ml-auto flex shrink-0 items-center gap-[var(--token-dimension-spacing-6)]">
          {trailingContent}
        </span>
      ) : null}
    </MenuPrimitive.RadioItem>
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn(
        "-mx-[var(--token-dimension-spacing-4)] my-[var(--token-dimension-spacing-4)] h-px bg-[var(--token-colors-border-primary)]",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)] tracking-[var(--token-typography-letter-spacing-normal)] text-[var(--token-colors-foreground-elevated)]",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
