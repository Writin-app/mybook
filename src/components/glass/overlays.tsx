import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent } from "@/components/ui/sheet"

type GlassSheetContextValue = { setOpen: (open: boolean) => void; modal: boolean }
const GlassSheetContext = React.createContext<GlassSheetContextValue>({ setOpen: () => undefined, modal: true })

type GlassSheetProps = React.ComponentProps<typeof Sheet> & { modal?: boolean }
function GlassSheet({ modal = true, onOpenChange, ...props }: GlassSheetProps) {
  const [internalOpen, setInternalOpen] = React.useState(props.defaultOpen ?? false)
  const isControlled = props.open !== undefined
  const currentOpen = props.open ?? internalOpen
  const updateOpen = React.useCallback((open: boolean, details?: Parameters<NonNullable<GlassSheetProps["onOpenChange"]>>[1]) => {
    if (!isControlled) setInternalOpen(open)
    onOpenChange?.(open, details as Parameters<NonNullable<GlassSheetProps["onOpenChange"]>>[1])
  }, [isControlled, onOpenChange])
  const requestClose = React.useCallback((open: boolean) => updateOpen(open), [updateOpen])
  return <GlassSheetContext.Provider value={{ setOpen: requestClose, modal }}><Sheet {...props} modal={modal} open={currentOpen} onOpenChange={updateOpen} /></GlassSheetContext.Provider>
}

type Detent = "medium" | "large" | number | `${number}px`
type GlassSheetContentProps = Omit<React.ComponentProps<typeof SheetContent>, "side"> & {
  side?: "top" | "right" | "bottom" | "left" | "start" | "end"
  detents?: Detent[]
  detent?: number
  defaultDetent?: number
  onDetentChange?: (index: number) => void
  grabber?: boolean
  onBeforeDismiss?: () => boolean | Promise<boolean>
}

function GlassSheetContent({ side = "right", detents, detent, defaultDetent = 0, onDetentChange, grabber, onBeforeDismiss, container, hasOverlay, className, children, style, ...props }: GlassSheetContentProps) {
  const { setOpen, modal } = React.useContext(GlassSheetContext)
  const [internalDetent, setInternalDetent] = React.useState(defaultDetent)
  const activeDetent = detent ?? internalDetent
  const updateDetent = (next: number) => { const bounded = Math.max(0, Math.min((detents?.length ?? 1) - 1, next)); if (detent === undefined) setInternalDetent(bounded); onDetentChange?.(bounded) }
  const isRtl = typeof document !== "undefined" && document.dir === "rtl"
  const resolvedSide = side === "start" ? (isRtl ? "right" : "left") : side === "end" ? (isRtl ? "left" : "right") : side
  const height = detents?.[activeDetent]
  const heightValue = height === "medium" ? "50dvh" : height === "large" ? "90dvh" : typeof height === "number" ? `${Math.round(height * 100)}dvh` : height
  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const delta = event.clientY - Number(event.currentTarget.dataset.startY ?? event.clientY)
    if (Math.abs(delta) > 32) {
      if (delta < 0) updateDetent(activeDetent + 1)
      else if (activeDetent > 0) updateDetent(activeDetent - 1)
      else void Promise.resolve(onBeforeDismiss?.()).then((allowed) => { if (allowed !== false) setOpen(false) })
    }
    delete event.currentTarget.dataset.startY
  }
  const showGrabber = grabber ?? Boolean(detents?.length)
  return <SheetContent container={container} hasOverlay={hasOverlay ?? modal} dragToDismiss={false} side={resolvedSide} className={cn("overflow-hidden border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity-strong),transparent)] backdrop-blur-2xl", className)} style={{ ...(heightValue ? { height: heightValue, maxHeight: height === "large" ? "100dvh" : heightValue } : null), ...style }} {...props}>
    {showGrabber ? <button type="button" data-slot="sheet-grabber" data-drag-handle="true" aria-label="Resize sheet" className="mx-auto -mt-2 mb-1 flex h-8 w-14 touch-none items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") { event.preventDefault(); updateDetent(activeDetent + 1) } if (event.key === "ArrowDown") { event.preventDefault(); updateDetent(activeDetent - 1) } }} onPointerDown={(event) => { event.currentTarget.dataset.startY = String(event.clientY); event.currentTarget.setPointerCapture(event.pointerId) }} onPointerUp={handlePointerUp}><span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-muted-foreground/35" /></button> : null}
    {children}
  </SheetContent>
}

type ActionSheetAction = { label: string; onSelect: () => void; destructive?: boolean; disabled?: boolean }

type ActionSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  actions: ActionSheetAction[]
  trigger?: React.ReactNode
  cancelLabel?: string
}

function ActionSheet({ open, onOpenChange, title, description, actions, trigger, cancelLabel = "Cancel" }: ActionSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger render={<Button variant="glass" />}>{trigger}</DialogTrigger> : null}
      <DialogContent data-slot="action-sheet" className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle>{description ? <DialogDescription>{description}</DialogDescription> : null}</DialogHeader>
        <div className="grid gap-2">
          {actions.map((action) => <Button key={action.label} variant={action.destructive ? "destructive" : "secondary"} disabled={action.disabled} onClick={() => { action.onSelect(); onOpenChange(false) }}>{action.label}</Button>)}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{cancelLabel}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type ConfirmationPopoverProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger: React.ReactNode
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}

function ConfirmationPopover({ open, onOpenChange, trigger, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", destructive = true, onConfirm }: ConfirmationPopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = open !== undefined
  const updateOpen = (next: boolean) => { if (!isControlled) setInternalOpen(next); onOpenChange?.(next) }
  return (
    <Popover open={open ?? internalOpen} onOpenChange={updateOpen}>
      <PopoverTrigger render={<Button variant="ghost" />}>{trigger}</PopoverTrigger>
      <PopoverContent data-slot="confirmation-popover" className="w-72">
        <PopoverHeader><PopoverTitle>{title}</PopoverTitle>{description ? <PopoverDescription>{description}</PopoverDescription> : null}</PopoverHeader>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" autoFocus onClick={() => updateOpen(false)}>{cancelLabel}</Button>
          <Button variant={destructive ? "destructive" : "default"} size="sm" onClick={() => { onConfirm(); updateOpen(false) }}>{confirmLabel}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { GlassSheet, GlassSheetContent, ActionSheet, ConfirmationPopover }
