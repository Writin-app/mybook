"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { cva, type VariantProps } from "class-variance-authority"
import {
  Alert01Icon,
  AlertDiamondIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { IconWrapper } from "@/components/ui/icon-wrapper"

const toast = ToastPrimitive.createToastManager()

export type ToastIntent =
  | "default"
  | "info"
  | "positive"
  | "attention"
  | "destructive"
  | "assistive"

export type ToastEmphasis = "subtle" | "strong"

type ToastDataMeta = {
  emphasis?: ToastEmphasis
  showIcon?: boolean
}

function normalizeToastIntent(type?: string | null): ToastIntent {
  switch (type) {
    case "success":
    case "positive":
      return "positive"
    case "warning":
    case "attention":
      return "attention"
    case "error":
    case "destructive":
      return "destructive"
    case "assistive":
      return "assistive"
    case "info":
    case "loading":
      return "info"
    case "neutral":
    case "default":
    case undefined:
    case null:
    default:
      return "default"
  }
}

const toastVariants = cva(
  [
    "group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom",
    "rounded-[var(--token-dimension-radius-16)] border border-solid",
    "font-[family-name:var(--token-typography-font-family-primary)] antialiased",
    "shadow-[0_0_0_0_var(--token-overlay-backdrop-edge),0_2px_4px_0_var(--token-overlay-backdrop-contact),0_4px_8px_0_var(--token-overlay-backdrop-ambient)]",
    "will-change-transform outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--token-focus-ring-brand)]",
    "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
    "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms]",
    "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
    "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
    "data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]",
    "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
    "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
    "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
    "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
    "data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
    "data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
    "data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
    "data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
    "data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
  ].join(" "),
  {
    variants: {
      intent: {
        default: "",
        info: "",
        positive: "",
        attention: "",
        destructive: "",
        assistive: "",
      },
      emphasis: {
        subtle: "",
        strong: "border-transparent",
      },
    },
    compoundVariants: [
      {
        intent: "default",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-neutral-background)] border-[var(--token-feedback-neutral-border)] text-[var(--token-feedback-neutral-foreground)] **:data-[slot=toast-description]:text-[var(--token-feedback-neutral-foreground-subtle)]",
      },
      {
        intent: "default",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-neutral-background-inverse)] text-[var(--token-feedback-neutral-foreground-inverse)] **:data-[slot=toast-description]:text-[var(--token-feedback-neutral-foreground-subtle-inverse)]",
      },
      {
        intent: "info",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-info-background)] border-[var(--token-feedback-info-border)] text-[var(--token-feedback-info-foreground)] **:data-[slot=toast-description]:text-[var(--token-feedback-info-foreground-subtle)] **:data-[slot=toast-icon]:text-[var(--token-feedback-info-status)]",
      },
      {
        intent: "info",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-info-background-inverse)] text-[var(--token-feedback-info-foreground-inverse)] **:data-[slot=toast-description]:text-[var(--token-feedback-info-foreground-subtle-inverse)]",
      },
      {
        intent: "positive",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-positive-background)] border-[var(--token-feedback-positive-border)] text-[var(--token-feedback-positive-foreground)] **:data-[slot=toast-description]:text-[var(--token-feedback-positive-foreground-subtle)] **:data-[slot=toast-icon]:text-[var(--token-feedback-positive-status)]",
      },
      {
        intent: "positive",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-positive-background-inverse)] text-[var(--token-feedback-positive-foreground-inverse)] **:data-[slot=toast-description]:text-[var(--token-feedback-positive-foreground-subtle-inverse)]",
      },
      {
        intent: "attention",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-attention-background)] border-[var(--token-feedback-attention-border)] text-[var(--token-feedback-attention-foreground)] **:data-[slot=toast-description]:text-[var(--token-feedback-attention-foreground-subtle)] **:data-[slot=toast-icon]:text-[var(--token-feedback-attention-status)]",
      },
      {
        intent: "attention",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-attention-background-inverse)] text-[var(--token-feedback-attention-foreground-inverse)] **:data-[slot=toast-description]:text-[var(--token-feedback-attention-foreground-subtle-inverse)]",
      },
      {
        intent: "destructive",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-destructive-background)] border-[var(--token-feedback-destructive-border)] text-[var(--token-feedback-destructive-foreground)] **:data-[slot=toast-description]:text-[var(--token-feedback-destructive-foreground-subtle)] **:data-[slot=toast-icon]:text-[var(--token-feedback-destructive-status)]",
      },
      {
        intent: "destructive",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-destructive-background-inverse)] text-[var(--token-feedback-destructive-foreground-inverse)] **:data-[slot=toast-description]:text-[var(--token-feedback-destructive-foreground-subtle-inverse)]",
      },
      {
        intent: "assistive",
        emphasis: "subtle",
        className:
          "bg-[var(--token-feedback-assistive-background)] border-[var(--token-feedback-assistive-border)] text-[var(--token-feedback-assistive-foreground)] **:data-[slot=toast-description]:text-[var(--token-feedback-assistive-foreground-subtle)] **:data-[slot=toast-icon]:text-[var(--token-feedback-assistive-status)]",
      },
      {
        intent: "assistive",
        emphasis: "strong",
        className:
          "bg-[var(--token-feedback-assistive-background-inverse)] text-[var(--token-feedback-assistive-foreground-inverse)] **:data-[slot=toast-description]:text-[var(--token-feedback-assistive-foreground-subtle-inverse)]",
      },
    ],
    defaultVariants: {
      intent: "default",
      emphasis: "subtle",
    },
  }
)

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider {...props} />
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-md outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full",
        className
      )}
      {...props}
    />
  )
}

function Toast({
  className,
  intent,
  emphasis,
  toast: toastProp,
  ...props
}: ToastPrimitive.Root.Props & VariantProps<typeof toastVariants>) {
  const dataMeta = (toastProp?.data ?? {}) as ToastDataMeta
  const resolvedIntent = intent ?? normalizeToastIntent(toastProp?.type)
  const resolvedEmphasis = emphasis ?? dataMeta.emphasis ?? "subtle"

  return (
    <ToastPrimitive.Root
      data-slot="toast"
      data-intent={resolvedIntent}
      data-emphasis={resolvedEmphasis}
      toast={toastProp}
      className={cn(
        toastVariants({ intent: resolvedIntent, emphasis: resolvedEmphasis }),
        className
      )}
      {...props}
    />
  )
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn(
        "flex h-full items-center gap-[var(--token-dimension-spacing-8)] overflow-hidden px-[var(--token-dimension-size-16)] py-[var(--token-dimension-size-12)] transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-behind:opacity-0 data-expanded:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn(
        "font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14)] leading-[18px] font-[number:var(--token-typography-font-weight-bold)] tracking-[var(--token-typography-letter-spacing-normal)] [overflow-wrap:anywhere]",
        className
      )}
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn(
        "font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)] font-[number:var(--token-typography-font-weight-regular)] tracking-[var(--token-typography-letter-spacing-normal)] [overflow-wrap:anywhere]",
        className
      )}
      {...props}
    />
  )
}

function ToastAction({
  className,
  render = <Button variant="outline" size="sm" />,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      render={render}
      className={cn("shrink-0", className)}
      {...props}
    />
  )
}

function ToastClose({
  className,
  children,
  ...props
}: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Close toast"
      className={cn(
        "relative inline-flex size-[var(--token-dimension-size-32)] shrink-0 cursor-pointer items-center justify-center rounded-[var(--token-dimension-radius-rounded)] text-current opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-focus-ring-brand)]",
        className
      )}
      {...props}
    >
      {children ?? (
        <IconWrapper size="20">
          <HugeiconsIcon
            aria-hidden="true"
            icon={Cancel01Icon}
            strokeWidth={1.75}
          />
        </IconWrapper>
      )}
    </ToastPrimitive.Close>
  )
}

function ToastIcon({ type }: { type: string | undefined }) {
  if (type === "loading") {
    return (
      <span
        data-slot="toast-icon"
        aria-hidden="true"
        className="flex shrink-0 items-center justify-center"
      >
        <IconWrapper size="24">
          <HugeiconsIcon
            icon={Loading03Icon}
            strokeWidth={1.75}
            className="animate-spin"
          />
        </IconWrapper>
      </span>
    )
  }

  const normalized = normalizeToastIntent(type)
  const icon =
    normalized === "positive"
      ? CheckmarkCircle02Icon
      : normalized === "attention"
        ? Alert01Icon
        : normalized === "destructive" || normalized === "assistive"
          ? AlertDiamondIcon
          : InformationCircleIcon

  return (
    <span
      data-slot="toast-icon"
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center"
    >
      <IconWrapper size="24">
        <HugeiconsIcon icon={icon} strokeWidth={1.75} />
      </IconWrapper>
    </span>
  )
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()

  return toasts.map((toastItem) => {
    const dataMeta = (toastItem.data ?? {}) as ToastDataMeta
    const showIcon = dataMeta.showIcon !== false

    return (
      <Toast key={toastItem.id} toast={toastItem}>
        <ToastContent>
          {showIcon && <ToastIcon type={toastItem.type} />}
          <div className="flex min-w-0 flex-1 flex-col gap-[var(--token-dimension-spacing-2)]">
            <ToastTitle />
            <ToastDescription />
          </div>
          <ToastAction {...toastItem.actionProps} />
          <ToastClose />
        </ToastContent>
      </Toast>
    )
  })
}

function Toaster({
  children,
  toastManager = toast,
  ...props
}: ToastPrimitive.Provider.Props) {
  return (
    <ToastProvider toastManager={toastManager} {...props}>
      {children}
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  )
}

const createToastManager = ToastPrimitive.createToastManager
const useToastManager = ToastPrimitive.useToastManager

export {
  Toaster,
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  createToastManager,
  toast,
  toastVariants,
  useToastManager,
}
