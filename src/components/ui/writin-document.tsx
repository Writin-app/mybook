import * as React from "react"
import { cn } from "@/lib/utils"

export type WritinDocumentSize = "sm" | "md" | "lg" | "xxl"

const sizePx: Record<WritinDocumentSize, number> = {
  sm:  24,
  md:  32,
  lg:  40,
  xxl: 140,
}

export interface WritinDocumentProps extends React.ComponentProps<"span"> {
  size?: WritinDocumentSize
}

/**
 * WritinDocument illustration component.
 * Uses the /public/icons/writin-doc-icon.svg for sm/md/lg sizes,
 * and an inline scaled version for xxl.
 */
function WritinDocument({
  className,
  size = "md",
  style,
  ...props
}: WritinDocumentProps) {
  const px = sizePx[size]

  return (
    <span
      data-slot="writin-document"
      data-size={size}
      aria-label="Writin document"
      role="img"
      style={{ display: "inline-flex", width: px, height: px, ...style }}
      className={cn("shrink-0", className)}
      {...props}
    >
      <img
        src="/icons/writin-doc-icon.svg"
        alt=""
        aria-hidden="true"
        style={{ width: px, height: px, objectFit: "contain" }}
        draggable={false}
      />
    </span>
  )
}

export { WritinDocument }
