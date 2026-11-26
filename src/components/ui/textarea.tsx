import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

export type TextareaSize = "xs" | "sm" | "md" | "lg"
export type TextareaValidation = "default" | "invalid" | "valid" | "alert"

const textareaVariants = cva(
  [
    "flex field-sizing-content w-full min-w-0 border border-solid bg-[var(--token-colors-background-default)]",
    "font-[family-name:var(--token-typography-font-family-primary)] font-[number:var(--token-typography-font-weight-regular)] tracking-[var(--token-typography-letter-spacing-normal)] text-[var(--token-colors-foreground-primary)] antialiased",
    "placeholder:text-[var(--token-colors-foreground-muted)]",
    "transition-colors outline-none",
    "hover:bg-[var(--token-colors-background-quiet)]",
    "focus-visible:bg-[var(--token-colors-background-default)] focus-visible:border-[var(--token-colors-border-informative)] focus-visible:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)]",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-[var(--token-colors-border-muted)] disabled:bg-[var(--token-colors-background-quiet)] disabled:text-[var(--token-colors-foreground-quiet)] disabled:placeholder:text-[var(--token-colors-foreground-quiet)]",
    "aria-invalid:border-[var(--token-colors-border-destructive)]",
  ].join(" "),
  {
    variants: {
      size: {
        xs: "min-h-[64px] rounded-[var(--token-dimension-radius-8)] p-[var(--token-dimension-spacing-6)] text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)]",
        sm: "min-h-[72px] rounded-[var(--token-dimension-radius-8)] p-[var(--token-dimension-spacing-8)] text-[length:var(--token-typography-font-size-14)] leading-[18px]",
        md: "min-h-[88px] rounded-[var(--token-dimension-radius-10)] p-[var(--token-dimension-spacing-10)] text-[length:var(--token-typography-font-size-14)] leading-[18px]",
        lg: "min-h-[104px] rounded-[var(--token-dimension-radius-12)] p-[var(--token-dimension-spacing-12)] text-[length:var(--token-typography-font-size-16)] leading-[var(--token-typography-line-height-20)]",
      },
      validation: {
        default: "border-[var(--token-colors-border-secondary)]",
        invalid: "border-[var(--token-colors-border-destructive)]",
        valid: "border-[var(--token-colors-border-positive)]",
        alert: "border-[var(--token-colors-border-attention)]",
      },
    },
    defaultVariants: {
      size: "md",
      validation: "default",
    },
  }
)

export interface TextareaProps
  extends React.ComponentProps<"textarea">,
    VariantProps<typeof textareaVariants> {
  size?: TextareaSize
  validation?: TextareaValidation
  resizable?: boolean
  showCount?: boolean
}

function Textarea({
  className,
  size = "md",
  validation = "default",
  resizable = true,
  showCount = false,
  maxLength,
  value,
  defaultValue,
  onChange,
  ...props
}: TextareaProps) {
  const [internalLength, setInternalLength] = React.useState(() =>
    typeof value === "string"
      ? value.length
      : typeof defaultValue === "string"
        ? defaultValue.length
        : 0
  )

  const currentLength = typeof value === "string" ? value.length : internalLength

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInternalLength(event.target.value.length)
    onChange?.(event)
  }

  const textareaNode = (
    <textarea
      data-slot="textarea"
      data-size={size}
      data-validation={validation}
      aria-invalid={validation === "invalid" ? true : props["aria-invalid"]}
      maxLength={maxLength}
      value={value}
      defaultValue={defaultValue}
      onChange={handleChange}
      className={cn(
        textareaVariants({ size, validation }),
        !resizable && "resize-none",
        showCount && "pb-[var(--token-dimension-spacing-24)]",
        className
      )}
      {...props}
    />
  )

  if (!showCount) {
    return textareaNode
  }

  const countLimit = maxLength ?? 100
  const isXs = size === "xs"

  return (
    <div className="relative w-full">
      {textareaNode}
      <span
        data-slot="textarea-count"
        className={cn(
          "pointer-events-none absolute right-[var(--token-dimension-spacing-16)] bottom-[var(--token-dimension-spacing-4)] font-[family-name:var(--token-typography-font-family-primary)] font-[number:var(--token-typography-font-weight-medium)] text-[var(--token-colors-foreground-elevated)] antialiased",
          isXs
            ? "text-[length:var(--token-typography-font-size-10)] leading-[14px]"
            : "text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)]",
          props.disabled && "text-[var(--token-colors-foreground-quiet)]"
        )}
      >
        {currentLength}/{countLimit}
      </span>
    </div>
  )
}

export { Textarea, textareaVariants }
