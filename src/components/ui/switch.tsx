"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

type SwitchSize = "sm" | "md" | "lg"

type SwitchProps = SwitchPrimitive.Root.Props & {
  size?: SwitchSize | "default"
}

// Per-size label/caption text sizing
const switchLabelSize: Record<SwitchSize, string> = {
  sm: "text-[length:var(--token-typography-font-size-12)] leading-[16px]",
  md: "text-[length:var(--token-typography-font-size-14)] leading-[18px]",
  lg: "text-[length:var(--token-typography-font-size-16)] leading-[20px]",
}

const switchCaptionSize: Record<SwitchSize, string> = {
  sm: "text-[length:var(--token-typography-font-size-10)] leading-[14px]",
  md: "text-[length:var(--token-typography-font-size-12)] leading-[16px]",
  lg: "text-[length:var(--token-typography-font-size-14)] leading-[18px]",
}

function Switch({
  className,
  size = "default",
  ...props
}: SwitchProps) {
  const normalizedSize: SwitchSize = size === "default" ? "md" : size

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={normalizedSize}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-[var(--token-dimension-radius-rounded,99px)] border border-transparent p-[2px] transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)] aria-invalid:border-[var(--token-colors-border-destructive-strong)] data-[size=sm]:h-[var(--token-dimension-size-14)] data-[size=sm]:w-[var(--token-dimension-size-32)] data-[size=md]:h-[var(--token-dimension-size-16)] data-[size=md]:w-[var(--token-dimension-size-40)] data-[size=lg]:h-[var(--token-dimension-size-20)] data-[size=lg]:w-[var(--token-dimension-size-48)] data-checked:bg-[var(--token-actions-primary-background)] hover:data-checked:bg-[var(--token-actions-primary-background-hover)] data-unchecked:bg-[var(--token-colors-background-muted)] hover:data-unchecked:bg-[var(--token-colors-background-subtle)] data-disabled:cursor-not-allowed data-disabled:bg-[var(--token-colors-background-subtle)]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-[var(--token-dimension-radius-rounded,99px)] bg-[var(--token-actions-primary-foreground)] ring-0 transition-transform group-data-[size=sm]/switch:h-[10px] group-data-[size=sm]/switch:w-[16px] group-data-[size=md]/switch:h-[12px] group-data-[size=md]/switch:w-[20px] group-data-[size=lg]/switch:h-[16px] group-data-[size=lg]/switch:w-[24px] group-data-[size=sm]/switch:data-checked:translate-x-[10px] group-data-[size=md]/switch:data-checked:translate-x-[14px] group-data-[size=lg]/switch:data-checked:translate-x-[18px] data-unchecked:translate-x-0 group-data-disabled/switch:bg-[var(--token-colors-background-muted)]"
      />
    </SwitchPrimitive.Root>
  )
}

type SwitchFieldProps = SwitchProps & {
  label?: React.ReactNode
  caption?: React.ReactNode
  wrapperClassName?: string
  id?: string
}

function SwitchField({
  label,
  caption,
  size = "default",
  wrapperClassName,
  id,
  ...props
}: SwitchFieldProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const s: SwitchSize = size === "default" ? "md" : size

  return (
    <div className={cn("flex items-start gap-[var(--token-dimension-spacing-8)]", wrapperClassName)}>
      <div className="flex items-center py-[var(--token-dimension-spacing-2)]">
        <Switch id={inputId} size={size} {...props} />
      </div>
      {(label || caption) && (
        <div className="flex flex-col gap-[var(--token-dimension-spacing-2)]">
          {label && (
            <label
              htmlFor={inputId}
              className={cn(
                "cursor-pointer font-[family-name:var(--token-typography-font-family-primary)]",
                "font-[number:var(--token-typography-font-weight-medium)] antialiased",
                "text-[var(--token-colors-foreground-primary)]",
                switchLabelSize[s]
              )}
            >
              {label}
            </label>
          )}
          {caption && (
            <p className={cn(
              "font-[family-name:var(--token-typography-font-family-primary)]",
              "font-[number:var(--token-typography-font-weight-regular)] antialiased",
              "text-[var(--token-colors-foreground-secondary)]",
              switchCaptionSize[s]
            )}>
              {caption}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export { Switch, SwitchField }
export type { SwitchProps, SwitchFieldProps }
