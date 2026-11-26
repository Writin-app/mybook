import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Mail01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldFeedback,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldMessage,
  FieldSet,
  type FieldSize,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"

type FormPlaygroundArgs = {
  size: FieldSize
  showDescriptions: boolean
}

function FormPlayground({ size, showDescriptions }: FormPlaygroundArgs) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [bio, setBio] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const nameInvalid = submitted && name.trim().length < 2
  const emailInvalid = submitted && !email.includes("@")

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
  }

  const handleReset = () => {
    setName("")
    setEmail("")
    setBio("")
    setSubmitted(false)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <FieldSet>
        <FieldLegend>Workspace Profile</FieldLegend>
        <FieldGroup>
          <Field size={size} state={nameInvalid ? "invalid" : submitted ? "valid" : "default"}>
            <FieldLabel htmlFor="form-name" required>
              Full name
            </FieldLabel>
            {showDescriptions && (
              <FieldDescription>
                Shown on shared documents and comments.
              </FieldDescription>
            )}
            <Input
              id="form-name"
              size={size}
              validation={nameInvalid ? "invalid" : submitted ? "valid" : "default"}
              placeholder="Jane Doe"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {submitted && (
              <FieldFeedback>
                <FieldMessage messageType={nameInvalid ? "error" : "success"}>
                  {nameInvalid
                    ? "Enter at least 2 characters."
                    : "Looks good."}
                </FieldMessage>
              </FieldFeedback>
            )}
          </Field>

          <Field size={size} state={emailInvalid ? "invalid" : submitted ? "valid" : "default"}>
            <FieldLabel htmlFor="form-email" required>
              Work email
            </FieldLabel>
            {showDescriptions && (
              <FieldDescription>
                Used for Drive sync notifications.
              </FieldDescription>
            )}
            <InputGroup
              size={size}
              validation={emailInvalid ? "invalid" : submitted ? "valid" : "default"}
            >
              <InputGroupAddon align="inline-start">
                <HugeiconsIcon aria-hidden="true" icon={Mail01Icon} strokeWidth={1.75} />
              </InputGroupAddon>
              <InputGroupInput
                id="form-email"
                type="email"
                placeholder="jane@writin.app"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </InputGroup>
            {submitted && (
              <FieldFeedback>
                <FieldMessage messageType={emailInvalid ? "error" : "success"}>
                  {emailInvalid
                    ? "Please enter a valid email address."
                    : "Valid email format."}
                </FieldMessage>
              </FieldFeedback>
            )}
          </Field>

          <Field size={size}>
            <FieldLabel htmlFor="form-bio">Bio</FieldLabel>
            {showDescriptions && (
              <FieldDescription>Optional short introduction.</FieldDescription>
            )}
            <Textarea
              id="form-bio"
              size={size}
              showCount
              maxLength={120}
              placeholder="Writer & product designer..."
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </Field>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button type="submit">Save profile</Button>
          </div>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}

const meta = {
  title: "Components/Form",
  component: FormPlayground,
  args: {
    size: "md",
    showDescriptions: true,
  },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["xs", "sm", "md", "lg"],
    },
    showDescriptions: { control: "boolean" },
  },
} satisfies Meta<FormPlaygroundArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}
