"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input, type InputSize, type InputValidation } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const InputGroupContext = React.createContext<{
  size: InputSize
  validation: InputValidation
}>({
  size: "md",
  validation: "default",
})

const inputGroupVariants = cva(
  [
    "group/input-group relative flex w-full min-w-0 items-center border border-solid bg-[var(--token-colors-background-default)]",
    "font-[family-name:var(--token-typography-font-family-primary)] antialiased",
    "transition-colors outline-none",
    "hover:bg-[var(--token-colors-background-quiet)]",
    "in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0",
    "has-disabled:pointer-events-none has-disabled:border-[var(--token-colors-border-muted)] has-disabled:bg-[var(--token-colors-background-quiet)]",
    "has-[[data-slot=input-group-control]:focus-visible]:bg-[var(--token-colors-background-default)] has-[[data-slot=input-group-control]:focus-visible]:border-[var(--token-colors-border-informative)] has-[[data-slot=input-group-control]:focus-visible]:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)]",
    "has-[[data-slot][aria-invalid=true]]:border-[var(--token-colors-border-destructive)]",
    "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col",
    "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col",
    "has-[>textarea]:h-auto",
    "has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3",
    "has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
  ].join(" "),
  {
    variants: {
      size: {
        xs: "h-[var(--token-dimension-size-24)] rounded-[var(--token-dimension-radius-8)]",
        sm: "h-[var(--token-dimension-size-32)] rounded-[var(--token-dimension-radius-8)]",
        md: "h-[var(--token-dimension-size-40)] rounded-[var(--token-dimension-radius-10)]",
        lg: "h-[var(--token-dimension-size-48)] rounded-[var(--token-dimension-radius-12)]",
      },
      validation: {
        default: "border-[var(--token-colors-border-secondary)]",
        invalid: "border-[var(--token-colors-border-destructive)]",
        valid: "border-[var(--token-colors-border-positive)]",
        alert: "border-[var(--token-colors-border-attention)]",
      },
    },
    defaultVariants: {
      size: "md",
      validation: "default",
    },
  }
)

function InputGroup({
  className,
  size = "md",
  validation = "default",
  children,
  ...props
}: React.ComponentProps<"div"> &
  Omit<VariantProps<typeof inputGroupVariants>, "size" | "validation"> & {
    size?: InputSize
    validation?: InputValidation
  }) {
  return (
    <InputGroupContext.Provider value={{ size, validation }}>
      <div
        data-slot="input-group"
        data-size={size}
        data-validation={validation}
        role="group"
        className={cn(inputGroupVariants({ size, validation }), className)}
        {...props}
      >
        {children}
      </div>
    </InputGroupContext.Provider>
  )
}

const inputGroupAddonVariants = cva(
  "flex h-auto shrink-0 cursor-text items-center justify-center gap-[var(--token-dimension-spacing-4)] font-[family-name:var(--token-typography-font-family-primary)] font-[number:var(--token-typography-font-weight-regular)] text-[var(--token-colors-foreground-elevated)] select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[var(--token-dimension-radius-4)] [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-[var(--token-dimension-spacing-10)] has-[>button]:ml-[-0.25rem] has-[>kbd]:ml-[-0.15rem]",
        "inline-end":
          "order-last pr-[var(--token-dimension-spacing-10)] has-[>button]:mr-[-0.25rem] has-[>kbd]:mr-[-0.15rem]",
        "block-start":
          "order-first w-full justify-start px-[var(--token-dimension-spacing-10)] pt-[var(--token-dimension-spacing-8)] group-has-[>input]/input-group:pt-[var(--token-dimension-spacing-8)] [.border-b]:pb-[var(--token-dimension-spacing-8)]",
        "block-end":
          "order-last w-full justify-start px-[var(--token-dimension-spacing-10)] pb-[var(--token-dimension-spacing-8)] group-has-[>input]/input-group:pb-[var(--token-dimension-spacing-8)] [.border-t]:pt-[var(--token-dimension-spacing-8)]",
      },
      size: {
        xs: "text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)] [&>svg:not([class*='size-'])]:size-3",
        sm: "text-[length:var(--token-typography-font-size-14)] leading-[18px] [&>svg:not([class*='size-'])]:size-3.5",
        md: "text-[length:var(--token-typography-font-size-14)] leading-[18px] [&>svg:not([class*='size-'])]:size-4",
        lg: "text-[length:var(--token-typography-font-size-16)] leading-[var(--token-typography-line-height-20)] [&>svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      align: "inline-start",
      size: "md",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> &
  Omit<VariantProps<typeof inputGroupAddonVariants>, "size">) {
  const { size } = React.useContext(InputGroupContext)

  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align, size }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement
          ?.querySelector<HTMLElement>("input, textarea")
          ?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "flex items-center gap-[var(--token-dimension-spacing-4)] shadow-none",
  {
    variants: {
      size: {
        xs: "h-[var(--token-dimension-size-24)] gap-[var(--token-dimension-spacing-4)] px-[var(--token-dimension-spacing-10)] text-[length:var(--token-typography-font-size-12)] leading-[var(--token-typography-line-height-16)] [&>svg:not([class*='size-'])]:size-3.5",
        sm: "h-[var(--token-dimension-size-32)] px-[var(--token-dimension-spacing-12)] text-[length:var(--token-typography-font-size-14)] leading-[18px]",
        "icon-xs": "size-[var(--token-dimension-size-24)] p-0 has-[>svg]:p-0",
        "icon-sm": "size-[var(--token-dimension-size-32)] p-0 has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset"
  }) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex items-center gap-[var(--token-dimension-spacing-4)] font-[family-name:var(--token-typography-font-family-primary)] text-[var(--token-colors-foreground-elevated)] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  size,
  ...props
}: React.ComponentProps<typeof Input>) {
  const context = React.useContext(InputGroupContext)

  return (
    <Input
      data-slot="input-group-control"
      size={size ?? context.size}
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 hover:bg-transparent focus-visible:bg-transparent focus-visible:shadow-none focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  size,
  ...props
}: React.ComponentProps<typeof Textarea>) {
  const context = React.useContext(InputGroupContext)

  return (
    <Textarea
      data-slot="input-group-control"
      size={size ?? context.size}
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent shadow-none ring-0 hover:bg-transparent focus-visible:bg-transparent focus-visible:shadow-none focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0",
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
  inputGroupVariants,
}
