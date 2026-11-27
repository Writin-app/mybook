import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { HugeiconsIcon } from "@hugeicons/react"
import { LinkSquare02Icon, FavouriteIcon, MoreHorizontalSquare01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"

// ─── ListItemMedia ─────────────────────────────────────────────────────────────

export type ListItemMediaType = "avatar" | "icon" | "document" | "image"

export interface ListItemMediaProps extends React.ComponentProps<"div"> {
  mediaType?: ListItemMediaType
}

function ListItemMedia({
  className,
  mediaType = "icon",
  ...props
}: ListItemMediaProps) {
  return (
    <div
      data-slot="list-item-media"
      data-media-type={mediaType}
      className={cn(
        "flex shrink-0 items-center justify-center",
        mediaType === "image" &&
          "overflow-hidden rounded-[var(--token-dimension-radius-8,8px)] [&_img]:size-full [&_img]:object-cover",
        className
      )}
      {...props}
    />
  )
}

// ─── ListItemActions ───────────────────────────────────────────────────────────

export interface ListItemActionsProps extends React.ComponentProps<"div"> {
  align?: "left" | "right"
}

function ListItemActions({
  className,
  align = "left",
  ...props
}: ListItemActionsProps) {
  return (
    <div
      data-slot="list-item-actions"
      className={cn(
        "flex items-center gap-[var(--token-dimension-spacing-8,8px)]",
        align === "right" && "ml-auto",
        className
      )}
      {...props}
    />
  )
}

/** Default action buttons used in list items */
function ListItemDefaultActions({ size = "md" }: { size?: ListItemSize }) {
  const btnSize = size === "lg" ? "size-10" : "size-8"
  return (
    <>
      <Button variant="ghost" size="icon" className={cn(btnSize, "rounded-full p-0")} aria-label="Open link">
        <HugeiconsIcon icon={LinkSquare02Icon} size={16} color="currentColor" strokeWidth={1.5} />
      </Button>
      <Button variant="ghost" size="icon" className={cn(btnSize, "rounded-full p-0")} aria-label="Favorite">
        <HugeiconsIcon icon={FavouriteIcon} size={16} color="currentColor" strokeWidth={1.5} />
      </Button>
      <Button variant="ghost" size="icon" className={cn(btnSize, "rounded-full p-0")} aria-label="More options">
        <HugeiconsIcon icon={MoreHorizontalSquare01Icon} size={16} color="currentColor" strokeWidth={1.5} />
      </Button>
    </>
  )
}

// ─── ListItemFooter ─────────────────────────────────────────────────────────────

function ListItemFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="list-item-footer"
      className={cn(
        "flex w-full items-center justify-between gap-[var(--token-dimension-spacing-8,8px)]",
        className
      )}
      {...props}
    />
  )
}

// ─── ListItem ──────────────────────────────────────────────────────────────────

const listItemVariants = cva(
  [
    "group/list-item relative flex w-full overflow-hidden",
    "transition-colors duration-100",
    "outline-none",
    "focus-visible:ring-2 focus-visible:ring-[var(--token-colors-border-focus)]",
    "cursor-pointer select-none",
  ],
  {
    variants: {
      orientation: {
        horizontal: "flex-row items-center",
        vertical: "flex-col",
      },
      size: {
        sm: [
          "rounded-[var(--token-dimension-radius-10,10px)]",
          "px-[var(--token-dimension-spacing-12,12px)]",
          "py-[var(--token-dimension-spacing-8,8px)]",
          "gap-[var(--token-dimension-spacing-8,8px)]",
        ],
        md: [
          "rounded-[var(--token-dimension-radius-12,12px)]",
          "px-[var(--token-dimension-spacing-12,12px)]",
          "py-[var(--token-dimension-spacing-10,10px)]",
          "gap-[var(--token-dimension-spacing-10,10px)]",
        ],
        lg: [
          "rounded-[var(--token-dimension-radius-16,16px)]",
          "px-[var(--token-dimension-spacing-16,16px)]",
          "py-[var(--token-dimension-spacing-12,12px)]",
          "gap-[var(--token-dimension-spacing-12,12px)]",
        ],
      },
      variant: {
        default:
          "bg-[var(--token-colors-background-default)] border border-transparent hover:bg-[var(--token-colors-background-quiet)]",
        muted: "bg-[var(--token-colors-background-quiet)] border border-transparent",
        outline:
          "bg-transparent border border-[var(--token-colors-border-primary)] hover:bg-[var(--token-colors-background-quiet)]",
      },
      state: {
        default: "",
        hover: "bg-[var(--token-colors-background-quiet)]",
        focus: "ring-2 ring-[var(--token-colors-border-focus)]",
        selected:
          "bg-[var(--token-colors-background-informative-quiet,#eaf3ff)] border-[var(--token-colors-border-informative-subtle)]",
        disabled: "opacity-50 pointer-events-none",
      },
    },
    compoundVariants: [
      { orientation: "horizontal", size: "sm", className: "min-h-[48px]" },
      { orientation: "horizontal", size: "md", className: "min-h-[56px]" },
      { orientation: "horizontal", size: "lg", className: "min-h-[64px]" },
      { orientation: "vertical", size: "sm", className: "min-h-[152px]" },
      { orientation: "vertical", size: "md", className: "min-h-[174px]" },
      { orientation: "vertical", size: "lg", className: "min-h-[196px]" },
    ],
    defaultVariants: {
      orientation: "horizontal",
      size: "md",
      variant: "default",
      state: "default",
    },
  }
)

const TITLE_SIZE_CLASSES: Record<ListItemSize, string> = {
  sm: "text-[length:var(--token-typography-font-size-12,12px)] leading-[var(--token-typography-line-height-16,16px)]",
  md: "text-[length:var(--token-typography-font-size-14,14px)] leading-[18px]",
  lg: "text-[length:var(--token-typography-font-size-16,16px)] leading-[var(--token-typography-line-height-20,20px)]",
}

const DESCRIPTION_SIZE_CLASSES: Record<ListItemSize, string> = {
  sm: "text-[length:var(--token-typography-font-size-10,10px)] leading-[14px]",
  md: "text-[length:var(--token-typography-font-size-12,12px)] leading-[var(--token-typography-line-height-16,16px)]",
  lg: "text-[length:var(--token-typography-font-size-14,14px)] leading-[18px]",
}

export type ListItemOrientation = "horizontal" | "vertical"
export type ListItemSize = "sm" | "md" | "lg"
export type ListItemVariant = "default" | "muted" | "outline"
export type ListItemState = "default" | "hover" | "focus" | "selected" | "disabled"
export type ListItemSelection = "none" | "single" | "multi"

export interface ListItemProps
  extends Omit<React.ComponentProps<"div">, "children" | "title">,
    VariantProps<typeof listItemVariants> {
  orientation?: ListItemOrientation
  size?: ListItemSize
  variant?: ListItemVariant
  state?: ListItemState
  selection?: ListItemSelection
  selected?: boolean
  disabled?: boolean
  actionsVisibility?: "always" | "hover"
  media?: React.ReactNode
  actions?: React.ReactNode
  footer?: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
}

function ListItem({
  className,
  orientation = "horizontal",
  size = "md",
  variant = "default",
  state = "default",
  selection = "none",
  selected = false,
  disabled = false,
  actionsVisibility = "always",
  media,
  actions,
  footer,
  title,
  description,
  children,
  ...props
}: ListItemProps) {
  const computedState: ListItemState = disabled
    ? "disabled"
    : selected
      ? "selected"
      : state

  const supportsAriaSelected =
    props.role === "option" ||
    props.role === "row" ||
    props.role === "gridcell" ||
    props.role === "tab"

  const isInteractiveContainer = Boolean(props.onClick || props.role)

  return (
    <div
      data-slot="list-item"
      data-orientation={orientation}
      data-size={size}
      data-variant={variant}
      data-state={computedState}
      data-selection={selection}
      data-selected={selected || undefined}
      aria-selected={supportsAriaSelected ? selected : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={
        props.tabIndex ??
        (isInteractiveContainer ? (disabled ? -1 : 0) : undefined)
      }
      onKeyDown={(e) => {
        props.onKeyDown?.(e)
        if (
          !e.defaultPrevented &&
          !disabled &&
          props.onClick &&
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault()
          props.onClick(e as unknown as React.MouseEvent<HTMLDivElement>)
        }
      }}
      className={cn(
        listItemVariants({ orientation, size, variant, state: computedState }),
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          {/* Selection control */}
          {selection !== "none" && (
            <div className="flex shrink-0 items-center justify-center">
              {selection === "multi" ? (
                <Checkbox
                  checked={selected}
                  disabled={disabled}
                  aria-label={
                    typeof title === "string" ? `Select ${title}` : "Select item"
                  }
                />
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                    selected
                      ? "border-[var(--token-colors-background-informative)] bg-[var(--token-colors-background-informative)]"
                      : "border-[var(--token-colors-border-primary)] bg-transparent"
                  )}
                >
                  {selected && (
                    <span className="size-1.5 rounded-full bg-[var(--token-colors-foreground-primary-inverse,#ffffff)]" />
                  )}
                </span>
              )}
            </div>
          )}

          {/* Horizontal layout */}
          {orientation === "horizontal" && (
            <>
              {media && (
                <div className="flex shrink-0 items-center justify-center">
                  {media}
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-[var(--token-dimension-spacing-2,2px)]">
                {title && (
                  <div
                    data-slot="list-item-title"
                    className={cn(
                      "font-[family-name:var(--token-typography-font-family-primary)]",
                      "font-[number:var(--token-typography-font-weight-semibold,600)]",
                      "tracking-[var(--token-typography-letter-spacing-normal,0px)] antialiased",
                      "text-[var(--token-colors-foreground-primary)]",
                      "line-clamp-1 truncate",
                      TITLE_SIZE_CLASSES[size]
                    )}
                  >
                    {title}
                  </div>
                )}
                {description && (
                  <div
                    data-slot="list-item-description"
                    className={cn(
                      "font-[family-name:var(--token-typography-font-family-primary)]",
                      "font-[number:var(--token-typography-font-weight-regular,400)]",
                      "tracking-[var(--token-typography-letter-spacing-normal,0px)] antialiased",
                      "text-[var(--token-colors-foreground-secondary)]",
                      "line-clamp-1 truncate",
                      DESCRIPTION_SIZE_CLASSES[size]
                    )}
                  >
                    {description}
                  </div>
                )}
              </div>
              {actions && (
                <div
                  className={cn(
                    "flex shrink-0 items-center gap-[var(--token-dimension-spacing-8,8px)]",
                    actionsVisibility === "hover" &&
                      "opacity-0 transition-opacity duration-100 group-hover/list-item:opacity-100 group-focus-visible/list-item:opacity-100"
                  )}
                >
                  {actions}
                </div>
              )}
            </>
          )}

          {/* Vertical layout */}
          {orientation === "vertical" && (
            <>
              {media && (
                <div className="flex w-full shrink-0 items-start justify-start">
                  {media}
                </div>
              )}
              <div className="flex w-full min-w-0 flex-1 flex-col gap-[var(--token-dimension-spacing-2,2px)]">
                {title && (
                  <div
                    data-slot="list-item-title"
                    className={cn(
                      "font-[family-name:var(--token-typography-font-family-primary)]",
                      "font-[number:var(--token-typography-font-weight-semibold,600)]",
                      "tracking-[var(--token-typography-letter-spacing-normal,0px)] antialiased",
                      "text-[var(--token-colors-foreground-primary)]",
                      "line-clamp-2",
                      TITLE_SIZE_CLASSES[size]
                    )}
                  >
                    {title}
                  </div>
                )}
                {description && (
                  <div
                    data-slot="list-item-description"
                    className={cn(
                      "font-[family-name:var(--token-typography-font-family-primary)]",
                      "font-[number:var(--token-typography-font-weight-regular,400)]",
                      "tracking-[var(--token-typography-letter-spacing-normal,0px)] antialiased",
                      "text-[var(--token-colors-foreground-secondary)]",
                      "line-clamp-2",
                      DESCRIPTION_SIZE_CLASSES[size]
                    )}
                  >
                    {description}
                  </div>
                )}
              </div>
              {footer && (
                <>
                  <Separator orientation="horizontal" className="my-0 w-full" />
                  <ListItemFooter>{footer}</ListItemFooter>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export {
  ListItem,
  ListItemMedia,
  ListItemActions,
  ListItemFooter,
  ListItemDefaultActions,
}
