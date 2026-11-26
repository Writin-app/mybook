import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export type ToggleVariant = "default" | "outline" | "ghost"
export type ToggleSize = "xs" | "sm" | "md" | "default" | "lg"

const toggleVariants = cva(
  [
    "group/toggle inline-flex shrink-0 cursor-pointer items-center justify-center",
    "gap-[var(--token-dimension-spacing-4)] rounded-[var(--token-dimension-radius-rounded)]",
    "font-[family-name:var(--token-typography-font-family-primary)] font-[number:var(--token-typography-font-weight-medium)] tracking-[var(--token-typography-letter-spacing-normal)] whitespace-nowrap antialiased",
    "transition-all outline-none",
    "focus-visible:border-[var(--token-focus-ring-brand)] focus-visible:ring-2 focus-visible:ring-[var(--token-focus-ring-brand)]/50",
    "aria-invalid:border-[var(--token-colors-border-destructive-strong)] aria-invalid:ring-2 aria-invalid:ring-[var(--token-focus-ring-destructive)]",
    "aria-pressed:border-transparent aria-pressed:bg-[var(--token-actions-secondary-background-selected)] aria-pressed:text-[var(--token-actions-secondary-foreground-selected)]",
    "data-[pressed]:border-transparent data-[pressed]:bg-[var(--token-actions-secondary-background-selected)] data-[pressed]:text-[var(--token-actions-secondary-foreground-selected)]",
    "data-[state=on]:border-transparent data-[state=on]:bg-[var(--token-actions-secondary-background-selected)] data-[state=on]:text-[var(--token-actions-secondary-foreground-selected)]",
    "disabled:pointer-events-none disabled:border-transparent disabled:bg-[var(--token-actions-disabled-background)] disabled:text-[var(--token-actions-disabled-foreground)]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[var(--token-actions-secondary-background)] text-[var(--token-actions-secondary-foreground)] hover:bg-[var(--token-actions-secondary-background-hover)]",
        outline:
          "border border-solid border-[var(--token-actions-outline-border)] bg-transparent text-[var(--token-actions-outline-foreground)] hover:bg-[var(--token-actions-ghost-background-hover)]",
        ghost:
          "bg-transparent text-[var(--token-actions-ghost-foreground)] hover:bg-[var(--token-actions-ghost-background-hover)]",
      },
      size: {
        xs: "h-[var(--token-dimension-size-24)] px-[var(--token-dimension-spacing-8)] py-[var(--token-dimension-spacing-4)] text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-[var(--token-dimension-size-32)] px-[var(--token-dimension-spacing-10)] py-[var(--token-dimension-spacing-4)] text-[length:var(--token-typography-font-size-14)] leading-[18px] [&_svg:not([class*='size-'])]:size-4",
        md: "h-[var(--token-dimension-size-40)] px-[var(--token-dimension-spacing-12)] py-[var(--token-dimension-spacing-6)] text-[length:var(--token-typography-font-size-16)] leading-[var(--token-typography-line-height-20)] [&_svg:not([class*='size-'])]:size-4",
        default:
          "h-[var(--token-dimension-size-40)] px-[var(--token-dimension-spacing-12)] py-[var(--token-dimension-spacing-6)] text-[length:var(--token-typography-font-size-16)] leading-[var(--token-typography-line-height-20)] [&_svg:not([class*='size-'])]:size-4",
        lg: "h-[var(--token-dimension-size-48)] px-[var(--token-dimension-spacing-16)] py-[var(--token-dimension-spacing-8)] text-[length:var(--token-typography-font-size-16)] leading-[var(--token-typography-line-height-20)] [&_svg:not([class*='size-'])]:size-5",
      },
      iconOnly: {
        true: "px-0",
        false: "",
      },
    },
    compoundVariants: [
      { size: "xs", iconOnly: true, className: "size-[var(--token-dimension-size-24)]" },
      { size: "sm", iconOnly: true, className: "size-[var(--token-dimension-size-32)]" },
      { size: "md", iconOnly: true, className: "size-[var(--token-dimension-size-40)]" },
      { size: "default", iconOnly: true, className: "size-[var(--token-dimension-size-40)]" },
      { size: "lg", iconOnly: true, className: "size-[var(--token-dimension-size-48)]" },
    ],
    defaultVariants: {
      variant: "default",
      size: "md",
      iconOnly: false,
    },
  }
)

export interface ToggleProps
  extends TogglePrimitive.Props,
    VariantProps<typeof toggleVariants> {
  showSelectedTick?: boolean
  count?: number | string
  onDismiss?: () => void
}

function Toggle({
  className,
  variant = "default",
  size = "md",
  iconOnly = false,
  showSelectedTick = false,
  count,
  onDismiss,
  children,
  ...props
}: ToggleProps) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, iconOnly }), className)}
      {...props}
    >
      {showSelectedTick && !iconOnly && (
        <HugeiconsIcon
          aria-hidden="true"
          icon={Tick02Icon}
          strokeWidth={2}
          className="hidden group-aria-pressed/toggle:inline-block group-data-[pressed]/toggle:inline-block group-data-[state=on]/toggle:inline-block"
        />
      )}
      {children}
      {count !== undefined && !iconOnly && (
        <Badge
          variant="secondary"
          emphasis="strong"
          size={size === "xs" ? "sm" : "md"}
          className="group-disabled/toggle:opacity-20"
        >
          {count}
        </Badge>
      )}
      {onDismiss && !iconOnly && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Remove"
          onClick={(event) => {
            event.stopPropagation()
            onDismiss()
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              event.stopPropagation()
              onDismiss()
            }
          }}
          className="inline-flex items-center justify-center rounded-full opacity-80 hover:opacity-100"
        >
          <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} strokeWidth={1.75} />
        </span>
      )}
    </TogglePrimitive>
  )
}

export { Toggle, toggleVariants }
