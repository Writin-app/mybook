"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { MinusSignIcon, Tick02Icon } from "@hugeicons/core-free-icons"

const checkboxVariants = cva(
  "peer relative flex shrink-0 items-center justify-center rounded-[var(--token-dimension-radius-4)] border border-[var(--token-colors-border-secondary)] bg-[var(--token-actions-outline-background)] transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 hover:bg-[var(--token-actions-outline-background-hover)] hover:border-[var(--token-colors-border-elevated)] active:bg-[var(--token-actions-outline-background-pressed)] focus-visible:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)] aria-invalid:border-[var(--token-colors-border-destructive-strong)] aria-invalid:shadow-[0_0_0_2px_var(--token-focus-ring-destructive)] data-checked:border-[var(--token-actions-primary-background)] data-checked:bg-[var(--token-actions-primary-background)] data-checked:text-[var(--token-actions-primary-foreground)] hover:data-checked:border-[var(--token-actions-primary-background-hover)] hover:data-checked:bg-[var(--token-actions-primary-background-hover)] active:data-checked:bg-[var(--token-actions-primary-background-pressed)] data-indeterminate:border-[var(--token-actions-primary-background)] data-indeterminate:bg-[var(--token-actions-primary-background)] data-indeterminate:text-[var(--token-actions-primary-foreground)] hover:data-indeterminate:border-[var(--token-actions-primary-background-hover)] hover:data-indeterminate:bg-[var(--token-actions-primary-background-hover)] data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:bg-[var(--token-actions-disabled-background)]! data-disabled:border-[var(--token-colors-border-muted)]! data-disabled:text-[var(--token-actions-disabled-foreground)]!",
  {
    variants: {
      size: {
        sm: "size-[var(--token-dimension-size-14)] [&_[data-slot=checkbox-indicator]>svg]:size-[var(--token-dimension-size-12)]",
        md: "size-[var(--token-dimension-size-16)] [&_[data-slot=checkbox-indicator]>svg]:size-[var(--token-dimension-size-14)]",
        lg: "size-[var(--token-dimension-size-20)] [&_[data-slot=checkbox-indicator]>svg]:size-[var(--token-dimension-size-16)]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

type CheckboxProps = CheckboxPrimitive.Root.Props &
  VariantProps<typeof checkboxVariants>

function Checkbox({ className, size = "md", ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      data-size={size}
      className={cn(checkboxVariants({ size, className }))}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        {props.indeterminate ? (
          <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2.5} />
        ) : (
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2.5} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

type CheckboxFieldProps = CheckboxProps & {
  label?: React.ReactNode
  caption?: React.ReactNode
  wrapperClassName?: string
}

// Per-size label/caption text sizing (matches Figma)
const checkboxLabelSize: Record<NonNullable<CheckboxProps["size"]>, string> = {
  sm: "text-[length:var(--token-typography-font-size-12)] leading-[16px]",
  md: "text-[length:var(--token-typography-font-size-14)] leading-[18px]",
  lg: "text-[length:var(--token-typography-font-size-16)] leading-[20px]",
}

const checkboxCaptionSize: Record<NonNullable<CheckboxProps["size"]>, string> = {
  sm: "text-[length:var(--token-typography-font-size-10)] leading-[14px]",
  md: "text-[length:var(--token-typography-font-size-12)] leading-[16px]",
  lg: "text-[length:var(--token-typography-font-size-14)] leading-[18px]",
}

function CheckboxField({
  label,
  caption,
  size = "md",
  wrapperClassName,
  id,
  ...props
}: CheckboxFieldProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  return (
    <div className={cn("flex items-start gap-[var(--token-dimension-spacing-8)]", wrapperClassName)}>
      <div className="flex items-center py-[var(--token-dimension-spacing-2)]">
        <Checkbox id={inputId} size={size} {...props} />
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
                checkboxLabelSize[size ?? "md"]
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
              checkboxCaptionSize[size ?? "md"]
            )}>
              {caption}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export { Checkbox, CheckboxField, checkboxVariants }
export type { CheckboxProps, CheckboxFieldProps }
