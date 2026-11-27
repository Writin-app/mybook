import * as React from "react"
import { NavLink } from "react-router-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalSquare01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconWrapper } from "@/components/ui/icon-wrapper"
import { InlineLink } from "@/components/ui/inline-link"
import { Separator } from "@/components/ui/separator"

// ─── TrailingContent ───────────────────────────────────────────────────────────

export type TrailingContentType = "badge" | "count" | "kbd"
export type NavItemSize = "sm" | "md"

export interface TrailingContentProps {
  type?: TrailingContentType
  size?: NavItemSize
  label?: string
  className?: string
}

function TrailingContent({
  type = "badge",
  size = "sm",
  label,
  className,
}: TrailingContentProps) {
  const resolvedLabel =
    label ?? (type === "count" ? "01" : type === "kbd" ? "⌘C" : "Badge")

  if (type === "kbd") {
    return (
      <kbd
        data-slot="trailing-content"
        data-type="kbd"
        data-size={size}
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          "font-[family-name:var(--token-typography-font-family-primary)]",
          "font-[number:var(--token-typography-font-weight-regular,400)]",
          "tracking-[var(--token-typography-letter-spacing-normal,0px)] antialiased",
          "text-[var(--token-colors-foreground-elevated)]",
          size === "sm"
            ? "text-[length:var(--token-typography-font-size-12,12px)] leading-[var(--token-typography-line-height-16,16px)]"
            : "text-[length:var(--token-typography-font-size-14,14px)] leading-[18px]",
          className
        )}
      >
        {resolvedLabel}
      </kbd>
    )
  }

  return (
    <span
      data-slot="trailing-content"
      data-type={type}
      data-size={size}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
    >
      <Badge
        variant={type === "count" ? "secondary" : "default"}
        emphasis="strong"
        size={size}
      >
        {resolvedLabel}
      </Badge>
    </span>
  )
}

// ─── NavItem ───────────────────────────────────────────────────────────────────

export type NavItemState = "default" | "hover" | "active" | "focus" | "disabled"

export interface NavItemTrailingAction {
  label: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  icon?: React.ReactNode
}

export interface NavItemProps {
  label: string
  to?: string
  onClick?: (e: React.MouseEvent<HTMLElement>) => void
  ariaLabel?: string
  icon?: React.ReactNode
  leading?: boolean
  size?: NavItemSize
  state?: NavItemState
  active?: boolean
  disabled?: boolean
  trailingContent?: TrailingContentProps | React.ReactNode
  trailingAction?: NavItemTrailingAction | boolean
  className?: string
}

function isTrailingContentConfig(
  value: NavItemProps["trailingContent"]
): value is TrailingContentProps {
  return (
    typeof value === "object" &&
    value !== null &&
    !React.isValidElement(value) &&
    ("type" in value || "label" in value || "size" in value)
  )
}

function NavItem({
  label,
  to,
  onClick,
  ariaLabel = label,
  icon,
  leading = true,
  size = "sm",
  state = "default",
  active = false,
  disabled = false,
  trailingContent,
  trailingAction,
  className,
}: NavItemProps) {
  const computedState: NavItemState = disabled
    ? "disabled"
    : active
      ? "active"
      : state

  const isActive = computedState === "active"
  const isDisabled = computedState === "disabled"

  const containerClasses = cn(
    "group/nav-item relative flex w-full items-center overflow-hidden select-none",
    "gap-[var(--token-dimension-spacing-6,6px)]",
    "rounded-[var(--token-dimension-radius-8,8px)]",
    "px-[var(--token-dimension-spacing-12,12px)]",
    "py-[var(--token-dimension-spacing-6,6px)]",
    "transition-colors duration-100 outline-none",
    "focus-visible:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)]",
    size === "sm"
      ? "h-[var(--token-dimension-size-32,32px)]"
      : "h-[var(--token-dimension-size-40,40px)]",
    computedState === "default" &&
      "text-[var(--token-colors-foreground-secondary)] hover:bg-[var(--token-colors-background-muted)]",
    computedState === "hover" &&
      "bg-[var(--token-colors-background-muted)] text-[var(--token-colors-foreground-secondary)]",
    computedState === "active" &&
      "bg-[var(--token-colors-background-subtle)] text-[var(--token-colors-foreground-primary)]",
    computedState === "focus" &&
      "bg-transparent text-[var(--token-colors-foreground-secondary)] shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)]",
    computedState === "disabled" &&
      "pointer-events-none text-[var(--token-colors-foreground-quiet)]",
    className
  )

  const iconWrapperSize = size === "sm" ? "20" : "24"

  const renderedTrailingContent = trailingContent ? (
    isTrailingContentConfig(trailingContent) ? (
      <TrailingContent
        size={trailingContent.size ?? size}
        type={trailingContent.type}
        label={trailingContent.label}
        className={cn(isDisabled && "opacity-30", trailingContent.className)}
      />
    ) : (
      <span className={cn("shrink-0", isDisabled && "opacity-30")}>
        {trailingContent}
      </span>
    )
  ) : null

  const actionConfig: NavItemTrailingAction | null =
    trailingAction === true
      ? { label: `More options for ${label}` }
      : trailingAction && typeof trailingAction === "object"
        ? trailingAction
        : null

  const triggerBody = (
    <>
      {leading && icon && (
        <span className="flex shrink-0 items-center justify-center">
          <IconWrapper size={iconWrapperSize}>{icon}</IconWrapper>
        </span>
      )}

      <span
        data-slot="nav-item-label"
        className={cn(
          "min-w-0 flex-1 truncate text-left",
          "font-[family-name:var(--token-typography-font-family-primary)]",
          "font-[number:var(--token-typography-font-weight-medium,500)]",
          "tracking-[var(--token-typography-letter-spacing-normal,0px)] antialiased",
          size === "sm"
            ? "text-[length:var(--token-typography-font-size-14,14px)] leading-[18px]"
            : "text-[length:var(--token-typography-font-size-16,16px)] leading-[var(--token-typography-line-height-20,20px)]"
        )}
      >
        {label}
      </span>

      {renderedTrailingContent}
    </>
  )

  const triggerClasses = cn(
    "flex min-w-0 flex-1 items-center gap-[var(--token-dimension-spacing-6,6px)] text-left outline-none",
    "focus-visible:outline-none"
  )

  const rowClasses = cn(
    containerClasses,
    "focus-visible:shadow-none has-[>[data-slot=nav-item-trigger]:focus-visible]:bg-transparent has-[>[data-slot=nav-item-trigger]:focus-visible]:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)]"
  )

  return (
    <div
      data-slot="nav-item"
      data-size={size}
      data-state={computedState}
      className={rowClasses}
    >
      {isActive && (
        <span
          aria-hidden="true"
          data-slot="nav-item-indicator"
          className={cn(
            "pointer-events-none absolute left-[4px] top-1/2 -translate-y-1/2",
            "w-[var(--token-dimension-spacing-4,4px)] rounded-[30px]",
            "bg-[var(--token-feedback-info-foreground,#0473eb)]",
            size === "sm"
              ? "h-[var(--token-dimension-spacing-12,12px)]"
              : "h-[var(--token-dimension-spacing-16,16px)]"
          )}
        />
      )}

      {to && !isDisabled ? (
        <NavLink
          to={to}
          data-slot="nav-item-trigger"
          aria-label={ariaLabel}
          aria-current={isActive ? "page" : undefined}
          onClick={onClick}
          className={triggerClasses}
        >
          {triggerBody}
        </NavLink>
      ) : (
        <button
          type="button"
          data-slot="nav-item-trigger"
          disabled={isDisabled}
          aria-label={ariaLabel}
          aria-current={isActive ? "page" : undefined}
          onClick={isDisabled ? undefined : onClick}
          className={triggerClasses}
        >
          {triggerBody}
        </button>
      )}

      {actionConfig && (
        <span
          data-slot="nav-item-action"
          className="flex shrink-0 items-center gap-[var(--token-dimension-spacing-6,6px)]"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={isDisabled}
            aria-label={actionConfig.label}
            onClick={(e) => {
              e.stopPropagation()
              actionConfig.onClick?.(e)
            }}
            className="text-[var(--token-colors-foreground-secondary)]"
          >
            {actionConfig.icon ?? (
              <HugeiconsIcon
                icon={MoreHorizontalSquare01Icon}
                size={16}
                color="currentColor"
                strokeWidth={1.5}
              />
            )}
          </Button>
        </span>
      )}
    </div>
  )
}

// ─── NavGroup ──────────────────────────────────────────────────────────────────

export interface NavGroupProps extends React.ComponentProps<"div"> {
  title?: string
  showTitle?: boolean
  actionLabel?: string
  onActionClick?: () => void
  actionHref?: string
  showSeparator?: boolean
}

function NavGroup({
  title,
  showTitle = true,
  actionLabel,
  onActionClick,
  actionHref,
  showSeparator = true,
  className,
  children,
  ...props
}: NavGroupProps) {
  const titleId = React.useId()
  const hasVisibleTitle = Boolean(showTitle && title)

  return (
    <div
      role="group"
      aria-labelledby={hasVisibleTitle ? titleId : undefined}
      data-slot="nav-group"
      className={cn(
        "flex w-full flex-col items-start gap-[var(--token-dimension-spacing-2,2px)]",
        className
      )}
      {...props}
    >
      {showTitle && (title || actionLabel) && (
        <div
          data-slot="nav-group-header"
          className="flex w-full items-center gap-[var(--token-dimension-spacing-4,4px)] px-[var(--token-dimension-spacing-8,8px)] py-[var(--token-dimension-spacing-4,4px)]"
        >
          {title && (
            <p
              id={titleId}
              data-slot="nav-group-title"
              className={cn(
                "min-w-0 flex-1 truncate",
                "font-[family-name:var(--token-typography-font-family-primary)]",
                "font-[number:var(--token-typography-font-weight-medium,500)]",
                "text-[length:var(--token-typography-font-size-12,12px)]",
                "leading-[var(--token-typography-line-height-16,16px)]",
                "tracking-[var(--token-typography-letter-spacing-normal,0px)] antialiased",
                "text-[var(--token-colors-foreground-elevated)]"
              )}
            >
              {title}
            </p>
          )}
          {actionLabel && (
            <InlineLink
              size="sm"
              variant="primary"
              href={actionHref}
              render={actionHref ? undefined : <button type="button" />}
              onClick={onActionClick}
            >
              {actionLabel}
            </InlineLink>
          )}
        </div>
      )}

      <div
        data-slot="nav-group-items"
        className="flex w-full flex-col items-start gap-[var(--token-dimension-spacing-2,2px)]"
      >
        {children}
      </div>

      {showSeparator && (
        <div
          data-slot="nav-group-separator"
          className="flex h-[16px] w-full shrink-0 items-center"
        >
          <Separator orientation="horizontal" />
        </div>
      )}
    </div>
  )
}

export {
  TrailingContent,
  NavItem,
  NavGroup,
  // Sidenav* aliases for convenience
  TrailingContent as SidenavTrailingContent,
  NavItem as SidenavNavItem,
  NavGroup as SidenavNavItemGroup,
}
