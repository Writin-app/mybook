import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-[var(--token-dimension-spacing-4)] rounded-[var(--token-dimension-radius-full,9999px)] border border-transparent bg-clip-padding font-[family-name:var(--token-typography-font-family-primary)] font-semibold tracking-[var(--token-typography-letter-spacing-normal)] antialiased whitespace-nowrap transition-all outline-none select-none focus-visible:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:bg-[var(--token-actions-disabled-background)] disabled:text-[var(--token-actions-disabled-foreground)] aria-invalid:border-[var(--token-colors-border-destructive-strong)] aria-invalid:shadow-[0_0_0_2px_var(--token-focus-ring-destructive)] in-data-[slot=button-group]:rounded-lg [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--token-actions-primary-background)] text-[var(--token-actions-primary-foreground)] hover:bg-[var(--token-actions-primary-background-hover)] active:bg-[var(--token-actions-primary-background-pressed)]",
        outline:
          "border-[var(--token-actions-outline-border)] bg-[var(--token-actions-outline-background)] text-[var(--token-actions-outline-foreground)] hover:bg-[var(--token-actions-outline-background-hover)] active:bg-[var(--token-actions-outline-background-pressed)] aria-expanded:bg-[var(--token-actions-outline-background-selected)] aria-expanded:text-[var(--token-actions-outline-foreground-selected)] disabled:border-[var(--token-actions-disabled-border)]",
        secondary:
          "bg-[var(--token-actions-secondary-background)] text-[var(--token-actions-secondary-foreground)] hover:bg-[var(--token-actions-secondary-background-hover)] active:bg-[var(--token-actions-secondary-background-pressed)] aria-expanded:bg-[var(--token-actions-secondary-background-selected)] aria-expanded:text-[var(--token-actions-secondary-foreground-selected)]",
        ghost:
          "bg-[var(--token-actions-ghost-background)] text-[var(--token-actions-ghost-foreground)] hover:bg-[var(--token-actions-ghost-background-hover)] active:bg-[var(--token-actions-ghost-background-pressed)] aria-expanded:bg-[var(--token-actions-ghost-background-selected)] aria-expanded:text-[var(--token-actions-ghost-foreground-selected)] disabled:bg-transparent",
        destructive:
          "bg-[var(--token-actions-destructive-background)] text-[var(--token-actions-destructive-foreground)] hover:bg-[var(--token-actions-destructive-background-hover)] active:bg-[var(--token-actions-destructive-background-pressed)]",
        assist:
          "bg-[var(--token-actions-assist-background)] text-[var(--token-actions-assist-foreground)] hover:bg-[var(--token-actions-assist-background-hover)] active:bg-[var(--token-actions-assist-background-pressed)]",
        link: "bg-transparent text-[var(--token-actions-primary-link-foreground)] underline-offset-4 hover:underline hover:text-[var(--token-actions-primary-link-foreground-hover)] active:text-[var(--token-actions-primary-link-foreground-pressed)] disabled:bg-transparent",
        "link-destructive":
          "bg-transparent text-[var(--token-actions-destructive-link-foreground)] underline-offset-4 hover:underline hover:text-[var(--token-actions-destructive-link-foreground-hover)] active:text-[var(--token-actions-destructive-link-foreground-pressed)] disabled:bg-transparent",
        "link-assistive":
          "bg-transparent text-[var(--token-actions-assistive-link-foreground)] underline-offset-4 hover:underline hover:text-[var(--token-actions-assistive-link-foreground-hover)] active:text-[var(--token-actions-assistive-link-foreground-pressed)] disabled:bg-transparent",
      },
      size: {
        default:
          "h-[var(--token-dimension-size-40)] px-[var(--token-dimension-spacing-16)] py-[var(--token-dimension-spacing-8)] text-[length:var(--token-typography-font-size-14)] leading-[18px] [&_svg:not([class*='size-'])]:size-4",
        xs: "h-[var(--token-dimension-size-24)] px-[var(--token-dimension-spacing-10)] py-[var(--token-dimension-spacing-4)] text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-[var(--token-dimension-size-32)] px-[var(--token-dimension-spacing-12)] py-[var(--token-dimension-spacing-4)] text-[length:var(--token-typography-font-size-14)] leading-[18px] [&_svg:not([class*='size-'])]:size-4",
        lg: "h-[var(--token-dimension-size-48)] px-[var(--token-dimension-spacing-20)] py-[var(--token-dimension-spacing-12)] text-[length:var(--token-typography-font-size-16)] leading-[var(--token-typography-line-height-20)] [&_svg:not([class*='size-'])]:size-5",
        icon: "size-[var(--token-dimension-size-40)] p-0 [&_svg:not([class*='size-'])]:size-4",
        "icon-xs":
          "size-[var(--token-dimension-size-24)] p-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-[var(--token-dimension-size-32)] p-0 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg":
          "size-[var(--token-dimension-size-48)] p-0 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean
    loadingText?: React.ReactNode
    leadingIcon?: React.ReactNode
    trailingIcon?: React.ReactNode
  }

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  loadingText,
  leadingIcon,
  trailingIcon,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isIconOnly =
    size === "icon" ||
    size === "icon-xs" ||
    size === "icon-sm" ||
    size === "icon-lg"

  const spinnerSizeClass =
    size === "xs" || size === "icon-xs"
      ? "size-3"
      : size === "lg" || size === "icon-lg"
        ? "size-5"
        : "size-4"

  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading ? "" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        isIconOnly ? (
          <Spinner className={spinnerSizeClass} />
        ) : (
          <>
            <Spinner className={spinnerSizeClass} />
            {loadingText ?? children ?? "Loading..."}
          </>
        )
      ) : (
        <>
          {leadingIcon}
          {children}
          {trailingIcon}
        </>
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
