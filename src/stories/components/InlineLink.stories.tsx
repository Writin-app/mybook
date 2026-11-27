import type { Meta, StoryObj } from '@storybook/react-vite'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  Delete02Icon,
  Link01Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'

import { InlineLink, type InlineLinkProps } from '@/components/ui/inline-link'

type PlaygroundArgs = InlineLinkProps & {
  showLeadingIcon?: boolean
  showTrailingIcon?: boolean
}

const meta = {
  title: 'Components/InlineLink',
  component: InlineLink,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'destructive', 'assistive'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    children: { control: 'text' },
    href: { control: 'text' },
    disabled: { control: 'boolean' },
    showLeadingIcon: { control: 'boolean' },
    showTrailingIcon: { control: 'boolean' },
  },
  args: {
    variant: 'primary',
    size: 'md',
    children: 'Link label',
    href: '#inline-link',
    disabled: false,
    showLeadingIcon: true,
    showTrailingIcon: true,
  },
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

export const Playground: Story = {
  render: ({ showLeadingIcon, showTrailingIcon, children, ...args }) => (
    <InlineLink
      {...args}
      onClick={(e) => e.preventDefault()}
      leadingIcon={showLeadingIcon ? <HugeiconsIcon icon={Link01Icon} /> : undefined}
      trailingIcon={showTrailingIcon ? <HugeiconsIcon icon={ArrowRight01Icon} /> : undefined}
    >
      {children}
    </InlineLink>
  ),
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6">
      <InlineLink
        href="#primary"
        onClick={(e) => e.preventDefault()}
        leadingIcon={<HugeiconsIcon icon={Link01Icon} />}
        trailingIcon={<HugeiconsIcon icon={ArrowRight01Icon} />}
      >
        Primary link
      </InlineLink>
      <InlineLink
        href="#destructive"
        variant="destructive"
        onClick={(e) => e.preventDefault()}
        leadingIcon={<HugeiconsIcon icon={Delete02Icon} />}
        trailingIcon={<HugeiconsIcon icon={ArrowRight01Icon} />}
      >
        Destructive link
      </InlineLink>
      <InlineLink
        href="#assistive"
        variant="assistive"
        onClick={(e) => e.preventDefault()}
        leadingIcon={<HugeiconsIcon icon={SparklesIcon} />}
        trailingIcon={<HugeiconsIcon icon={ArrowRight01Icon} />}
      >
        Assistive link
      </InlineLink>
      <InlineLink
        href="#disabled"
        disabled
        leadingIcon={<HugeiconsIcon icon={Link01Icon} />}
        trailingIcon={<HugeiconsIcon icon={ArrowRight01Icon} />}
      >
        Disabled link
      </InlineLink>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6">
      <InlineLink
        href="#sm"
        size="sm"
        onClick={(e) => e.preventDefault()}
        leadingIcon={<HugeiconsIcon icon={Link01Icon} />}
        trailingIcon={<HugeiconsIcon icon={ArrowRight01Icon} />}
      >
        Small (12px)
      </InlineLink>
      <InlineLink
        href="#md"
        size="md"
        onClick={(e) => e.preventDefault()}
        leadingIcon={<HugeiconsIcon icon={Link01Icon} />}
        trailingIcon={<HugeiconsIcon icon={ArrowRight01Icon} />}
      >
        Medium (14px)
      </InlineLink>
      <InlineLink
        href="#lg"
        size="lg"
        onClick={(e) => e.preventDefault()}
        leadingIcon={<HugeiconsIcon icon={Link01Icon} />}
        trailingIcon={<HugeiconsIcon icon={ArrowRight01Icon} />}
      >
        Large (16px)
      </InlineLink>
    </div>
  ),
}

export const InParagraph: Story = {
  render: () => (
    <p className="max-w-md text-sm text-foreground">
      Review the{' '}
      <InlineLink href="#docs" onClick={(e) => e.preventDefault()}>
        workspace documentation
      </InlineLink>{' '}
      before you{' '}
      <InlineLink
        href="#delete"
        variant="destructive"
        onClick={(e) => e.preventDefault()}
      >
        remove synced folders
      </InlineLink>{' '}
      or ask{' '}
      <InlineLink
        href="#ai"
        variant="assistive"
        onClick={(e) => e.preventDefault()}
        leadingIcon={<HugeiconsIcon icon={SparklesIcon} />}
      >
        Writing Assistant
      </InlineLink>
      .
    </p>
  ),
}
