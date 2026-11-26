import { useEffect, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  Textarea,
  type TextareaSize,
  type TextareaValidation,
} from "@/components/ui/textarea"

import { TextareaExample } from "../shadcnExamples"

type TextareaPlaygroundArgs = {
  size: TextareaSize
  validation: TextareaValidation
  placeholder: string
  value: string
  showCount: boolean
  maxLength: number
  resizable: boolean
  disabled: boolean
}

function TextareaPlayground({
  size,
  validation,
  placeholder,
  value,
  showCount,
  maxLength,
  resizable,
  disabled,
}: TextareaPlaygroundArgs) {
  const [text, setText] = useState(value)

  useEffect(() => {
    setText(value)
  }, [value])

  return (
    <div className="max-w-xs">
      <Textarea
        size={size}
        validation={validation}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        showCount={showCount}
        maxLength={maxLength}
        resizable={resizable}
        disabled={disabled}
        aria-label="Textarea playground"
      />
    </div>
  )
}

const meta = {
  title: "Components/Textarea",
  component: TextareaPlayground,
  args: {
    size: "md",
    validation: "default",
    placeholder: "Textarea",
    value: "",
    showCount: true,
    maxLength: 100,
    resizable: true,
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
    placeholder: { control: "text" },
    value: { control: "text" },
    showCount: { control: "boolean" },
    maxLength: { control: { type: "number", min: 10, max: 500, step: 10 } },
    resizable: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<TextareaPlaygroundArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Default: Story = {
  render: () => <TextareaExample />,
}

export const Sizes: Story = {
  render: () => (
    <div className="grid max-w-xs gap-3">
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <Textarea
          key={size}
          size={size}
          showCount
          placeholder={`Size ${size}`}
          aria-label={`Textarea ${size}`}
        />
      ))}
    </div>
  ),
}

export const ValidationStates: Story = {
  render: () => (
    <div className="grid max-w-xs gap-3">
      {(["default", "valid", "alert", "invalid"] as const).map((validation) => (
        <Textarea
          key={validation}
          validation={validation}
          showCount
          defaultValue={`State: ${validation}`}
          aria-label={`Textarea ${validation}`}
        />
      ))}
      <Textarea
        disabled
        showCount
        defaultValue="State: disabled"
        aria-label="Textarea disabled"
      />
    </div>
  ),
}
