import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "@/components/ui/button"
import { toast, type ToastEmphasis } from "@/components/ui/toast"

import { ToastExample } from "../shadcnExamples"

type ToastPlaygroundType =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "assistive"
  | "loading"

type ToastPlaygroundArgs = {
  type: ToastPlaygroundType
  emphasis: ToastEmphasis
  title: string
  description: string
  showIcon: boolean
  showDescription: boolean
  showAction: boolean
  actionLabel: string
}

function ToastPlayground({
  type,
  emphasis,
  title,
  description,
  showIcon,
  showDescription,
  showAction,
  actionLabel,
}: ToastPlaygroundArgs) {
  const triggerToast = () => {
    toast.add({
      title,
      description: showDescription ? description : undefined,
      type: type === "default" ? undefined : type,
      data: {
        emphasis,
        showIcon,
      },
      actionProps: showAction
        ? {
            children: actionLabel,
            onClick: () => undefined,
          }
        : undefined,
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={triggerToast}>Show toast</Button>
    </div>
  )
}

const meta = {
  title: "Components/Toast",
  component: ToastPlayground,
  args: {
    type: "default",
    emphasis: "subtle",
    title: "Changes saved",
    description: "Your workspace edits are synced to Drive automatically.",
    showIcon: true,
    showDescription: true,
    showAction: true,
    actionLabel: "Undo",
  },
  argTypes: {
    type: {
      control: "select",
      options: [
        "default",
        "info",
        "success",
        "warning",
        "error",
        "assistive",
        "loading",
      ],
    },
    emphasis: {
      control: "inline-radio",
      options: ["subtle", "strong"],
    },
    title: { control: "text" },
    description: { control: "text" },
    showIcon: { control: "boolean" },
    showDescription: { control: "boolean" },
    showAction: { control: "boolean" },
    actionLabel: { control: "text" },
  },
} satisfies Meta<ToastPlaygroundArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Default: Story = {
  render: () => <ToastExample />,
}

const TOAST_TYPES: Array<{ type: ToastPlaygroundType; label: string }> = [
  { type: "default", label: "Neutral" },
  { type: "info", label: "Info" },
  { type: "success", label: "Success" },
  { type: "warning", label: "Warning" },
  { type: "error", label: "Destructive" },
  { type: "assistive", label: "Assistive" },
  { type: "loading", label: "Loading" },
]

export const SubtleAndStrong: Story = {
  render: () => (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Subtle</h3>
        <div className="flex flex-wrap gap-2">
          {TOAST_TYPES.map(({ type, label }) => (
            <Button
              key={`subtle-${type}`}
              size="sm"
              variant="outline"
              onClick={() =>
                toast.add({
                  title: `${label} notification`,
                  description: "Subtle toast matching Alert styling.",
                  type: type === "default" ? undefined : type,
                  data: { emphasis: "subtle" },
                })
              }
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Strong</h3>
        <div className="flex flex-wrap gap-2">
          {TOAST_TYPES.map(({ type, label }) => (
            <Button
              key={`strong-${type}`}
              size="sm"
              variant="outline"
              onClick={() =>
                toast.add({
                  title: `${label} notification`,
                  description: "Strong toast matching Alert styling.",
                  type: type === "default" ? undefined : type,
                  data: { emphasis: "strong" },
                })
              }
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  ),
}
