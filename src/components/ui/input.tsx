import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

export type InputSize = "xs" | "sm" | "md" | "lg"
export type InputValidation = "default" | "invalid" | "valid" | "alert"

const inputVariants = cva(
  [
    "w-full min-w-0 border border-solid bg-[var(--token-colors-background-default)]",
    "font-[family-name:var(--token-typography-font-family-primary)] font-[number:var(--token-typography-font-weight-regular)] tracking-[var(--token-typography-letter-spacing-normal)] text-[var(--token-colors-foreground-primary)] antialiased",
    "placeholder:text-[var(--token-colors-foreground-muted)]",
    "transition-colors outline-none",
    "hover:bg-[var(--token-colors-background-quiet)]",
    "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--token-colors-foreground-primary)]",
    "focus-visible:bg-[var(--token-colors-background-default)] focus-visible:border-[var(--token-colors-border-informative)] focus-visible:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)]",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-[var(--token-colors-border-muted)] disabled:bg-[var(--token-colors-background-quiet)] disabled:text-[var(--token-colors-foreground-quiet)] disabled:placeholder:text-[var(--token-colors-foreground-quiet)]",
    "aria-invalid:border-[var(--token-colors-border-destructive)]",
  ].join(" "),
  {
    variants: {
      size: {
        xs: "h-[var(--token-dimension-size-24)] rounded-[var(--token-dimension-radius-8)] p-[var(--token-dimension-spacing-6)] text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)]",
        sm: "h-[var(--token-dimension-size-32)] rounded-[var(--token-dimension-radius-8)] p-[var(--token-dimension-spacing-8)] text-[length:var(--token-typography-font-size-14)] leading-[18px]",
        md: "h-[var(--token-dimension-size-40)] rounded-[var(--token-dimension-radius-10)] p-[var(--token-dimension-spacing-10)] text-[length:var(--token-typography-font-size-14)] leading-[18px]",
        lg: "h-[var(--token-dimension-size-48)] rounded-[var(--token-dimension-radius-12)] p-[var(--token-dimension-spacing-12)] text-[length:var(--token-typography-font-size-16)] leading-[var(--token-typography-line-height-20)]",
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

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {
  size?: InputSize
  validation?: InputValidation
  htmlSize?: number
}

function Input({
  className,
  type,
  size = "md",
  validation = "default",
  htmlSize,
  ...props
}: InputProps) {
  return (
    <InputPrimitive
      type={type}
      size={htmlSize}
      data-slot="input"
      data-size={size}
      data-validation={validation}
      aria-invalid={validation === "invalid" ? true : props["aria-invalid"]}
      className={cn(inputVariants({ size, validation }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
