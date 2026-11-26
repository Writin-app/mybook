import { useEffect, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  Input,
  type InputSize,
  type InputValidation,
} from "@/components/ui/input"

import { InputExample } from "../shadcnExamples"

type InputPlaygroundArgs = {
  size: InputSize
  validation: InputValidation
  placeholder: string
  value: string
  disabled: boolean
  type: "text" | "email" | "password" | "search"
}

function InputPlayground({
  size,
  validation,
  placeholder,
  value,
  disabled,
  type,
}: InputPlaygroundArgs) {
  const [text, setText] = useState(value)

  useEffect(() => {
    setText(value)
  }, [value])

  return (
    <div className="max-w-xs">
      <Input
        size={size}
        validation={validation}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled}
        type={type}
        aria-label="Input playground"
      />
    </div>
  )
}

const meta = {
  title: "Components/Input",
  component: InputPlayground,
  args: {
    size: "md",
    validation: "default",
    placeholder: "Input field",
    value: "",
    disabled: false,
    type: "text",
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
    disabled: { control: "boolean" },
    type: {
      control: "select",
      options: ["text", "email", "password", "search"],
    },
  },
} satisfies Meta<InputPlaygroundArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Variants: Story = {
  render: () => <InputExample />,
}

export const Sizes: Story = {
  render: () => (
    <div className="grid max-w-xs gap-3">
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <Input
          key={size}
          size={size}
          placeholder={`Size ${size}`}
          aria-label={`Input ${size}`}
        />
      ))}
    </div>
  ),
}

export const ValidationStates: Story = {
  render: () => (
    <div className="grid max-w-xs gap-3">
      {(["default", "valid", "alert", "invalid"] as const).map((validation) => (
        <Input
          key={validation}
          validation={validation}
          defaultValue={`State: ${validation}`}
          aria-label={`Input ${validation}`}
        />
      ))}
      <Input disabled defaultValue="State: disabled" aria-label="Input disabled" />
    </div>
  ),
}
