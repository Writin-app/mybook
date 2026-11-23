import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const glassVariants = cva(
  "relative isolate rounded-3xl text-foreground transition-[background-color,border-color,box-shadow,backdrop-filter] duration-[var(--glass-duration)] ease-[var(--glass-ease)]",
  {
    variants: {
      variant: {
        material: "",
        liquid: "",
        "liquid-clear": "",
      },
      intensity: {
        ultraThin: "",
        thin: "",
        regular: "",
        thick: "",
        default: "",
        strong: "",
        subtle: "",
      },
      tint: {
        none: "",
        primary: "",
        destructive: "",
      },
      elevation: {
        raised: "",
        flat: "",
      },
    },
    defaultVariants: {
      variant: "material",
      intensity: "default",
      tint: "none",
      elevation: "raised",
    },
  }
)

function Glass({
  className,
  variant = "material",
  intensity = "default",
  tint = "none",
  elevation = "raised",
  asChild = false,
  render,
  onPointerMove,
  onPointerLeave,
  ...props
}: useRender.ComponentProps<"div"> &
  VariantProps<typeof glassVariants> & { asChild?: boolean }) {
  const child = asChild && typeof props.children === "object" ? props.children : undefined
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event)
    if (variant === "material" || !event.currentTarget.hasAttribute("data-glass-follow-light") || event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const bounds = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty("--glass-pointer-x", `${event.clientX - bounds.left}px`)
    event.currentTarget.style.setProperty("--glass-pointer-y", `${event.clientY - bounds.top}px`)
    event.currentTarget.toggleAttribute("data-glass-pointer-active", true)
  }
  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(event)
    event.currentTarget.toggleAttribute("data-glass-pointer-active", false)
  }

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(glassVariants({ variant, intensity, tint, elevation }), className),
        onPointerMove: handlePointerMove,
        onPointerLeave: handlePointerLeave,
      },
      props
    ),
    render: child && React.isValidElement(child) ? child : render,
    state: { slot: "glass", variant, intensity, tint, elevation },
  })
}

export { Glass, glassVariants }
