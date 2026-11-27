import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ArrowDown01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { InputSize, InputValidation } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"

import { InputGroupExample } from "../shadcnExamples"

type InputGroupPlaygroundArgs = {
  size: InputSize
  validation: InputValidation
  startAddon: "none" | "icon" | "text" | "dropdown"
  endAddon: "none" | "icon" | "text" | "button"
  placeholder: string
  disabled: boolean
}

function InputGroupPlayground({
  size,
  validation,
  startAddon,
  endAddon,
  placeholder,
  disabled,
}: InputGroupPlaygroundArgs) {
  const [value, setValue] = useState("")

  return (
    <div className="max-w-sm">
      <InputGroup size={size} validation={validation}>
        {startAddon !== "none" && (
          <InputGroupAddon align="inline-start">
            {startAddon === "icon" && (
              <HugeiconsIcon aria-hidden="true" icon={Search01Icon} strokeWidth={1.75} />
            )}
            {startAddon === "text" && <InputGroupText>https://</InputGroupText>}
            {startAddon === "dropdown" && (
              <InputGroupButton size={size === "lg" || size === "md" ? "sm" : "xs"}>
                <span>USD</span>
                <HugeiconsIcon aria-hidden="true" icon={ArrowDown01Icon} strokeWidth={1.75} />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        )}
        <InputGroupInput
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          aria-invalid={validation === "invalid" ? true : undefined}
          aria-label="Input group playground"
        />
        {endAddon !== "none" && (
          <InputGroupAddon align="inline-end">
            {endAddon === "icon" && (
              <HugeiconsIcon aria-hidden="true" icon={Search01Icon} strokeWidth={1.75} />
            )}
            {endAddon === "text" && <InputGroupText>.writin.app</InputGroupText>}
            {endAddon === "button" && (
              <InputGroupButton
                variant="default"
                size={size === "lg" || size === "md" ? "sm" : "xs"}
              >
                Apply
              </InputGroupButton>
            )}
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  )
}

const meta = {
  title: "Components/Input Group",
  component: InputGroupPlayground,
  args: {
    size: "md",
    validation: "default",
    startAddon: "icon",
    endAddon: "button",
    placeholder: "Search documents...",
    disabled: false,
  },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["xs", "sm", "md", "lg"],
    },
    validation: {
      control: "inline-radio",
      options: ["default", "valid", "alert", "invalid"],
    },
    startAddon: {
      control: "inline-radio",
      options: ["none", "icon", "text", "dropdown"],
    },
    endAddon: {
      control: "inline-radio",
      options: ["none", "icon", "text", "button"],
    },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<InputGroupPlaygroundArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Default: Story = {
  render: () => <InputGroupExample />,
}

export const Sizes: Story = {
  render: () => (
    <div className="grid max-w-sm gap-3">
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <InputGroup key={size} size={size}>
          <InputGroupAddon align="inline-start">
            <HugeiconsIcon aria-hidden="true" icon={Search01Icon} strokeWidth={1.75} />
          </InputGroupAddon>
          <InputGroupInput placeholder={`Size ${size}`} aria-label={`Group ${size}`} />
          <InputGroupAddon align="inline-end">
            <InputGroupText>.app</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      ))}
    </div>
  ),
}

export const WithTextarea: Story = {
  render: () => (
    <div className="max-w-sm">
      <InputGroup size="md">
        <InputGroupTextarea
          placeholder="Add a comment..."
          aria-label="Comment textarea"
        />
        <InputGroupAddon align="block-end" className="justify-end border-t border-[var(--token-colors-border-muted)]">
          <InputGroupButton variant="default" size="sm">
            Post
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
}
