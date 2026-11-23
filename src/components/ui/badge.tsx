import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 text-xs font-semibold whitespace-nowrap transition-colors duration-200 ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        tinted: "bg-primary/16 text-primary dark:bg-primary/22",
        glass: "border-[var(--glass-chrome-border)] bg-[var(--glass-chrome-bg)] text-foreground shadow-sm backdrop-blur-md",
        secondary:
          "bg-muted text-foreground [a]:hover:bg-muted/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

function BadgeCount({
  className,
  count,
  max = 99,
  showZero = false,
  label,
  ...props
}: React.ComponentProps<"span"> & {
  count?: number
  max?: number
  showZero?: boolean
  label?: string
}) {
  if (count !== undefined && count <= 0 && !showZero) return null
  const dot = count === undefined

  return (
    <span
      data-slot="badge-count"
      data-dot={dot || undefined}
      className={cn(
        "pointer-events-none absolute -top-1 -end-1 z-10 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[0.6875rem] leading-none font-semibold text-destructive-foreground ring-2 ring-background data-dot:top-0 data-dot:end-0 data-dot:size-2.5 data-dot:min-w-0 data-dot:p-0",
        className
      )}
      {...props}
    >
      {dot ? null : count > max ? `${max}+` : count}
      {label ? <span className="sr-only"> {label}</span> : null}
    </span>
  )
}

export { Badge, BadgeCount, badgeVariants }
