import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const avatarSizes = {
  sm: "size-6 text-[0.6rem]",
  default: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const

const avatarVariants = cva(
  "group/avatar relative flex shrink-0 rounded-full select-none after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-[var(--app-border)]",
  {
    variants: {
      size: avatarSizes,
    },
    defaultVariants: { size: "default" },
  }
)

function Avatar({
  className,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & VariantProps<typeof avatarVariants>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(avatarVariants({ size }), className)}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-[inherit] object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-[inherit] bg-muted font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  const hasLabel = Boolean(props["aria-label"])
  return (
    <span
      data-slot="avatar-badge"
      role={hasLabel ? "img" : undefined}
      aria-hidden={hasLabel ? undefined : true}
      className={cn(
        "absolute end-0 bottom-0 z-10 inline-flex size-[30%] min-h-2 min-w-2 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background select-none [&>svg]:size-[70%]",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex items-center -space-x-2 *:data-[slot=avatar]:bg-background *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background *:data-[slot=avatar-group-count]:ring-2 *:data-[slot=avatar-group-count]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof avatarVariants>) {
  return (
    <div
      data-slot="avatar-group-count"
      data-size={size}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground [&>svg]:size-[55%]",
        avatarSizes[size ?? "default"],
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
