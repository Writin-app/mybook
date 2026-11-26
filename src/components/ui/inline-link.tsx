import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { IconWrapper } from "@/components/ui/icon-wrapper"

const inlineLinkVariants = cva(
  "inline-flex w-fit items-center gap-[var(--token-dimension-spacing-8)] font-[family-name:var(--token-typography-font-family-primary)] font-medium tracking-[var(--token-typography-letter-spacing-normal)] antialiased whitespace-nowrap transition-colors outline-none decoration-from-font underline-offset-2 focus-visible:rounded-[var(--token-dimension-radius-4)] focus-visible:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)] aria-disabled:pointer-events-none aria-disabled:text-[var(--token-actions-disabled-foreground)]",
  {
    variants: {
      variant: {
        primary:
          "text-[var(--token-actions-primary-link-foreground)] hover:text-[var(--token-actions-primary-link-foreground-hover)] hover:underline active:text-[var(--token-actions-primary-link-foreground-pressed)] active:no-underline",
        destructive:
          "text-[var(--token-actions-destructive-link-foreground)] hover:text-[var(--token-actions-destructive-link-foreground-hover)] hover:underline active:text-[var(--token-actions-destructive-link-foreground-pressed)] active:no-underline",
        assistive:
          "text-[var(--token-actions-assistive-link-foreground)] hover:text-[var(--token-actions-assistive-link-foreground-hover)] hover:underline active:text-[var(--token-actions-assistive-link-foreground-pressed)] active:no-underline",
      },
      size: {
        sm: "text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)]",
        md: "text-[length:var(--token-typography-font-size-14)] leading-[18px]",
        lg: "text-[length:var(--token-typography-font-size-16)] leading-[var(--token-typography-line-height-20)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

type InlineLinkProps = useRender.ComponentProps<"a"> &
  VariantProps<typeof inlineLinkVariants> & {
    leadingIcon?: React.ReactNode
    trailingIcon?: React.ReactNode
    disabled?: boolean
  }

function InlineLink({
  className,
  variant = "primary",
  size = "md",
  leadingIcon,
  trailingIcon,
  disabled = false,
  render,
  children,
  ...props
}: InlineLinkProps) {
  const iconSize = size === "lg" ? "20" : "16"

  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        "aria-disabled": disabled || undefined,
        tabIndex: disabled ? -1 : props.tabIndex,
        className: cn(inlineLinkVariants({ variant, size, className })),
        children: (
          <>
            {leadingIcon ? <IconWrapper size={iconSize}>{leadingIcon}</IconWrapper> : null}
            <span>{children}</span>
            {trailingIcon ? <IconWrapper size={iconSize}>{trailingIcon}</IconWrapper> : null}
          </>
        ),
      },
      props
    ),
    render,
    state: {
      slot: "inline-link",
      variant: variant ?? "primary",
      size: size ?? "md",
    },
  })
}

export { InlineLink, inlineLinkVariants }
export type { InlineLinkProps }
