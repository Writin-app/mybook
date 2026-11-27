import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

type CanonicalBadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "link"
  | "positive"
  | "attention"
  | "destructive"
  | "assistive"

export type BadgeVariant =
  | CanonicalBadgeVariant
  | "primary"
  | "success"
  | "warning"
  | "info"

export type BadgeSize = "sm" | "md" | "lg"
export type BadgeEmphasis = "strong" | "subtle"

function normalizeBadgeVariant(
  variant?: BadgeVariant | null
): CanonicalBadgeVariant {
  switch (variant) {
    case "primary":
    case "info":
    case "default":
    case undefined:
    case null:
      return "default"
    case "secondary":
      return "secondary"
    case "outline":
      return "outline"
    case "ghost":
      return "ghost"
    case "link":
      return "link"
    case "success":
    case "positive":
      return "positive"
    case "warning":
    case "attention":
      return "attention"
    case "destructive":
      return "destructive"
    case "assistive":
      return "assistive"
  }
}

const badgeVariants = cva(
  [
    "group/badge inline-flex w-fit shrink-0 items-center justify-center",
    "gap-[var(--token-dimension-spacing-2)] overflow-hidden",
    "rounded-[var(--token-dimension-radius-rounded)] border border-solid border-transparent",
    "font-[family-name:var(--token-typography-font-family-primary)] font-[number:var(--token-typography-font-weight-medium)] tracking-[var(--token-typography-letter-spacing-normal)] whitespace-nowrap antialiased",
    "transition-all",
    "focus-visible:border-[var(--token-focus-ring-brand)] focus-visible:ring-2 focus-visible:ring-[var(--token-focus-ring-brand)]/50 focus-visible:outline-none",
    "aria-invalid:border-[var(--token-colors-border-destructive-strong)] aria-invalid:ring-2 aria-invalid:ring-[var(--token-focus-ring-destructive)]",
    "[&>svg]:pointer-events-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "",
        secondary: "",
        outline: "",
        ghost: "",
        link: "underline-offset-4 hover:underline",
        positive: "",
        attention: "",
        destructive: "",
        assistive: "",
      },
      size: {
        sm: "h-[var(--token-dimension-size-16)] px-[var(--token-dimension-spacing-6)] py-[var(--token-dimension-spacing-2)] text-[length:var(--token-typography-font-size-10)] leading-[14px] [&>svg]:size-2.5!",
        md: "h-[var(--token-dimension-size-20)] px-[var(--token-dimension-spacing-8)] py-[var(--token-dimension-spacing-2)] text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)] [&>svg]:size-3!",
        lg: "h-[var(--token-dimension-size-24)] px-[var(--token-dimension-spacing-10)] py-[var(--token-dimension-spacing-4)] text-[length:var(--token-typography-font-size-14)] leading-[18px] [&>svg]:size-3!",
      },
      emphasis: {
        strong: "",
        subtle: "",
      },
    },
    compoundVariants: [
      {
        variant: "default",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-info-background-inverse)] text-[var(--token-feedback-info-foreground-inverse)] [a]:hover:opacity-90",
      },
      {
        variant: "default",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-info-background)] text-[var(--token-feedback-info-foreground)] [a]:hover:opacity-90",
      },
      {
        variant: "secondary",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-neutral-background-inverse)] text-[var(--token-feedback-neutral-foreground-inverse)] [a]:hover:opacity-90",
      },
      {
        variant: "secondary",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-neutral-background)] text-[var(--token-feedback-neutral-foreground)] [a]:hover:opacity-90",
      },
      {
        variant: "outline",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-neutral-background)] border-[var(--token-feedback-neutral-border)] text-[var(--token-feedback-neutral-foreground)] [a]:hover:bg-[var(--token-actions-ghost-background-hover)]",
      },
      {
        variant: "outline",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-neutral-background)] border-[var(--token-feedback-neutral-border)] text-[var(--token-feedback-neutral-foreground)] [a]:hover:bg-[var(--token-actions-ghost-background-hover)]",
      },
      {
        variant: "ghost",
        emphasis: "strong",
        className:
          "text-[var(--token-feedback-neutral-foreground)] [a]:hover:bg-[var(--token-actions-ghost-background-hover)]",
      },
      {
        variant: "ghost",
        emphasis: "subtle",
        className:
          "text-[var(--token-feedback-neutral-foreground)] [a]:hover:bg-[var(--token-actions-ghost-background-hover)]",
      },
      {
        variant: "link",
        emphasis: "strong",
        className: "text-[var(--token-feedback-info-foreground)]",
      },
      {
        variant: "link",
        emphasis: "subtle",
        className: "text-[var(--token-feedback-info-foreground)]",
      },
      {
        variant: "positive",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-positive-background-inverse)] text-[var(--token-feedback-positive-foreground-inverse)]",
      },
      {
        variant: "positive",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-positive-background)] text-[var(--token-feedback-positive-foreground)]",
      },
      {
        variant: "attention",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-attention-background-inverse)] text-[var(--token-feedback-attention-foreground-inverse)]",
      },
      {
        variant: "attention",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-attention-background)] text-[var(--token-feedback-attention-foreground)]",
      },
      {
        variant: "destructive",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-destructive-background-inverse)] text-[var(--token-feedback-destructive-foreground-inverse)]",
      },
      {
        variant: "destructive",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-destructive-background)] text-[var(--token-feedback-destructive-foreground)]",
      },
      {
        variant: "assistive",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-assistive-background-inverse)] text-[var(--token-feedback-assistive-foreground-inverse)]",
      },
      {
        variant: "assistive",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-assistive-background)] text-[var(--token-feedback-assistive-foreground)]",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "md",
      emphasis: "strong",
    },
  }
)

export interface BadgeProps
  extends Omit<useRender.ComponentProps<"span">, "variant">,
    Omit<VariantProps<typeof badgeVariants>, "variant"> {
  variant?: BadgeVariant
  size?: BadgeSize
  emphasis?: BadgeEmphasis
}

function Badge({
  className,
  variant = "default",
  size = "md",
  emphasis = "strong",
  render,
  ...props
}: BadgeProps) {
  const normalizedVariant = normalizeBadgeVariant(variant)

  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(
          badgeVariants({
            variant: normalizedVariant,
            size,
            emphasis,
          }),
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant: normalizedVariant,
      size,
      emphasis,
    },
  })
}

export { Badge, badgeVariants }
