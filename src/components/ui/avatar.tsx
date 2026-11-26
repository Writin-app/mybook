import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon, Add01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { StatusIndicator, type StatusIndicatorStatus } from "@/components/ui/status-indicator"

// ─── Size maps ────────────────────────────────────────────────────────────────

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl"

/** Pixel size for each avatar size step */
const avatarSizePx: Record<AvatarSize, number> = {
  xs:    24,
  sm:    32,
  md:    40,
  lg:    48,
  xl:    56,
  "2xl": 72,
}

/** Icon inner size (px) inside fallback */
const avatarIconSizePx: Record<AvatarSize, number> = {
  xs:    12,
  sm:    16,
  md:    20,
  lg:    24,
  xl:    28,
  "2xl": 36,
}

/** Initials font size (px) */
const avatarTextSizePx: Record<AvatarSize, number> = {
  xs:    10,
  sm:    12,
  md:    16,
  lg:    20,
  xl:    22,
  "2xl": 24,
}

/** StatusIndicator size per avatar size */
const avatarStatusSize: Record<AvatarSize, "xs" | "sm" | "md" | "lg" | "xl" | "2xl"> = {
  xs:    "xs",
  sm:    "sm",
  md:    "sm",
  lg:    "md",
  xl:    "lg",
  "2xl": "xl",
}

/** AvatarGroup negative margin overlap per avatar size */
const avatarGroupOverlap: Record<AvatarSize, string> = {
  xs:    "-8px",
  sm:    "-10px",
  md:    "-12px",
  lg:    "-12px",
  xl:    "-16px",
  "2xl": "-16px",
}

/** Ring width per avatar size for AvatarGroup */
const avatarGroupRingWidth: Record<AvatarSize, string> = {
  xs:    "1px",
  sm:    "2px",
  md:    "2px",
  lg:    "2px",
  xl:    "3px",
  "2xl": "3px",
}

// ─── Avatar (Root) ─────────────────────────────────────────────────────────────

export interface AvatarProps extends Omit<AvatarPrimitive.Root.Props, "children"> {
  size?:     AvatarSize
  variant?:  "filled" | "empty"
  status?:   StatusIndicatorStatus
  children?: React.ReactNode
}

function Avatar({
  className,
  size = "md",
  variant = "filled",
  status,
  children,
  ...props
}: AvatarProps) {
  const px = avatarSizePx[size]

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      data-variant={variant}
      style={{ width: px, height: px }}
      className={cn(
        "group/avatar relative shrink-0 select-none overflow-hidden rounded-full",
        "transition-colors duration-100",
        variant === "filled" && [
          "bg-[var(--token-colors-background-quiet)]",
          "ring-1 ring-[var(--token-colors-border-primary)]",
        ],
        variant === "empty" && [
          "bg-transparent overflow-visible",
          "ring-1 ring-dashed ring-[var(--token-colors-border-informative-subtle)]",
        ],
        className
      )}
      {...props}
    >
      {children}

      {status && (
        <StatusIndicator
          size={avatarStatusSize[size]}
          status={status}
          className="absolute right-0 bottom-0 z-10 translate-x-1/4 translate-y-1/4"
        />
      )}
    </AvatarPrimitive.Root>
  )
}

// ─── AvatarImage ───────────────────────────────────────────────────────────────

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  )
}

// ─── AvatarFallback ────────────────────────────────────────────────────────────

export interface AvatarFallbackProps extends AvatarPrimitive.Fallback.Props {
  size?:     AvatarSize
  initials?: string
}

function AvatarFallback({
  className,
  size = "md",
  initials,
  children,
  ...props
}: AvatarFallbackProps) {
  const iconPx = avatarIconSizePx[size]
  const textPx = avatarTextSizePx[size]

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center",
        "text-[var(--token-colors-foreground-secondary)]",
        className
      )}
      {...props}
    >
      {children ?? (
        initials ? (
          <span
            style={{ fontSize: textPx }}
            className={cn(
              "font-[family-name:var(--token-typography-font-family-primary)]",
              "font-[number:var(--token-typography-font-weight-semibold)]",
              "leading-none antialiased",
              "text-[var(--token-colors-foreground-secondary)]"
            )}
          >
            {initials}
          </span>
        ) : (
          <HugeiconsIcon
            icon={UserIcon}
            size={iconPx}
            color="currentColor"
            strokeWidth={1.5}
          />
        )
      )}
    </AvatarPrimitive.Fallback>
  )
}

// ─── AvatarBadge ───────────────────────────────────────────────────────────────

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center",
        "rounded-full ring-2 ring-[var(--token-colors-background-default)]",
        className
      )}
      {...props}
    />
  )
}

// ─── AvatarAdd ─────────────────────────────────────────────────────────────────

function AvatarAdd({
  className,
  size = "md",
  ...props
}: Omit<AvatarProps, "variant" | "status">) {
  const iconPx = avatarIconSizePx[size]

  return (
    <Avatar size={size} variant="empty" className={cn("overflow-visible", className)} {...props}>
      <AvatarFallback size={size}>
        <HugeiconsIcon
          icon={Add01Icon}
          size={iconPx}
          color="var(--token-colors-border-informative-subtle)"
          strokeWidth={1.5}
        />
      </AvatarFallback>
    </Avatar>
  )
}

// ─── AvatarGroup ───────────────────────────────────────────────────────────────

export interface AvatarGroupProps extends React.ComponentProps<"div"> {
  size?: AvatarSize
}

function AvatarGroup({
  className,
  size = "md",
  style,
  ...props
}: AvatarGroupProps) {
  const overlap = avatarGroupOverlap[size]
  const ring    = avatarGroupRingWidth[size]

  return (
    <div
      data-slot="avatar-group"
      data-size={size}
      className={cn("group/avatar-group flex items-center", className)}
      style={
        {
          "--avatar-overlap": overlap,
          "--avatar-ring":    ring,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

// ─── AvatarGroupItem ───────────────────────────────────────────────────────────

function AvatarGroupItem({
  className,
  size = "md",
  style,
  ...props
}: AvatarProps) {
  return (
    <Avatar
      size={size}
      className={cn(className)}
      style={{
        marginLeft: `var(--avatar-overlap, -12px)`,
        boxShadow:  `0 0 0 var(--avatar-ring, 2px) var(--token-colors-background-default)`,
        ...style,
      }}
      {...props}
    />
  )
}

// ─── AvatarGroupCount ──────────────────────────────────────────────────────────

export interface AvatarGroupCountProps extends React.ComponentProps<"div"> {
  size?:  AvatarSize
  count?: number
}

function AvatarGroupCount({
  className,
  size = "md",
  count,
  children,
  style,
  ...props
}: AvatarGroupCountProps) {
  const px     = avatarSizePx[size]
  const textPx = avatarTextSizePx[size]

  return (
    <div
      data-slot="avatar-group-count"
      style={{
        width:      px,
        height:     px,
        marginLeft: `var(--avatar-overlap, -12px)`,
        boxShadow:  `0 0 0 var(--avatar-ring, 2px) var(--token-colors-background-default)`,
        fontSize:   textPx,
        ...style,
      }}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full select-none",
        "bg-[var(--token-colors-background-quiet)]",
        "font-[family-name:var(--token-typography-font-family-primary)]",
        "font-[number:var(--token-typography-font-weight-semibold)]",
        "text-[var(--token-colors-foreground-default-accent,#0473eb)] antialiased",
        className
      )}
      {...props}
    >
      {children ?? (count !== undefined ? `+${count}` : null)}
    </div>
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarAdd,
  AvatarGroup,
  AvatarGroupItem,
  AvatarGroupCount,
}
