import * as React from "react"
import { useMemo } from "react"
import {
  Alert02Icon,
  AlertDiamondIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { IconWrapper } from "@/components/ui/icon-wrapper"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export type FieldSize = "xs" | "sm" | "md" | "lg"
export type FieldTextSize = "sm" | "md" | "lg"
export type FieldState = "default" | "invalid" | "valid" | "alert"
export type FieldMessageType = "info" | "warning" | "error" | "success"

const FieldContext = React.createContext<{
  size: FieldSize
  state: FieldState
}>({
  size: "md",
  state: "default",
})

function toFieldTextSize(size: FieldSize): FieldTextSize {
  if (size === "xs") return "sm"
  if (size === "lg") return "lg"
  return "md"
}

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-[var(--token-dimension-spacing-24)] font-[family-name:var(--token-typography-font-family-primary)] antialiased has-[>[data-slot=checkbox-group]]:gap-[var(--token-dimension-spacing-12)] has-[>[data-slot=radio-group]]:gap-[var(--token-dimension-spacing-12)]",
        className
      )}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-[var(--token-dimension-spacing-12)] font-[family-name:var(--token-typography-font-family-primary)] font-[number:var(--token-typography-font-weight-medium)] text-[var(--token-colors-foreground-primary)] antialiased data-[variant=label]:text-[length:var(--token-typography-font-size-14)] data-[variant=label]:leading-[18px] data-[variant=legend]:text-[length:var(--token-typography-font-size-16)] data-[variant=legend]:leading-[var(--token-typography-line-height-20)]",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-[var(--token-dimension-spacing-20)] data-[slot=checkbox-group]:gap-[var(--token-dimension-spacing-12)] *:data-[slot=field-group]:gap-[var(--token-dimension-spacing-16)]",
        className
      )}
      {...props}
    />
  )
}

const fieldVariants = cva(
  "group/field flex w-full gap-[var(--token-dimension-spacing-6)] font-[family-name:var(--token-typography-font-family-primary)] antialiased",
  {
    variants: {
      orientation: {
        vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
        horizontal:
          "flex-row items-center gap-[var(--token-dimension-spacing-12)] has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        responsive:
          "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:gap-[var(--token-dimension-spacing-12)] @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
)

function Field({
  className,
  orientation = "vertical",
  size = "md",
  state = "default",
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof fieldVariants> & {
    size?: FieldSize
    state?: FieldState
  }) {
  return (
    <FieldContext.Provider value={{ size, state }}>
      <div
        role="group"
        data-slot="field"
        data-orientation={orientation}
        data-size={size}
        data-state={state}
        data-invalid={state === "invalid" ? "true" : undefined}
        className={cn(fieldVariants({ orientation }), className)}
        {...props}
      />
    </FieldContext.Provider>
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "group/field-content flex flex-1 flex-col gap-[var(--token-dimension-spacing-4)] leading-snug",
        className
      )}
      {...props}
    />
  )
}

const fieldLabelTextVariants = cva(
  "font-[family-name:var(--token-typography-font-family-primary)] font-[number:var(--token-typography-font-weight-medium)] tracking-[var(--token-typography-letter-spacing-normal)] text-[var(--token-colors-foreground-primary)] antialiased",
  {
    variants: {
      size: {
        sm: "text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)]",
        md: "text-[length:var(--token-typography-font-size-14)] leading-[18px]",
        lg: "text-[length:var(--token-typography-font-size-16)] leading-[var(--token-typography-line-height-20)]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

function FieldLabel({
  className,
  size,
  required = false,
  inlineAddon,
  children,
  ...props
}: React.ComponentProps<typeof Label> & {
  size?: FieldTextSize
  required?: boolean
  inlineAddon?: React.ReactNode
}) {
  const context = React.useContext(FieldContext)
  const resolvedSize = size ?? toFieldTextSize(context.size)

  return (
    <Label
      data-slot="field-label"
      data-size={resolvedSize}
      className={cn(
        "group/field-label peer/field-label flex w-fit items-center gap-[var(--token-dimension-spacing-4)] group-data-[disabled=true]/field:opacity-50",
        "has-data-checked:bg-input/30 has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-2xl has-[>[data-slot=field]]:border has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-input/40 has-[>[data-slot=field]]:has-[:focus-visible]:border-ring has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 *:data-[slot=field]:p-4",
        fieldLabelTextVariants({ size: resolvedSize }),
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {required && (
        <span
          aria-hidden="true"
          className={cn(
            "font-[number:var(--token-typography-font-weight-regular)] text-[var(--token-colors-foreground-destructive-muted)]",
            resolvedSize === "lg"
              ? "text-[length:var(--token-typography-font-size-16)] leading-[var(--token-typography-line-height-20)]"
              : "text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)]"
          )}
        >
          *
        </span>
      )}
      {inlineAddon && (
        <span className="inline-flex items-center gap-[var(--token-dimension-spacing-8)]">
          {inlineAddon}
        </span>
      )}
    </Label>
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-[var(--token-dimension-spacing-8)] font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14)] leading-[18px] font-[number:var(--token-typography-font-weight-medium)] text-[var(--token-colors-foreground-primary)] antialiased group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  )
}

const fieldDescriptionVariants = cva(
  "text-left font-[family-name:var(--token-typography-font-family-primary)] font-[number:var(--token-typography-font-weight-regular)] tracking-[var(--token-typography-letter-spacing-normal)] text-[var(--token-colors-foreground-secondary)] antialiased group-has-data-horizontal/field:text-balance [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-[var(--token-colors-foreground-primary)]",
  {
    variants: {
      size: {
        sm: "text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)]",
        md: "text-[length:var(--token-typography-font-size-14)] leading-[18px]",
        lg: "text-[length:var(--token-typography-font-size-16)] leading-[var(--token-typography-line-height-20)]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

function FieldDescription({
  className,
  size,
  ...props
}: React.ComponentProps<"p"> & { size?: FieldTextSize }) {
  const context = React.useContext(FieldContext)
  const resolvedSize = size ?? toFieldTextSize(context.size)

  return (
    <p
      data-slot="field-description"
      data-size={resolvedSize}
      className={cn(fieldDescriptionVariants({ size: resolvedSize }), className)}
      {...props}
    />
  )
}

const fieldMessageVariants = cva(
  "flex items-center gap-[var(--token-dimension-spacing-4)] font-[family-name:var(--token-typography-font-family-primary)] font-[number:var(--token-typography-font-weight-regular)] text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)] tracking-[var(--token-typography-letter-spacing-normal)] antialiased",
  {
    variants: {
      messageType: {
        info: "text-[var(--token-colors-foreground-informative-muted)]",
        warning: "text-[var(--token-colors-foreground-attention-muted)]",
        error: "text-[var(--token-colors-foreground-destructive-muted)]",
        success: "text-[var(--token-colors-foreground-positive-muted)]",
      },
    },
    defaultVariants: {
      messageType: "info",
    },
  }
)

function FieldMessage({
  className,
  messageType = "info",
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldMessageVariants>) {
  const icon =
    messageType === "success"
      ? CheckmarkCircle02Icon
      : messageType === "warning"
        ? Alert02Icon
        : messageType === "error"
          ? AlertDiamondIcon
          : InformationCircleIcon

  return (
    <div
      data-slot="field-message"
      data-message-type={messageType}
      role={messageType === "error" ? "alert" : undefined}
      className={cn(fieldMessageVariants({ messageType }), className)}
      {...props}
    >
      <IconWrapper size="16" aria-hidden="true">
        <HugeiconsIcon icon={icon} strokeWidth={1.75} />
      </IconWrapper>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</span>
    </div>
  )
}

function FieldFeedback({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-feedback"
      className={cn(
        "flex flex-col items-start gap-[var(--token-dimension-spacing-4)]",
        className
      )}
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
        className
      )}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const content = useMemo(() => {
    if (children) {
      return children
    }

    if (!errors?.length) {
      return null
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ]

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    )
  }, [children, errors])

  if (!content) {
    return null
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn(
        "font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)] font-[number:var(--token-typography-font-weight-regular)] text-[var(--token-colors-foreground-destructive-muted)] antialiased",
        className
      )}
      {...props}
    >
      {content}
    </div>
  )
}

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldFeedback,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldMessage,
  FieldSeparator,
  FieldSet,
  FieldTitle,
}
