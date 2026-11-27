import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const iconWrapperSizeMap = {
  "12": {
    box: "var(--token-dimension-size-12)",
    svg: "var(--token-dimension-size-10)",
    stroke: "var(--token-border-width-standalone-12)",
  },
  "16": {
    box: "var(--token-dimension-size-16)",
    svg: "var(--token-dimension-size-12)",
    stroke: "var(--token-border-width-standalone-16)",
  },
  "20": {
    box: "var(--token-dimension-size-20)",
    svg: "var(--token-dimension-size-16)",
    stroke: "var(--token-border-width-standalone-20)",
  },
  "24": {
    box: "var(--token-dimension-size-24)",
    svg: "var(--token-dimension-size-20)",
    stroke: "var(--token-border-width-standalone-24)",
  },
  "32": {
    box: "var(--token-dimension-size-32)",
    svg: "var(--token-dimension-size-24)",
    stroke: "var(--token-border-width-standalone-32)",
  },
  "40": {
    box: "var(--token-dimension-size-40)",
    svg: "var(--token-dimension-size-32)",
    stroke: "var(--token-border-width-standalone-40)",
  },
  "48": {
    box: "var(--token-dimension-size-48)",
    svg: "var(--token-dimension-size-40)",
    stroke: "var(--token-border-width-standalone-48)",
  },
  "56": {
    box: "var(--token-dimension-size-56)",
    svg: "var(--token-dimension-size-48)",
    stroke: "var(--token-border-width-standalone-56)",
  },
  "64": {
    box: "var(--token-dimension-size-64)",
    svg: "var(--token-dimension-size-56)",
    stroke: "var(--token-border-width-standalone-64)",
  },
} as const

const iconWrapperVariants = cva(
  "inline-flex shrink-0 items-center justify-center text-current [&_svg]:shrink-0",
  {
    variants: {
      size: {
        "12": "",
        "16": "",
        "20": "",
        "24": "",
        "32": "",
        "40": "",
        "48": "",
        "56": "",
        "64": "",
      },
    },
    defaultVariants: {
      size: "24",
    },
  }
)

type IconWrapperProps = React.ComponentProps<"span"> &
  VariantProps<typeof iconWrapperVariants> & {
    icon?: React.ReactNode
  }

function IconWrapper({
  className,
  size = "24",
  icon,
  children,
  style,
  ...props
}: IconWrapperProps) {
  const resolvedSize = size ?? "24"
  const tokens = iconWrapperSizeMap[resolvedSize]

  return (
    <span
      data-slot="icon-wrapper"
      data-size={resolvedSize}
      style={
        {
          "--icon-wrapper-size": tokens.box,
          "--icon-inner-size": tokens.svg,
          "--icon-stroke-width": tokens.stroke,
          ...style,
        } as React.CSSProperties
      }
      className={cn(iconWrapperVariants({ size: resolvedSize, className }))}
      {...props}
    >
      {icon ?? children}
    </span>
  )
}

export { IconWrapper, iconWrapperVariants }
export type { IconWrapperProps }
