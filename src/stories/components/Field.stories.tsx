import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { InformationCircleIcon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  Field,
  FieldDescription,
  FieldFeedback,
  FieldLabel,
  FieldMessage,
  type FieldSize,
  type FieldState,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

import { FieldExample } from "../shadcnExamples"

type FieldPlaygroundArgs = {
  size: FieldSize
  state: FieldState
  fieldType: "input" | "textarea" | "input-group"
  label: string
  required: boolean
  showInlineAddon: boolean
  showDescription: boolean
  description: string
  showFeedback: boolean
  feedbackMessage: string
}

function FieldPlayground({
  size,
  state,
  fieldType,
  label,
  required,
  showInlineAddon,
  showDescription,
  description,
  showFeedback,
  feedbackMessage,
}: FieldPlaygroundArgs) {
  const [enabled, setEnabled] = useState(false)
  const [value, setValue] = useState("")

  const messageType =
    state === "valid"
      ? "success"
      : state === "alert"
        ? "warning"
        : state === "invalid"
          ? "error"
          : "info"

  return (
    <div className="max-w-xs">
      <Field size={size} state={state}>
        <div className="flex flex-col gap-[var(--token-dimension-spacing-4)]">
          <FieldLabel
            htmlFor="field-playground-control"
            required={required}
            inlineAddon={
              showInlineAddon ? (
                <>
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={InformationCircleIcon}
                    size={12}
                    className="text-[var(--token-colors-foreground-secondary)]"
                  />
                  <Switch
                    size="sm"
                    checked={enabled}
                    onCheckedChange={setEnabled}
                    aria-label="Enable option"
                  />
                </>
              ) : undefined
            }
          >
            {label}
          </FieldLabel>
          {showDescription && (
            <FieldDescription>{description}</FieldDescription>
          )}
        </div>

        {fieldType === "input" && (
          <Input
            id="field-playground-control"
            size={size}
            validation={state}
            placeholder="Input field"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}

        {fieldType === "textarea" && (
          <Textarea
            id="field-playground-control"
            size={size}
            validation={state}
            placeholder="Textarea"
            showCount
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}

        {fieldType === "input-group" && (
          <InputGroup size={size} validation={state}>
            <InputGroupAddon align="inline-start">
              <HugeiconsIcon aria-hidden="true" icon={Search01Icon} strokeWidth={1.75} />
            </InputGroupAddon>
            <InputGroupInput
              id="field-playground-control"
              placeholder="Input field"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </InputGroup>
        )}

        {showFeedback && (
          <FieldFeedback>
            <FieldMessage messageType={messageType}>
              {feedbackMessage}
            </FieldMessage>
          </FieldFeedback>
        )}
      </Field>
    </div>
  )
}

const meta = {
  title: "Components/Field",
  component: FieldPlayground,
  args: {
    size: "md",
    state: "default",
    fieldType: "input",
    label: "Label",
    required: true,
    showInlineAddon: false,
    showDescription: true,
    description: "Field description",
    showFeedback: true,
    feedbackMessage: "FieldMessage",
  },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["xs", "sm", "md", "lg"],
    },
    state: {
      control: "inline-radio",
      options: ["default", "valid", "alert", "invalid"],
    },
    fieldType: {
      control: "inline-radio",
      options: ["input", "textarea", "input-group"],
    },
    label: { control: "text" },
    required: { control: "boolean" },
    showInlineAddon: { control: "boolean" },
    showDescription: { control: "boolean" },
    description: { control: "text" },
    showFeedback: { control: "boolean" },
    feedbackMessage: { control: "text" },
  },
} satisfies Meta<FieldPlaygroundArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Default: Story = {
  render: () => <FieldExample />,
}

export const FeedbackMessages: Story = {
  render: () => (
    <FieldFeedback>
      <FieldMessage messageType="success">Username is available</FieldMessage>
      <FieldMessage messageType="info">Used for your public workspace URL</FieldMessage>
      <FieldMessage messageType="warning">Caps lock is currently on</FieldMessage>
      <FieldMessage messageType="error">This field is required</FieldMessage>
    </FieldFeedback>
  ),
}

export const SizesAndStates: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-6 md:grid-cols-2">
      {(["default", "valid", "alert", "invalid"] as const).map((state) => (
        <Field key={state} size="md" state={state}>
          <FieldLabel required>Workspace name ({state})</FieldLabel>
          <FieldDescription>Visible to workspace members.</FieldDescription>
          <Input validation={state} defaultValue="Writin Studio" />
          {state !== "default" && (
            <FieldFeedback>
              <FieldMessage
                messageType={
                  state === "valid"
                    ? "success"
                    : state === "alert"
                      ? "warning"
                      : "error"
                }
              >
                {state === "valid"
                  ? "Looks good"
                  : state === "alert"
                    ? "Special characters will be slugified"
                    : "Please enter a valid name"}
              </FieldMessage>
            </FieldFeedback>
          )}
        </Field>
      ))}
    </div>
  ),
}
