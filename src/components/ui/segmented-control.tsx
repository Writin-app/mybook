import * as React from "react"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

export type SegmentedControlSize = "xs" | "sm" | "md" | "lg"
export type SegmentedControlOrientation = "horizontal" | "vertical"

const SegmentedControlContext = React.createContext<{
  size: SegmentedControlSize
  iconOnly: boolean
}>({
  size: "md",
  iconOnly: false,
})

const segmentedControlVariants = cva(
  "relative inline-flex w-fit bg-[var(--token-colors-background-muted)] p-[var(--token-dimension-spacing-2)] font-[family-name:var(--token-typography-font-family-primary)] antialiased",
  {
    variants: {
      orientation: {
        horizontal:
          "flex-row items-center rounded-[var(--token-dimension-radius-rounded)]",
        vertical: "flex-col items-stretch justify-center",
      },
      size: {
        xs: "",
        sm: "",
        md: "",
        lg: "",
      },
    },
    compoundVariants: [
      {
        orientation: "vertical",
        size: "xs",
        className: "rounded-[var(--token-dimension-radius-12)]",
      },
      {
        orientation: "vertical",
        size: "sm",
        className: "rounded-[var(--token-dimension-radius-16)]",
      },
      {
        orientation: "vertical",
        size: "md",
        className: "rounded-[var(--token-dimension-radius-20)]",
      },
      {
        orientation: "vertical",
        size: "lg",
        className: "rounded-[var(--token-dimension-radius-24)]",
      },
    ],
    defaultVariants: {
      orientation: "horizontal",
      size: "md",
    },
  }
)

const segmentedControlButtonVariants = cva(
  [
    "relative z-10 inline-flex shrink-0 cursor-pointer items-center justify-center",
    "gap-[var(--token-dimension-spacing-4)] rounded-[var(--token-dimension-radius-rounded)]",
    "font-[family-name:var(--token-typography-font-family-primary)] font-[number:var(--token-typography-font-weight-regular)] tracking-[var(--token-typography-letter-spacing-normal)] text-[var(--token-actions-secondary-foreground)] whitespace-nowrap antialiased",
    "transition-colors duration-200 outline-none select-none",
    "not-data-[checked]:hover:bg-[var(--token-actions-secondary-background-hover)]",
    "focus-visible:ring-2 focus-visible:ring-[var(--token-focus-ring-brand)]",
    "data-[checked]:font-[number:var(--token-typography-font-weight-medium)]",
    "data-[disabled]:pointer-events-none data-[disabled]:text-[var(--token-actions-disabled-foreground)] data-[disabled]:hover:bg-transparent",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      size: {
        xs: "h-[var(--token-dimension-size-24)] px-[var(--token-dimension-spacing-10)] py-[var(--token-dimension-spacing-4)] text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-[var(--token-dimension-size-32)] px-[var(--token-dimension-spacing-12)] py-[var(--token-dimension-spacing-4)] text-[length:var(--token-typography-font-size-14)] leading-[18px] [&_svg:not([class*='size-'])]:size-4",
        md: "h-[var(--token-dimension-size-40)] px-[var(--token-dimension-spacing-16)] py-[var(--token-dimension-spacing-8)] text-[length:var(--token-typography-font-size-14)] leading-[18px] [&_svg:not([class*='size-'])]:size-4",
        lg: "h-[var(--token-dimension-size-48)] px-[var(--token-dimension-spacing-20)] py-[var(--token-dimension-spacing-12)] text-[length:var(--token-typography-font-size-16)] leading-[var(--token-typography-line-height-20)] [&_svg:not([class*='size-'])]:size-4",
      },
      iconOnly: {
        true: "px-0",
        false: "",
      },
    },
    compoundVariants: [
      { size: "xs", iconOnly: true, className: "size-[var(--token-dimension-size-24)]" },
      { size: "sm", iconOnly: true, className: "size-[var(--token-dimension-size-32)]" },
      { size: "md", iconOnly: true, className: "size-[var(--token-dimension-size-40)]" },
      { size: "lg", iconOnly: true, className: "size-[var(--token-dimension-size-48)]" },
    ],
    defaultVariants: {
      size: "md",
      iconOnly: false,
    },
  }
)

export interface SegmentedControlProps
  extends RadioGroupPrimitive.Props,
    VariantProps<typeof segmentedControlVariants> {
  size?: SegmentedControlSize
  orientation?: SegmentedControlOrientation
  iconOnly?: boolean
}

type IndicatorRect = {
  left: number
  top: number
  width: number
  height: number
  visible: boolean
}

function SegmentedControl({
  className,
  size = "md",
  orientation = "horizontal",
  iconOnly = false,
  children,
  ...props
}: SegmentedControlProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const hasMeasuredRef = React.useRef(false)
  const [indicator, setIndicator] = React.useState<IndicatorRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    visible: false,
  })
  const [animateSlide, setAnimateSlide] = React.useState(false)

  const measureIndicator = React.useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const activeButton = container.querySelector<HTMLElement>(
      '[data-slot="segmented-control-button"][data-checked]'
    )

    if (!activeButton) {
      setIndicator((prev) => (prev.visible ? { ...prev, visible: false } : prev))
      return
    }

    const next: IndicatorRect = {
      left: activeButton.offsetLeft,
      top: activeButton.offsetTop,
      width: activeButton.offsetWidth,
      height: activeButton.offsetHeight,
      visible: true,
    }

    setIndicator((prev) =>
      prev.left === next.left &&
      prev.top === next.top &&
      prev.width === next.width &&
      prev.height === next.height &&
      prev.visible === next.visible
        ? prev
        : next
    )

    if (!hasMeasuredRef.current) {
      hasMeasuredRef.current = true
      requestAnimationFrame(() => setAnimateSlide(true))
    }
  }, [])

  React.useLayoutEffect(() => {
    measureIndicator()
  }, [measureIndicator, size, orientation, iconOnly, props.value, children])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const mutationObserver = new MutationObserver(() => {
      measureIndicator()
    })
    mutationObserver.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-checked", "aria-checked"],
    })

    const resizeObserver = new ResizeObserver(() => {
      measureIndicator()
    })
    resizeObserver.observe(container)

    return () => {
      mutationObserver.disconnect()
      resizeObserver.disconnect()
    }
  }, [measureIndicator])

  return (
    <RadioGroupPrimitive
      ref={containerRef}
      data-slot="segmented-control"
      data-size={size}
      data-orientation={orientation}
      className={cn(segmentedControlVariants({ orientation, size }), className)}
      {...props}
    >
      {indicator.visible && (
        <span
          aria-hidden="true"
          data-slot="segmented-control-indicator"
          style={{
            width: `${indicator.width}px`,
            height: `${indicator.height}px`,
            transform: `translate3d(${indicator.left}px, ${indicator.top}px, 0)`,
          }}
          className={cn(
            "pointer-events-none absolute top-0 left-0 z-0 rounded-[var(--token-dimension-radius-rounded)] bg-[var(--token-colors-background-default)] shadow-[0_0_0_1px_var(--token-overlay-backdrop-edge),0_1px_1px_var(--token-overlay-backdrop-contact),0_2px_2px_var(--token-overlay-backdrop-ambient)]",
            animateSlide &&
              "transition-[transform,width,height] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          )}
        />
      )}
      <SegmentedControlContext.Provider value={{ size, iconOnly }}>
        {children}
      </SegmentedControlContext.Provider>
    </RadioGroupPrimitive>
  )
}

export interface SegmentedControlButtonProps
  extends RadioPrimitive.Root.Props,
    VariantProps<typeof segmentedControlButtonVariants> {}

function SegmentedControlButton({
  className,
  size,
  iconOnly,
  children,
  ...props
}: SegmentedControlButtonProps) {
  const context = React.useContext(SegmentedControlContext)
  const resolvedSize = size ?? context.size
  const resolvedIconOnly = iconOnly ?? context.iconOnly

  return (
    <RadioPrimitive.Root
      data-slot="segmented-control-button"
      data-size={resolvedSize}
      className={cn(
        segmentedControlButtonVariants({
          size: resolvedSize,
          iconOnly: resolvedIconOnly,
        }),
        className
      )}
      {...props}
    >
      {children}
    </RadioPrimitive.Root>
  )
}

export {
  SegmentedControl,
  SegmentedControlButton,
  segmentedControlButtonVariants,
  segmentedControlVariants,
}
