import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusIndicatorVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center",
    "ring-[1.5px] ring-[var(--token-colors-background-default)]",
  ],
  {
    variants: {
      size: {
        xs: "size-[6px] rounded-full",
        sm: "size-[8px] rounded-full",
        md: "size-[10px] rounded-full",
        lg: "size-[12px] rounded-[3px]",
        xl: "size-[14px] rounded-[4px]",
        "2xl": "size-[16px] rounded-[4px]",
      },
      status: {
        offline: "bg-[var(--token-feedback-neutral-status)]",
        online:  "rounded-full bg-[var(--token-feedback-positive-status)]",
        away:    "bg-[var(--token-feedback-attention-status)]",
        busy:    "bg-[var(--token-feedback-destructive-status)]",
      },
    },
    compoundVariants: [
      // online is always a full circle regardless of size
      { status: "online", size: "lg",  class: "rounded-full" },
      { status: "online", size: "xl",  class: "rounded-full" },
      { status: "online", size: "2xl", class: "rounded-full" },
      // offline is always a full circle regardless of size
      { status: "offline", size: "lg",  class: "rounded-full" },
      { status: "offline", size: "xl",  class: "rounded-full" },
      { status: "offline", size: "2xl", class: "rounded-full" },
    ],
    defaultVariants: {
      size: "md",
      status: "offline",
    },
  }
)

export type StatusIndicatorSize   = "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
export type StatusIndicatorStatus = "offline" | "online" | "away" | "busy"

export interface StatusIndicatorProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof statusIndicatorVariants> {
  size?:     StatusIndicatorSize
  status?:   StatusIndicatorStatus
  withIcon?: boolean
}

function StatusIndicator({
  className,
  size = "md",
  status = "offline",
  withIcon = false,
  children,
  ...props
}: StatusIndicatorProps) {
  const showIcon = withIcon && (size === "lg" || size === "xl" || size === "2xl")

  return (
    <span
      data-slot="status-indicator"
      data-size={size}
      data-status={status}
      aria-label={status}
      role="img"
      className={cn(statusIndicatorVariants({ size, status }), className)}
      {...props}
    >
      {showIcon && children}
    </span>
  )
}

export { StatusIndicator, statusIndicatorVariants }
