import type { Meta, StoryObj } from "@storybook/react-vite"
import { ArrowUpRight01Icon, SparklesIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  Badge,
  type BadgeEmphasis,
  type BadgeSize,
  type BadgeVariant,
} from "@/components/ui/badge"

import { BadgeExample } from "../shadcnExamples"

type BadgePlaygroundArgs = {
  variant: BadgeVariant
  size: BadgeSize
  emphasis: BadgeEmphasis
  label: string
  showLabel: boolean
  showLeadingIcon: boolean
  showTrailingIcon: boolean
  asLink: boolean
}

function BadgePlayground({
  variant,
  size,
  emphasis,
  label,
  showLabel,
  showLeadingIcon,
  showTrailingIcon,
  asLink,
}: BadgePlaygroundArgs) {
  return (
    <Badge
      variant={variant}
      size={size}
      emphasis={emphasis}
      render={
        asLink ? (
          <a href="#badge-link" onClick={(event) => event.preventDefault()} />
        ) : undefined
      }
    >
      {showLeadingIcon && (
        <HugeiconsIcon aria-hidden="true" icon={SparklesIcon} strokeWidth={1.75} />
      )}
      {showLabel && <span>{label}</span>}
      {showTrailingIcon && (
        <HugeiconsIcon
          aria-hidden="true"
          icon={ArrowUpRight01Icon}
          strokeWidth={1.75}
        />
      )}
    </Badge>
  )
}

const meta = {
  title: "Components/Badge",
  component: BadgePlayground,
  args: {
    variant: "default",
    size: "md",
    emphasis: "strong",
    label: "Badge",
    showLabel: true,
    showLeadingIcon: false,
    showTrailingIcon: false,
    asLink: false,
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "outline",
        "ghost",
        "link",
        "positive",
        "attention",
        "destructive",
        "assistive",
      ],
    },
    size: {
      control: "inline-radio",
      options: ["sm", "md", "lg"],
    },
    emphasis: {
      control: "inline-radio",
      options: ["strong", "subtle"],
    },
    label: { control: "text" },
    showLabel: { control: "boolean" },
    showLeadingIcon: { control: "boolean" },
    showTrailingIcon: { control: "boolean" },
    asLink: { control: "boolean" },
  },
} satisfies Meta<BadgePlaygroundArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  args: {
    variant: "default",
    size: "md",
    emphasis: "strong",
    label: "Badge",
    showLabel: true,
    showLeadingIcon: false,
    showTrailingIcon: false,
    asLink: false,
  },
  render: (args) => <BadgePlayground {...args} />,
}

export const Variants: Story = {
  render: () => <BadgeExample />,
}

const ALL_VARIANTS: BadgeVariant[] = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "link",
  "positive",
  "attention",
  "destructive",
  "assistive",
]

export const SubtleAndStrong: Story = {
  render: () => (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Strong</h3>
        <div className="flex flex-wrap items-center gap-2">
          {ALL_VARIANTS.map((variant) => (
            <Badge key={`strong-${variant}`} variant={variant} emphasis="strong">
              {variant}
            </Badge>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Subtle</h3>
        <div className="flex flex-wrap items-center gap-2">
          {ALL_VARIANTS.map((variant) => (
            <Badge key={`subtle-${variant}`} variant={variant} emphasis="subtle">
              {variant}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge size="sm">Small</Badge>
      <Badge size="md">Medium</Badge>
      <Badge size="lg">Large</Badge>
    </div>
  ),
}

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge size="sm" variant="assistive" emphasis="subtle">
        <HugeiconsIcon aria-hidden="true" icon={SparklesIcon} strokeWidth={1.75} />
        <span>AI Draft</span>
      </Badge>
      <Badge size="md" variant="positive" emphasis="strong">
        <HugeiconsIcon aria-hidden="true" icon={SparklesIcon} strokeWidth={1.75} />
        <span>Synced</span>
        <HugeiconsIcon
          aria-hidden="true"
          icon={ArrowUpRight01Icon}
          strokeWidth={1.75}
        />
      </Badge>
      <Badge
        size="lg"
        variant="link"
        render={<a href="#docs" onClick={(event) => event.preventDefault()} />}
      >
        <span>Release notes</span>
        <HugeiconsIcon
          aria-hidden="true"
          icon={ArrowUpRight01Icon}
          strokeWidth={1.75}
        />
      </Badge>
    </div>
  ),
}
