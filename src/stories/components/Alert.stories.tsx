import { useEffect, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  type AlertAppearance,
  type AlertEmphasis,
  type AlertVariant,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import { AlertExample } from "../shadcnExamples"

type AlertPlaygroundArgs = {
  variant: AlertVariant
  emphasis: AlertEmphasis
  appearance: AlertAppearance
  title: string
  description: string
  showIcon: boolean
  showDescription: boolean
  showAction: boolean
  actionLabel: string
  dismissible: boolean
}

function AlertPlayground({
  variant,
  emphasis,
  appearance,
  title,
  description,
  showIcon,
  showDescription,
  showAction,
  actionLabel,
  dismissible,
}: AlertPlaygroundArgs) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(false)
  }, [
    variant,
    emphasis,
    appearance,
    title,
    description,
    showIcon,
    showDescription,
    showAction,
    actionLabel,
    dismissible,
  ])

  if (dismissed) {
    return (
      <div className="flex max-w-2xl items-center gap-3">
        <span className="text-sm text-muted-foreground">Alert dismissed.</span>
        <Button size="sm" variant="outline" onClick={() => setDismissed(false)}>
          Restore alert
        </Button>
      </div>
    )
  }

  return (
    <div className={appearance === "banner" ? "w-full" : "max-w-2xl"}>
      <Alert
        variant={variant}
        emphasis={emphasis}
        appearance={appearance}
        dismissible={dismissible}
        onDismiss={dismissible ? () => setDismissed(true) : undefined}
      >
        {showIcon && <AlertIcon variant={variant} />}
        <AlertTitle>{title}</AlertTitle>
        {showDescription && <AlertDescription>{description}</AlertDescription>}
        {showAction && (
          <AlertAction>
            <Button size="sm" variant="outline">
              {actionLabel}
            </Button>
          </AlertAction>
        )}
      </Alert>
    </div>
  )
}

const meta = {
  title: "Components/Alert",
  component: AlertPlayground,
  args: {
    variant: "default",
    emphasis: "subtle",
    appearance: "toast",
    title: "Heads up",
    description: "Changes are saved locally and synced to Drive automatically.",
    showIcon: true,
    showDescription: true,
    showAction: true,
    actionLabel: "Retry",
    dismissible: true,
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "info",
        "positive",
        "attention",
        "destructive",
        "assistive",
      ],
    },
    emphasis: {
      control: "inline-radio",
      options: ["subtle", "strong"],
    },
    appearance: {
      control: "inline-radio",
      options: ["toast", "banner"],
    },
    title: { control: "text" },
    description: { control: "text" },
    showIcon: { control: "boolean" },
    showDescription: { control: "boolean" },
    showAction: { control: "boolean" },
    actionLabel: { control: "text" },
    dismissible: { control: "boolean" },
  },
} satisfies Meta<AlertPlaygroundArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  args: {
    variant: "default",
    emphasis: "subtle",
    appearance: "toast",
    title: "Heads up",
    description: "Changes are saved locally and synced to Drive automatically.",
    showIcon: true,
    showDescription: true,
    showAction: true,
    actionLabel: "Retry",
    dismissible: true,
  },
  render: (args) => <AlertPlayground {...args} />,
}

export const Variants: Story = {
  render: () => <AlertExample />,
}

const ALL_VARIANTS: Array<{ variant: AlertVariant; label: string }> = [
  { variant: "default", label: "Neutral" },
  { variant: "info", label: "Info" },
  { variant: "positive", label: "Positive (Success)" },
  { variant: "attention", label: "Attention (Warning)" },
  { variant: "destructive", label: "Destructive" },
  { variant: "assistive", label: "Assistive" },
]

export const SubtleAndStrong: Story = {
  render: () => (
    <div className="grid max-w-4xl gap-6 md:grid-cols-2">
      <div className="grid gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Subtle</h3>
        {ALL_VARIANTS.map(({ variant, label }) => (
          <Alert key={`subtle-${variant}`} variant={variant} emphasis="subtle">
            <AlertIcon variant={variant} />
            <AlertTitle>{label}</AlertTitle>
            <AlertDescription>Subtle toast notification message.</AlertDescription>
          </Alert>
        ))}
      </div>
      <div className="grid gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Strong</h3>
        {ALL_VARIANTS.map(({ variant, label }) => (
          <Alert key={`strong-${variant}`} variant={variant} emphasis="strong">
            <AlertIcon variant={variant} />
            <AlertTitle>{label}</AlertTitle>
            <AlertDescription>Strong toast notification message.</AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  ),
}

export const ToastAndBanner: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-5">
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Toast (rounded, bordered/elevated)
        </h3>
        <Alert variant="info" emphasis="subtle" appearance="toast" dismissible>
          <AlertIcon variant="info" />
          <AlertTitle>Syncing workspace</AlertTitle>
          <AlertDescription>
            Your latest edits are queued for Drive backup.
          </AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline">
              View
            </Button>
          </AlertAction>
        </Alert>
      </div>
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Banner (edge-to-edge, no border or radius)
        </h3>
        <Alert variant="info" emphasis="strong" appearance="banner" dismissible>
          <AlertIcon variant="info" />
          <AlertTitle>New version available</AlertTitle>
          <AlertDescription>
            Reload the page to apply the latest editor updates.
          </AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline">
              Reload
            </Button>
          </AlertAction>
        </Alert>
      </div>
    </div>
  ),
}
