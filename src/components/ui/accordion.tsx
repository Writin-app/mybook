import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { ChevronRightIcon } from "@heroicons/react/24/outline"

import { cn } from "@/lib/utils"

type AccordionProps = AccordionPrimitive.Root.Props & {
  variant?: "default" | "grouped"
}

function Accordion({ className, variant = "default", ...props }: AccordionProps) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      data-variant={variant}
      className={cn("group/accordion w-full", variant === "grouped" && "overflow-hidden rounded-xl bg-muted", className)}
      {...props}
    />
  )
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b border-border last:border-b-0 group-data-[variant=grouped]/accordion:mx-3", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger flex flex-1 items-center justify-between gap-4 rounded-md px-3 py-3.5 text-left text-sm font-medium text-foreground outline-none transition-colors duration-200 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 group-data-[variant=grouped]/accordion:pe-3",
          className
        )}
        {...props}
      >
        {children}
        <ChevronRightIcon
          aria-hidden="true"
          data-slot="accordion-trigger-icon"
          className="pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-aria-expanded/accordion-trigger:rotate-90 motion-reduce:transition-none"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="overflow-hidden px-3 text-sm text-muted-foreground data-open:animate-[accordion-down_calc(var(--glass-duration)*1.5)_ease-out] data-closed:animate-[accordion-up_var(--glass-duration)_ease-out] motion-reduce:animate-none"
      {...props}
    >
      <div
        className={cn(
          "h-(--accordion-panel-height) pt-0 pb-3.5 data-ending-style:h-0 data-starting-style:h-0 group-data-[variant=grouped]/accordion:pe-3 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
