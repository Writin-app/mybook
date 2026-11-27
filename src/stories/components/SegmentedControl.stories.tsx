import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  GridViewIcon,
  LeftToRightListDashIcon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  SegmentedControl,
  SegmentedControlButton,
  type SegmentedControlOrientation,
  type SegmentedControlSize,
} from "@/components/ui/segmented-control"

type SegmentedControlPlaygroundArgs = {
  size: SegmentedControlSize
  orientation: SegmentedControlOrientation
  iconOnly: boolean
  showIcons: boolean
  disabled: boolean
}

function SegmentedControlPlayground({
  size,
  orientation,
  iconOnly,
  showIcons,
  disabled,
}: SegmentedControlPlaygroundArgs) {
  const [value, setValue] = useState("list")

  return (
    <SegmentedControl
      size={size}
      orientation={orientation}
      iconOnly={iconOnly}
      disabled={disabled}
      value={value}
      onValueChange={(nextValue) => setValue(String(nextValue))}
      aria-label="View mode"
    >
      <SegmentedControlButton value="list" aria-label="List view">
        {(showIcons || iconOnly) && (
          <HugeiconsIcon
            aria-hidden="true"
            icon={LeftToRightListDashIcon}
            strokeWidth={1.75}
          />
        )}
        {!iconOnly && <span>List</span>}
      </SegmentedControlButton>
      <SegmentedControlButton value="grid" aria-label="Grid view">
        {(showIcons || iconOnly) && (
          <HugeiconsIcon aria-hidden="true" icon={GridViewIcon} strokeWidth={1.75} />
        )}
        {!iconOnly && <span>Grid</span>}
      </SegmentedControlButton>
      <SegmentedControlButton value="settings" aria-label="Settings">
        {(showIcons || iconOnly) && (
          <HugeiconsIcon aria-hidden="true" icon={Settings02Icon} strokeWidth={1.75} />
        )}
        {!iconOnly && <span>Settings</span>}
      </SegmentedControlButton>
    </SegmentedControl>
  )
}

const meta = {
  title: "Components/Segmented Control",
  component: SegmentedControlPlayground,
  args: {
    size: "md",
    orientation: "horizontal",
    iconOnly: false,
    showIcons: true,
    disabled: false,
  },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["xs", "sm", "md", "lg"],
    },
    orientation: {
      control: "inline-radio",
      options: ["horizontal", "vertical"],
    },
    iconOnly: { control: "boolean" },
    showIcons: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<SegmentedControlPlaygroundArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Sizes: Story = {
  render: () => (
    <div className="grid gap-4">
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <SegmentedControl key={size} size={size} defaultValue="first">
          <SegmentedControlButton value="first">
            <HugeiconsIcon
              aria-hidden="true"
              icon={LeftToRightListDashIcon}
              strokeWidth={1.75}
            />
            <span>Label ({size})</span>
          </SegmentedControlButton>
          <SegmentedControlButton value="second">
            <HugeiconsIcon aria-hidden="true" icon={GridViewIcon} strokeWidth={1.75} />
            <span>Label</span>
          </SegmentedControlButton>
        </SegmentedControl>
      ))}
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <SegmentedControl orientation="vertical" size="sm" defaultValue="list">
      <SegmentedControlButton value="list">
        <HugeiconsIcon
          aria-hidden="true"
          icon={LeftToRightListDashIcon}
          strokeWidth={1.75}
        />
        <span>List</span>
      </SegmentedControlButton>
      <SegmentedControlButton value="grid">
        <HugeiconsIcon aria-hidden="true" icon={GridViewIcon} strokeWidth={1.75} />
        <span>Grid</span>
      </SegmentedControlButton>
      <SegmentedControlButton value="settings" disabled>
        <HugeiconsIcon aria-hidden="true" icon={Settings02Icon} strokeWidth={1.75} />
        <span>Disabled</span>
      </SegmentedControlButton>
    </SegmentedControl>
  ),
}

export const IconOnly: Story = {
  render: () => (
    <SegmentedControl iconOnly size="md" defaultValue="list">
      <SegmentedControlButton value="list" aria-label="List view">
        <HugeiconsIcon
          aria-hidden="true"
          icon={LeftToRightListDashIcon}
          strokeWidth={1.75}
        />
      </SegmentedControlButton>
      <SegmentedControlButton value="grid" aria-label="Grid view">
        <HugeiconsIcon aria-hidden="true" icon={GridViewIcon} strokeWidth={1.75} />
      </SegmentedControlButton>
      <SegmentedControlButton value="settings" aria-label="Settings">
        <HugeiconsIcon aria-hidden="true" icon={Settings02Icon} strokeWidth={1.75} />
      </SegmentedControlButton>
    </SegmentedControl>
  ),
}
