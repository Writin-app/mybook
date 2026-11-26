import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  Alert01Icon,
  AlertDiamondIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@/lib/utils"
import { IconWrapper } from "@/components/ui/icon-wrapper"

type CanonicalAlertVariant =
  | "default"
  | "info"
  | "positive"
  | "attention"
  | "destructive"
  | "assistive"

export type AlertVariant =
  | CanonicalAlertVariant
  | "neutral"
  | "success"
  | "warning"

export type AlertEmphasis = "subtle" | "strong"
export type AlertAppearance = "toast" | "banner"

function normalizeAlertVariant(
  variant?: AlertVariant | null
): CanonicalAlertVariant {
  switch (variant) {
    case "neutral":
    case "default":
    case undefined:
    case null:
      return "default"
    case "success":
    case "positive":
      return "positive"
    case "warning":
    case "attention":
      return "attention"
    case "info":
      return "info"
    case "destructive":
      return "destructive"
    case "assistive":
      return "assistive"
  }
}

const alertVariants = cva(
  [
    "group/alert relative grid w-full items-center text-left",
    "grid-cols-[1fr_auto_auto]",
    "has-[>svg]:grid-cols-[auto_1fr_auto_auto]",
    "has-[>[data-slot=alert-icon]]:grid-cols-[auto_1fr_auto_auto]",
    "gap-x-[var(--token-dimension-spacing-8)] gap-y-[var(--token-dimension-spacing-2)]",
    "font-[family-name:var(--token-typography-font-family-primary)] antialiased",
    "*:[svg]:col-start-1 *:[svg]:row-start-1 *:[svg]:row-span-2 *:[svg]:self-center *:[svg]:text-current *:[svg:not([class*='size-'])]:size-5",
    "*:[data-slot=alert-icon]:col-start-1 *:[data-slot=alert-icon]:row-start-1 *:[data-slot=alert-icon]:row-span-2 *:[data-slot=alert-icon]:self-center",
    "*:data-[slot=alert-title]:col-start-1 has-[>svg]:*:data-[slot=alert-title]:col-start-2 has-[>[data-slot=alert-icon]]:*:data-[slot=alert-title]:col-start-2",
    "*:data-[slot=alert-description]:col-start-1 has-[>svg]:*:data-[slot=alert-description]:col-start-2 has-[>[data-slot=alert-icon]]:*:data-[slot=alert-description]:col-start-2",
    "*:data-[slot=alert-action]:col-start-2 has-[>svg]:*:data-[slot=alert-action]:col-start-3 has-[>[data-slot=alert-icon]]:*:data-[slot=alert-action]:col-start-3",
    "*:data-[slot=alert-dismiss]:col-start-3 has-[>svg]:*:data-[slot=alert-dismiss]:col-start-4 has-[>[data-slot=alert-icon]]:*:data-[slot=alert-dismiss]:col-start-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "",
        info: "",
        positive: "",
        attention: "",
        destructive: "",
        assistive: "",
      },
      emphasis: {
        subtle: "",
        strong: "",
      },
      appearance: {
        toast:
          "rounded-[var(--token-dimension-radius-16)] px-[var(--token-dimension-size-16)] py-[var(--token-dimension-size-12)] shadow-[0_0_0_0_var(--token-overlay-backdrop-edge),0_2px_4px_0_var(--token-overlay-backdrop-contact),0_4px_8px_0_var(--token-overlay-backdrop-ambient)]",
        banner:
          "rounded-none border-0 px-[var(--token-dimension-spacing-12)] py-[var(--token-dimension-spacing-8)] shadow-none",
      },
    },
    compoundVariants: [
      {
        emphasis: "subtle",
        appearance: "toast",
        className: "border border-solid",
      },
      {
        emphasis: "strong",
        appearance: "toast",
        className: "border border-transparent",
      },
      {
        variant: "default",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-neutral-background)] border-[var(--token-feedback-neutral-border)] text-[var(--token-feedback-neutral-foreground)] *:data-[slot=alert-description]:text-[var(--token-feedback-neutral-foreground-subtle)]",
      },
      {
        variant: "default",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-neutral-background-inverse)] text-[var(--token-feedback-neutral-foreground-inverse)] *:data-[slot=alert-description]:text-[var(--token-feedback-neutral-foreground-subtle-inverse)]",
      },
      {
        variant: "info",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-info-background)] border-[var(--token-feedback-info-border)] text-[var(--token-feedback-info-foreground)] *:data-[slot=alert-description]:text-[var(--token-feedback-info-foreground-subtle)] *:[svg]:text-[var(--token-feedback-info-status)] *:[data-slot=alert-icon]:text-[var(--token-feedback-info-status)]",
      },
      {
        variant: "info",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-info-background-inverse)] text-[var(--token-feedback-info-foreground-inverse)] *:data-[slot=alert-description]:text-[var(--token-feedback-info-foreground-subtle-inverse)]",
      },
      {
        variant: "positive",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-positive-background)] border-[var(--token-feedback-positive-border)] text-[var(--token-feedback-positive-foreground)] *:data-[slot=alert-description]:text-[var(--token-feedback-positive-foreground-subtle)] *:[svg]:text-[var(--token-feedback-positive-status)] *:[data-slot=alert-icon]:text-[var(--token-feedback-positive-status)]",
      },
      {
        variant: "positive",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-positive-background-inverse)] text-[var(--token-feedback-positive-foreground-inverse)] *:data-[slot=alert-description]:text-[var(--token-feedback-positive-foreground-subtle-inverse)]",
      },
      {
        variant: "attention",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-attention-background)] border-[var(--token-feedback-attention-border)] text-[var(--token-feedback-attention-foreground)] *:data-[slot=alert-description]:text-[var(--token-feedback-attention-foreground-subtle)] *:[svg]:text-[var(--token-feedback-attention-status)] *:[data-slot=alert-icon]:text-[var(--token-feedback-attention-status)]",
      },
      {
        variant: "attention",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-attention-background-inverse)] text-[var(--token-feedback-attention-foreground-inverse)] *:data-[slot=alert-description]:text-[var(--token-feedback-attention-foreground-subtle-inverse)]",
      },
      {
        variant: "destructive",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-destructive-background)] border-[var(--token-feedback-destructive-border)] text-[var(--token-feedback-destructive-foreground)] *:data-[slot=alert-description]:text-[var(--token-feedback-destructive-foreground-subtle)] *:[svg]:text-[var(--token-feedback-destructive-status)] *:[data-slot=alert-icon]:text-[var(--token-feedback-destructive-status)]",
      },
      {
        variant: "destructive",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-destructive-background-inverse)] text-[var(--token-feedback-destructive-foreground-inverse)] *:data-[slot=alert-description]:text-[var(--token-feedback-destructive-foreground-subtle-inverse)]",
      },
      {
        variant: "assistive",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-assistive-background)] border-[var(--token-feedback-assistive-border)] text-[var(--token-feedback-assistive-foreground)] *:data-[slot=alert-description]:text-[var(--token-feedback-assistive-foreground-subtle)] *:[svg]:text-[var(--token-feedback-assistive-status)] *:[data-slot=alert-icon]:text-[var(--token-feedback-assistive-status)]",
      },
      {
        variant: "assistive",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-assistive-background-inverse)] text-[var(--token-feedback-assistive-foreground-inverse)] *:data-[slot=alert-description]:text-[var(--token-feedback-assistive-foreground-subtle-inverse)]",
      },
    ],
    defaultVariants: {
      variant: "default",
      emphasis: "subtle",
      appearance: "toast",
    },
  }
)

export interface AlertProps
  extends Omit<React.ComponentProps<"div">, "variant">,
    Omit<VariantProps<typeof alertVariants>, "variant"> {
  variant?: AlertVariant
  dismissible?: boolean
  onDismiss?: () => void
  dismissLabel?: string
}

function Alert({
  className,
  variant = "default",
  emphasis = "subtle",
  appearance = "toast",
  dismissible = false,
  onDismiss,
  dismissLabel = "Dismiss alert",
  children,
  ...props
}: AlertProps) {
  const normalizedVariant = normalizeAlertVariant(variant)
  const showDismiss = dismissible || Boolean(onDismiss)

  return (
    <div
      data-slot="alert"
      data-variant={normalizedVariant}
      data-emphasis={emphasis}
      data-appearance={appearance}
      role="alert"
      className={cn(
        alertVariants({
          variant: normalizedVariant,
          emphasis,
          appearance,
        }),
        className
      )}
      {...props}
    >
      {children}
      {showDismiss && (
        <button
          type="button"
          data-slot="alert-dismiss"
          aria-label={dismissLabel}
          onClick={onDismiss}
          className="row-span-2 row-start-1 inline-flex size-[var(--token-dimension-size-32)] shrink-0 cursor-pointer items-center justify-center self-center rounded-[var(--token-dimension-radius-rounded)] text-current opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-focus-ring-brand)]"
        >
          <IconWrapper size="20">
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={1.75} />
          </IconWrapper>
        </button>
      )}
    </div>
  )
}

function AlertIcon({
  variant = "default",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { variant?: AlertVariant }) {
  const normalizedVariant = normalizeAlertVariant(variant)
  const defaultIcon =
    normalizedVariant === "positive"
      ? CheckmarkCircle02Icon
      : normalizedVariant === "attention"
        ? Alert01Icon
        : normalizedVariant === "destructive" ||
            normalizedVariant === "assistive"
          ? AlertDiamondIcon
          : InformationCircleIcon

  return (
    <div
      data-slot="alert-icon"
      aria-hidden="true"
      className={cn(
        "col-start-1 row-span-2 row-start-1 flex shrink-0 items-center justify-center self-center",
        className
      )}
      {...props}
    >
      <IconWrapper size="24">
        {children ?? <HugeiconsIcon icon={defaultIcon} strokeWidth={1.75} />}
      </IconWrapper>
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "row-start-1 min-w-0 font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14)] leading-[18px] font-[number:var(--token-typography-font-weight-bold)] tracking-[var(--token-typography-letter-spacing-normal)] [overflow-wrap:anywhere]",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "row-start-2 min-w-0 font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)] font-[number:var(--token-typography-font-weight-regular)] tracking-[var(--token-typography-letter-spacing-normal)] [overflow-wrap:anywhere]",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        "row-span-2 row-start-1 flex shrink-0 items-center gap-[var(--token-dimension-spacing-8)] self-center",
        className
      )}
      {...props}
    />
  )
}

export {
  Alert,
  AlertAction,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  alertVariants,
}
