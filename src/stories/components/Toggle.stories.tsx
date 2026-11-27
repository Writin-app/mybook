import { useEffect, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ArrowDown01Icon, FilterIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Toggle, type ToggleSize, type ToggleVariant } from "@/components/ui/toggle"

import { ToggleExample } from "../shadcnExamples"

type TogglePlaygroundArgs = {
  variant: ToggleVariant
  size: ToggleSize
  label: string
  iconOnly: boolean
  showSelectedTick: boolean
  leadingIcon: boolean
  trailingIcon: boolean
  showCount: boolean
  count: number
  dismissible: boolean
  disabled: boolean
  defaultPressed: boolean
}

function TogglePlayground({
  variant,
  size,
  label,
  iconOnly,
  showSelectedTick,
  leadingIcon,
  trailingIcon,
  showCount,
  count,
  dismissible,
  disabled,
  defaultPressed,
}: TogglePlaygroundArgs) {
  const [pressed, setPressed] = useState(defaultPressed)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setPressed(defaultPressed)
    setDismissed(false)
  }, [defaultPressed, variant, size, iconOnly, label])

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        className="text-sm text-muted-foreground underline"
      >
        Toggle dismissed (click to restore)
      </button>
    )
  }

  return (
    <Toggle
      variant={variant}
      size={size}
      iconOnly={iconOnly}
      showSelectedTick={showSelectedTick}
      count={showCount ? count : undefined}
      onDismiss={dismissible ? () => setDismissed(true) : undefined}
      disabled={disabled}
      pressed={pressed}
      onPressedChange={setPressed}
      aria-label={iconOnly ? label : undefined}
    >
      {iconOnly ? (
        <HugeiconsIcon aria-hidden="true" icon={FilterIcon} strokeWidth={1.75} />
      ) : (
        <>
          {leadingIcon && (
            <HugeiconsIcon aria-hidden="true" icon={FilterIcon} strokeWidth={1.75} />
          )}
          <span>{label}</span>
          {trailingIcon && (
            <HugeiconsIcon aria-hidden="true" icon={ArrowDown01Icon} strokeWidth={1.75} />
          )}
        </>
      )}
    </Toggle>
  )
}

const meta = {
  title: "Components/Toggle",
  component: TogglePlayground,
  args: {
    variant: "default",
    size: "md",
    label: "Toggle label",
    iconOnly: false,
    showSelectedTick: true,
    leadingIcon: false,
    trailingIcon: false,
    showCount: false,
    count: 3,
    dismissible: false,
    disabled: false,
    defaultPressed: false,
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["default", "outline", "ghost"],
    },
    size: {
      control: "inline-radio",
      options: ["xs", "sm", "md", "lg"],
    },
    label: { control: "text" },
    iconOnly: { control: "boolean" },
    showSelectedTick: { control: "boolean" },
    leadingIcon: { control: "boolean" },
    trailingIcon: { control: "boolean" },
    showCount: { control: "boolean" },
    count: { control: "number" },
    dismissible: { control: "boolean" },
    disabled: { control: "boolean" },
    defaultPressed: { control: "boolean" },
  },
} satisfies Meta<TogglePlaygroundArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Variants: Story = {
  render: () => <ToggleExample />,
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <Toggle key={size} size={size} showSelectedTick>
          Size {size}
        </Toggle>
      ))}
    </div>
  ),
}

export const ChipsAndFilter: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle variant="default" size="sm" defaultPressed showSelectedTick count={4}>
        Active
      </Toggle>
      <Toggle variant="outline" size="sm" showSelectedTick>
        <HugeiconsIcon aria-hidden="true" icon={FilterIcon} strokeWidth={1.75} />
        <span>Shared</span>
      </Toggle>
      <Toggle variant="ghost" size="sm" showSelectedTick>
        Archived
      </Toggle>
      <Toggle variant="outline" size="sm" disabled>
        Disabled
      </Toggle>
    </div>
  ),
}
