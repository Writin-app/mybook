"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

type TooltipContentProps = TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > & {
    supportingText?: React.ReactNode
    showArrow?: boolean
  }

function TooltipContent({
  className,
  side = "top",
  sideOffset = 6,
  align = "center",
  alignOffset = 0,
  supportingText,
  showArrow = true,
  children,
  ...props
}: TooltipContentProps) {
  const hasSupportingText = Boolean(supportingText)

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 inline-flex w-fit origin-(--transform-origin) flex-col items-start rounded-[var(--token-dimension-radius-8)] bg-[var(--token-colors-background-default-inverse)] font-[family-name:var(--token-typography-font-family-primary)] tracking-[var(--token-typography-letter-spacing-normal)] text-[var(--token-colors-foreground-primary-inverse)] antialiased shadow-[0_0_0_1px_var(--token-overlay-backdrop-edge),0_2px_2px_var(--token-overlay-backdrop-contact),0_4px_4px_var(--token-overlay-backdrop-ambient)] has-data-[slot=kbd]:pr-2 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            hasSupportingText
              ? "max-w-[328px] gap-[var(--token-dimension-spacing-4)] p-[var(--token-dimension-spacing-12)]"
              : "max-w-xs px-[var(--token-dimension-spacing-12)] py-[var(--token-dimension-spacing-8)]",
            className
          )}
          {...props}
        >
          <div className="inline-flex items-center gap-1.5 text-[length:var(--token-typography-font-size-14)] leading-[18px] font-medium">
            {children}
          </div>
          {hasSupportingText ? (
            <p className="text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)] font-normal text-[var(--token-colors-foreground-secondary-inverse)]">
              {supportingText}
            </p>
          ) : null}
          {showArrow ? (
            <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-[var(--token-colors-background-default-inverse)] fill-[var(--token-colors-background-default-inverse)] data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:translate-x-[1.5px] data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:translate-x-[-1.5px] data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:translate-x-[-1.5px] data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:translate-x-[1.5px] data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
          ) : null}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
export type { TooltipContentProps }
