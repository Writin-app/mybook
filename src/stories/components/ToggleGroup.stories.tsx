import { useEffect, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { ToggleSize, ToggleVariant } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { ToggleGroupExample } from "../shadcnExamples"

type ToggleGroupPlaygroundArgs = {
  variant: ToggleVariant
  size: ToggleSize
  orientation: "horizontal" | "vertical"
  spacing: number
  iconOnly: boolean
  multiple: boolean
  disabled: boolean
}

function ToggleGroupPlayground({
  variant,
  size,
  orientation,
  spacing,
  iconOnly,
  multiple,
  disabled,
}: ToggleGroupPlaygroundArgs) {
  const [value, setValue] = useState<string[]>(["left"])

  useEffect(() => {
    setValue(["left"])
  }, [multiple])

  return (
    <ToggleGroup
      variant={variant}
      size={size}
      orientation={orientation}
      spacing={spacing}
      iconOnly={iconOnly}
      multiple={multiple}
      disabled={disabled}
      value={value}
      onValueChange={setValue}
      aria-label="Text alignment"
    >
      <ToggleGroupItem value="left" aria-label="Align left">
        <HugeiconsIcon aria-hidden="true" icon={TextAlignLeftIcon} strokeWidth={1.75} />
        {!iconOnly && <span>Left</span>}
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="Align center">
        <HugeiconsIcon aria-hidden="true" icon={TextAlignCenterIcon} strokeWidth={1.75} />
        {!iconOnly && <span>Center</span>}
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="Align right">
        <HugeiconsIcon aria-hidden="true" icon={TextAlignRightIcon} strokeWidth={1.75} />
        {!iconOnly && <span>Right</span>}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

const meta = {
  title: "Components/Toggle Group",
  component: ToggleGroupPlayground,
  args: {
    variant: "default",
    size: "md",
    orientation: "horizontal",
    spacing: 2,
    iconOnly: false,
    multiple: false,
    disabled: false,
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
    orientation: {
      control: "inline-radio",
      options: ["horizontal", "vertical"],
    },
    spacing: {
      control: { type: "number", min: 0, max: 6, step: 1 },
    },
    iconOnly: { control: "boolean" },
    multiple: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<ToggleGroupPlaygroundArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Default: Story = {
  render: () => <ToggleGroupExample />,
}

export const Sizes: Story = {
  render: () => (
    <div className="grid gap-4">
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <ToggleGroup key={size} size={size} defaultValue={["a"]}>
          <ToggleGroupItem value="a">All ({size})</ToggleGroupItem>
          <ToggleGroupItem value="b">Unread</ToggleGroupItem>
          <ToggleGroupItem value="c">Starred</ToggleGroupItem>
        </ToggleGroup>
      ))}
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <ToggleGroup orientation="vertical" variant="outline" size="sm" defaultValue={["draft"]}>
      <ToggleGroupItem value="draft">Drafts</ToggleGroupItem>
      <ToggleGroupItem value="published">Published</ToggleGroupItem>
      <ToggleGroupItem value="archived">Archived</ToggleGroupItem>
    </ToggleGroup>
  ),
}
