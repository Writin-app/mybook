"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon } from "@hugeicons/core-free-icons"

const checkboxVariants = cva("peer relative flex shrink-0 items-center justify-center border transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground", {
  variants: {
    size: { sm: "size-3.5 rounded-[4px]", default: "size-4 rounded-[5px]", lg: "size-5 rounded-md" },
    shape: { square: "", circle: "rounded-full!" },
  },
  defaultVariants: { size: "default", shape: "square" },
})

function Checkbox({ className, size, shape, ...props }: CheckboxPrimitive.Root.Props & VariantProps<typeof checkboxVariants>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "border-input bg-white/60 shadow-[inset_0_1px_1px_rgb(15_23_42/0.05)] dark:bg-input/30",
        checkboxVariants({ size, shape }),
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
