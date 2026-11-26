import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type AlertDialogAlign = "start" | "center"

const AlertDialogAlignContext = React.createContext<AlertDialogAlign>("start")

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-[var(--token-overlay-backdrop-overlay-backdrop-2,#0F10144d)] duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  size = "default",
  align,
  ...props
}: AlertDialogPrimitive.Popup.Props & {
  size?: "default" | "sm"
  align?: AlertDialogAlign
}) {
  const resolvedAlign: AlertDialogAlign =
    align ?? (size === "sm" ? "center" : "start")

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogAlignContext.Provider value={resolvedAlign}>
        <AlertDialogPrimitive.Popup
          data-slot="alert-dialog-content"
          data-size={size}
          data-align={resolvedAlign}
          className={cn(
            "group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] min-w-[280px] -translate-x-1/2 -translate-y-1/2 gap-[var(--token-dimension-spacing-16)] rounded-[var(--token-dimension-radius-12)] border border-[var(--token-overlay-border-primary)] bg-[var(--token-overlay-background-primary)] p-[var(--token-dimension-spacing-16)] text-[var(--token-overlay-foreground-primary)] shadow-[0_0_0_1px_var(--token-overlay-backdrop-edge),0_2px_6px_var(--token-overlay-backdrop-contact),0_6px_16px_var(--token-overlay-backdrop-ambient)] duration-100 outline-none data-[size=default]:max-w-[384px] data-[size=sm]:max-w-[320px] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </AlertDialogAlignContext.Provider>
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  align,
  ...props
}: React.ComponentProps<"div"> & {
  align?: AlertDialogAlign
}) {
  const contextAlign = React.useContext(AlertDialogAlignContext)
  const resolvedAlign = align ?? contextAlign

  return (
    <div
      data-slot="alert-dialog-header"
      data-align={resolvedAlign}
      className={cn(
        "group/alert-dialog-header grid grid-rows-[auto_1fr] gap-[var(--token-dimension-spacing-8)]",
        "data-[align=center]:place-items-center data-[align=center]:text-center data-[align=center]:has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr]",
        "data-[align=start]:place-items-start data-[align=start]:text-left data-[align=start]:has-data-[slot=alert-dialog-media]:grid-cols-[auto_1fr] data-[align=start]:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "-mx-[var(--token-dimension-spacing-16)] -mb-[var(--token-dimension-spacing-16)] flex flex-col-reverse gap-[var(--token-dimension-spacing-8)] rounded-b-[var(--token-dimension-radius-12)] border-t border-[var(--token-overlay-border-primary)] p-[var(--token-dimension-spacing-16)] group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "inline-flex size-[40px] shrink-0 items-center justify-center rounded-[var(--token-dimension-radius-8)] bg-[var(--token-colors-background-muted)] text-[var(--token-colors-foreground-primary)] group-data-[align=start]/alert-dialog-header:row-span-2 *:[svg:not([class*='size-'])]:size-6",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-16)] leading-[var(--token-typography-line-height-20)] font-semibold tracking-[var(--token-typography-letter-spacing-normal)] text-[var(--token-colors-foreground-primary)] group-data-[align=start]/alert-dialog-header:group-has-data-[slot=alert-dialog-media]/alert-dialog-header:col-start-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        "font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14)] leading-[18px] font-normal tracking-[var(--token-typography-letter-spacing-normal)] text-balance text-[var(--token-colors-foreground-secondary)] md:text-pretty group-data-[align=start]/alert-dialog-header:group-has-data-[slot=alert-dialog-media]/alert-dialog-header:col-start-2 *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-[var(--token-colors-foreground-primary)]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="alert-dialog-action"
      className={cn("w-full sm:w-auto sm:group-data-[size=sm]/alert-dialog-content:w-full", className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      className={cn("w-full sm:w-auto sm:group-data-[size=sm]/alert-dialog-content:w-full", className)}
      render={<Button variant={variant} size={size} />}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
