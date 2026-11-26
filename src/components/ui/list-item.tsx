import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { HugeiconsIcon } from "@hugeicons/react"
import { LinkSquare02Icon, FavouriteIcon, MoreHorizontalSquare01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
        mediaType === "image" && "overflow-hidden rounded-[var(--token-dimension-radius-8,8px)] [&_img]:size-full [&_img]:object-cover",
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
        "flex items-center gap-[var(--token-dimension-spacing-4,4px)]",
        align === "right" && "ml-auto",
        className
      )}
      {...props}
    />
  )
}

/** Default action buttons used in list items */
function ListItemDefaultActions() {
  return (
    <>
      <Button variant="ghost" size="xs" className="size-7 p-0">
        <HugeiconsIcon icon={LinkSquare02Icon} size={14} color="currentColor" strokeWidth={1.5} />
      </Button>
      <Button variant="ghost" size="xs" className="size-7 p-0">
        <HugeiconsIcon icon={FavouriteIcon} size={14} color="currentColor" strokeWidth={1.5} />
      </Button>
      <Button variant="ghost" size="xs" className="size-7 p-0">
        <HugeiconsIcon icon={MoreHorizontalSquare01Icon} size={14} color="currentColor" strokeWidth={1.5} />
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
    "rounded-[var(--token-dimension-radius-12,12px)]",
    "px-[var(--token-dimension-spacing-12,12px)]",
    "py-[var(--token-dimension-spacing-10,10px)]",
    "gap-[var(--token-dimension-spacing-10,10px)]",
    "transition-colors duration-100",
    "outline-none",
    "focus-visible:ring-2 focus-visible:ring-[var(--token-colors-border-focus)]",
    "cursor-pointer select-none",
  ],
  {
    variants: {
      orientation: {
        horizontal: "flex-row items-center min-h-[56px]",
        vertical:   "flex-col min-h-[174px]",
      },
      variant: {
        default: "bg-transparent border border-transparent hover:bg-[var(--token-colors-background-quiet)]",
        muted:   "bg-[var(--token-colors-background-quiet)] border border-transparent",
        outline: "bg-transparent border border-[var(--token-colors-border-primary)] hover:bg-[var(--token-colors-background-quiet)]",
      },
      state: {
        default:  "",
        hover:    "bg-[var(--token-colors-background-quiet)]",
        focus:    "ring-2 ring-[var(--token-colors-border-focus)]",
        selected: "bg-[var(--token-colors-background-informative-quiet,#eaf3ff)] border-[var(--token-colors-border-informative-subtle)]",
        disabled: "opacity-50 pointer-events-none",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
      variant:     "default",
      state:       "default",
    },
  }
)

export type ListItemOrientation = "horizontal" | "vertical"
export type ListItemVariant     = "default" | "muted" | "outline"
export type ListItemState       = "default" | "hover" | "focus" | "selected" | "disabled"
export type ListItemSelection   = "none" | "single" | "multi"

export interface ListItemProps
  extends Omit<React.ComponentProps<"div">, "children" | "title">,
    VariantProps<typeof listItemVariants> {
  orientation?: ListItemOrientation
  variant?:     ListItemVariant
  state?:       ListItemState
  selection?:   ListItemSelection
  selected?:    boolean
  disabled?:    boolean
  media?:       React.ReactNode
  actions?:     React.ReactNode
  footer?:      React.ReactNode
  title?:       React.ReactNode
  description?: React.ReactNode
  children?:    React.ReactNode
}

function ListItem({
  className,
  orientation = "horizontal",
  variant     = "default",
  state       = "default",
  selection   = "none",
  selected    = false,
  disabled    = false,
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

  return (
    <div
      data-slot="list-item"
      data-orientation={orientation}
      data-variant={variant}
      data-state={computedState}
      data-selection={selection}
      aria-selected={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className={cn(listItemVariants({ orientation, variant, state: computedState }), className)}
      {...props}
    >
      {children ?? (
        <>
          {/* Selection control */}
          {selection !== "none" && (
            <div className="flex shrink-0 items-center justify-center">
              {selection === "multi" ? (
                <input
                  type="checkbox"
                  readOnly
                  checked={selected}
                  disabled={disabled}
                  className="size-4 accent-[var(--token-colors-background-informative)]"
                  aria-hidden
                  tabIndex={-1}
                />
              ) : (
                <input
                  type="radio"
                  readOnly
                  checked={selected}
                  disabled={disabled}
                  className="size-4 accent-[var(--token-colors-background-informative)]"
                  aria-hidden
                  tabIndex={-1}
                />
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
              <div className="flex flex-1 flex-col gap-[var(--token-dimension-spacing-2,2px)] min-w-0">
                {title && (
                  <div
                    data-slot="list-item-title"
                    className={cn(
                      "font-[family-name:var(--token-typography-font-family-primary)]",
                      "font-[number:var(--token-typography-font-weight-semibold)]",
                      "text-[14px] leading-[18px] antialiased",
                      "text-[var(--token-colors-foreground-primary)]",
                      "line-clamp-1 truncate"
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
                      "font-[number:var(--token-typography-font-weight-regular)]",
                      "text-[12px] leading-[16px] antialiased",
                      "text-[var(--token-colors-foreground-secondary)]",
                      "line-clamp-1 truncate"
                    )}
                  >
                    {description}
                  </div>
                )}
              </div>
              {actions && (
                <div className="flex shrink-0 items-center gap-[var(--token-dimension-spacing-4,4px)] opacity-0 group-hover/list-item:opacity-100 group-focus-visible/list-item:opacity-100 transition-opacity duration-100">
                  {actions}
                </div>
              )}
            </>
          )}

          {/* Vertical layout */}
          {orientation === "vertical" && (
            <>
              {media && (
                <div className="flex shrink-0 items-start justify-start w-full">
                  {media}
                </div>
              )}
              <div className="flex flex-1 flex-col gap-[var(--token-dimension-spacing-2,2px)] w-full min-w-0">
                {title && (
                  <div
                    data-slot="list-item-title"
                    className={cn(
                      "font-[family-name:var(--token-typography-font-family-primary)]",
                      "font-[number:var(--token-typography-font-weight-semibold)]",
                      "text-[14px] leading-[18px] antialiased",
                      "text-[var(--token-colors-foreground-primary)]",
                      "line-clamp-2"
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
                      "font-[number:var(--token-typography-font-weight-regular)]",
                      "text-[12px] leading-[16px] antialiased",
                      "text-[var(--token-colors-foreground-secondary)]",
                      "line-clamp-2"
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
