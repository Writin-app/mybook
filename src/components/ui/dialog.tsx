"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type DialogSize = "sm" | "md" | "lg" | "xl"

const DIALOG_SIZE_CLASSES: Record<DialogSize, string> = {
  sm: "sm:max-w-[380px]",
  md: "sm:max-w-[480px]",
  lg: "sm:max-w-[640px]",
  xl: "sm:max-w-[800px]",
}

const DialogScrollContext = React.createContext(false)

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-[var(--token-overlay-backdrop-overlay-backdrop-2,#0F10144d)] duration-100 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeButtonClassName,
  size = "md",
  scrollableContent = false,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  closeButtonClassName?: string
  size?: DialogSize
  scrollableContent?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogScrollContext.Provider value={scrollableContent}>
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          data-size={size}
          data-scrollable={scrollableContent ? "true" : undefined}
          className={cn(
            "group/dialog-content fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-[var(--token-dimension-spacing-16)] has-[>[data-slot=dialog-body]]:gap-0 rounded-[var(--token-dimension-radius-12)] border border-[var(--token-overlay-border-primary)] bg-[var(--token-overlay-background-primary)] p-[var(--token-dimension-spacing-16)] font-[family-name:var(--token-typography-font-family-primary)] text-sm text-[var(--token-overlay-foreground-primary)] antialiased shadow-[0_0_0_1px_var(--token-overlay-backdrop-edge),0_2px_6px_var(--token-overlay-backdrop-contact),0_6px_16px_var(--token-overlay-backdrop-ambient)] duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            DIALOG_SIZE_CLASSES[size],
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute top-[var(--token-dimension-spacing-16)] right-[var(--token-dimension-spacing-16)]",
                    closeButtonClassName
                  )}
                />
              }
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={Cancel01Icon}
                strokeWidth={1.75}
              />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogScrollContext.Provider>
    </DialogPortal>
  )
}

function DialogHeader({
  className,
  inlineAction,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  inlineAction?: React.ReactNode
}) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "-mx-[var(--token-dimension-spacing-16)] -mt-[var(--token-dimension-spacing-16)] flex flex-col gap-[var(--token-dimension-spacing-4)] border-b border-[var(--token-overlay-border-primary)] py-[var(--token-dimension-spacing-16)] pr-[var(--token-dimension-spacing-64)] pl-[var(--token-dimension-spacing-16)]",
        className
      )}
      {...props}
    >
      {inlineAction ? (
        <div className="flex w-full items-start gap-[var(--token-dimension-spacing-8)]">
          <div className="flex min-w-0 flex-1 flex-col gap-[var(--token-dimension-spacing-4)]">
            {children}
          </div>
          <div className="flex shrink-0 items-center gap-[var(--token-dimension-spacing-8)] pt-[var(--token-dimension-spacing-2)]">
            {inlineAction}
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  )
}

function DialogBody({
  className,
  scrollable,
  ...props
}: React.ComponentProps<"div"> & {
  scrollable?: boolean
}) {
  const contextScrollable = React.useContext(DialogScrollContext)
  const isScrollable = scrollable ?? contextScrollable

  return (
    <div
      data-slot="dialog-body"
      data-scrollable={isScrollable ? "true" : undefined}
      className={cn(
        "-mx-[var(--token-dimension-spacing-16)] flex flex-col gap-[var(--token-dimension-spacing-20)] p-[var(--token-dimension-spacing-16)] font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14)] leading-[18px] tracking-[var(--token-typography-letter-spacing-normal)] text-[var(--token-colors-foreground-secondary)]",
        isScrollable && "max-h-[min(640px,60vh)] overflow-y-auto",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  leadingActions,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
  leadingActions?: React.ReactNode
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-[var(--token-dimension-spacing-16)] -mb-[var(--token-dimension-spacing-16)] flex flex-col-reverse gap-[var(--token-dimension-spacing-8)] border-t border-[var(--token-overlay-border-primary)] p-[var(--token-dimension-spacing-16)] sm:flex-row sm:items-center sm:justify-end",
        className
      )}
      {...props}
    >
      {leadingActions && (
        <div className="flex flex-1 items-center gap-[var(--token-dimension-spacing-8)]">
          {leadingActions}
        </div>
      )}
      <div className="flex flex-col-reverse gap-[var(--token-dimension-spacing-8)] sm:flex-row sm:items-center sm:justify-end">
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close render={<Button variant="outline" />}>
            Close
          </DialogPrimitive.Close>
        )}
      </div>
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-20)] leading-[var(--token-typography-line-height-28)] font-semibold tracking-[var(--token-typography-letter-spacing-normal)] text-[var(--token-colors-foreground-primary)]",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14)] leading-[18px] font-normal tracking-[var(--token-typography-letter-spacing-normal)] text-[var(--token-colors-foreground-secondary)] *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-[var(--token-colors-foreground-primary)]",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
