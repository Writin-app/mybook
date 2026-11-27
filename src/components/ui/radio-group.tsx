import * as React from "react"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid w-full gap-[var(--token-dimension-spacing-8)]", className)}
      {...props}
    />
  )
}

const radioItemVariants = cva(
  "group/radio-group-item peer relative flex aspect-square shrink-0 items-center justify-center rounded-full border border-[var(--token-colors-border-secondary)] bg-[var(--token-actions-outline-background)] transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 hover:bg-[var(--token-actions-outline-background-hover)] hover:border-[var(--token-colors-border-elevated)] focus-visible:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)] aria-invalid:border-[var(--token-colors-border-destructive-strong)] aria-invalid:shadow-[0_0_0_2px_var(--token-focus-ring-destructive)] data-checked:border-[var(--token-actions-primary-background)] data-checked:bg-[var(--token-actions-primary-background)] hover:data-checked:border-[var(--token-actions-primary-background-hover)] hover:data-checked:bg-[var(--token-actions-primary-background-hover)] active:data-checked:bg-[var(--token-actions-primary-background-pressed)] data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:bg-[var(--token-actions-disabled-background)]! data-disabled:border-[var(--token-colors-border-muted)]! [&[data-disabled]_[data-slot=radio-group-dot]]:bg-[var(--token-actions-disabled-foreground)]!",
  {
    variants: {
      size: {
        sm: "size-[var(--token-dimension-size-14)] [&_[data-slot=radio-group-dot]]:size-1.5",
        md: "size-[var(--token-dimension-size-16)] [&_[data-slot=radio-group-dot]]:size-2",
        lg: "size-[var(--token-dimension-size-20)] [&_[data-slot=radio-group-dot]]:size-2.5",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

type RadioGroupItemProps = RadioPrimitive.Root.Props &
  VariantProps<typeof radioItemVariants>

function RadioGroupItem({
  className,
  size = "md",
  ...props
}: RadioGroupItemProps) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      data-size={size}
      className={cn(radioItemVariants({ size, className }))}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center"
      >
        <span
          data-slot="radio-group-dot"
          className="rounded-full bg-[var(--token-actions-primary-foreground)]"
        />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}

// Per-size label/caption text sizing
const radioLabelSize = {
  sm: "text-[length:var(--token-typography-font-size-12)] leading-[16px]",
  md: "text-[length:var(--token-typography-font-size-14)] leading-[18px]",
  lg: "text-[length:var(--token-typography-font-size-16)] leading-[20px]",
} as const

const radioCaptionSize = {
  sm: "text-[length:var(--token-typography-font-size-10)] leading-[14px]",
  md: "text-[length:var(--token-typography-font-size-12)] leading-[16px]",
  lg: "text-[length:var(--token-typography-font-size-14)] leading-[18px]",
} as const

type RadioSize = "sm" | "md" | "lg"

type RadioGroupItemFieldProps = RadioGroupItemProps & {
  label?: React.ReactNode
  caption?: React.ReactNode
  wrapperClassName?: string
}

function RadioGroupItemField({
  label,
  caption,
  size = "md",
  wrapperClassName,
  id,
  ...props
}: RadioGroupItemFieldProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const s: RadioSize = size ?? "md"

  return (
    <div className={cn("flex items-start gap-[var(--token-dimension-spacing-8)]", wrapperClassName)}>
      <div className="flex items-center py-[var(--token-dimension-spacing-2)]">
        <RadioGroupItem id={inputId} size={size} {...props} />
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
                radioLabelSize[s]
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
              radioCaptionSize[s]
            )}>
              {caption}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export { RadioGroup, RadioGroupItem, RadioGroupItemField, radioItemVariants }
export type { RadioGroupItemProps, RadioGroupItemFieldProps }
