import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  ArrowRightIcon,
  CheckIcon,
  EllipsisHorizontalIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

import { Button, type ButtonProps } from '@/components/ui/button'
import { ButtonExample } from '../shadcnExamples'

type PlaygroundArgs = ButtonProps & {
  showLeadingIcon?: boolean
  showTrailingIcon?: boolean
}

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'outline',
        'ghost',
        'destructive',
        'assist',
        'link',
        'link-destructive',
        'link-assistive',
      ],
    },
    size: {
      control: 'select',
      options: [
        'xs',
        'sm',
        'default',
        'lg',
        'icon-xs',
        'icon-sm',
        'icon',
        'icon-lg',
      ],
    },
    children: { control: 'text' },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    loadingText: { control: 'text' },
    showLeadingIcon: { control: 'boolean' },
    showTrailingIcon: { control: 'boolean' },
  },
  args: {
    variant: 'default',
    size: 'default',
    children: 'Button',
    disabled: false,
    loading: false,
    loadingText: 'Loading...',
    showLeadingIcon: false,
    showTrailingIcon: false,
  },
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

export const Playground: Story = {
  render: ({ showLeadingIcon, showTrailingIcon, children, size, ...args }) => {
    const isIconOnly =
      size === 'icon' ||
      size === 'icon-xs' ||
      size === 'icon-sm' ||
      size === 'icon-lg'

    return (
      <Button
        {...args}
        size={size}
        aria-label={isIconOnly ? String(children || 'Action') : undefined}
        leadingIcon={
          !isIconOnly && showLeadingIcon ? <PlusIcon aria-hidden="true" /> : undefined
        }
        trailingIcon={
          !isIconOnly && showTrailingIcon ? (
            <ArrowRightIcon aria-hidden="true" />
          ) : undefined
        }
      >
        {isIconOnly ? <PlusIcon aria-hidden="true" /> : children}
      </Button>
    )
  },
}

export const Variants: Story = {
  render: () => <ButtonExample />,
}

export const Sizes: Story = {
  render: () => (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="xs">Extra small (24px)</Button>
        <Button size="sm">Small (32px)</Button>
        <Button size="default">Default (40px)</Button>
        <Button size="lg">Large (48px)</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="icon-xs" aria-label="Icon xs">
          <PlusIcon aria-hidden="true" />
        </Button>
        <Button size="icon-sm" aria-label="Icon sm">
          <PlusIcon aria-hidden="true" />
        </Button>
        <Button size="icon" aria-label="Icon default">
          <PlusIcon aria-hidden="true" />
        </Button>
        <Button size="icon-lg" aria-label="Icon lg">
          <PlusIcon aria-hidden="true" />
        </Button>
      </div>
    </div>
  ),
}

export const WithIcons: Story = {
  render: () => (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button leadingIcon={<PlusIcon aria-hidden="true" />}>New page</Button>
        <Button
          variant="secondary"
          trailingIcon={<ArrowRightIcon aria-hidden="true" />}
        >
          Continue
        </Button>
        <Button
          variant="outline"
          leadingIcon={<CheckIcon aria-hidden="true" />}
          trailingIcon={<ArrowRightIcon aria-hidden="true" />}
        >
          Confirm
        </Button>
        <Button
          variant="destructive"
          leadingIcon={<TrashIcon aria-hidden="true" />}
        >
          Delete
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="icon" aria-label="More options">
          <EllipsisHorizontalIcon aria-hidden="true" />
        </Button>
        <Button size="icon" variant="secondary" aria-label="Add item">
          <PlusIcon aria-hidden="true" />
        </Button>
        <Button size="icon" variant="outline" aria-label="Confirm">
          <CheckIcon aria-hidden="true" />
        </Button>
        <Button size="icon" variant="ghost" aria-label="More">
          <EllipsisHorizontalIcon aria-hidden="true" />
        </Button>
        <Button size="icon" variant="destructive" aria-label="Delete">
          <TrashIcon aria-hidden="true" />
        </Button>
      </div>
    </div>
  ),
}

export const LoadingStates: Story = {
  render: () => (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button loading loadingText="Saving...">
          Save
        </Button>
        <Button variant="secondary" loading loadingText="Syncing...">
          Sync
        </Button>
        <Button variant="outline" loading loadingText="Loading...">
          Load
        </Button>
        <Button variant="destructive" loading loadingText="Deleting...">
          Delete
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="icon-xs" loading aria-label="Loading xs" />
        <Button size="icon-sm" loading aria-label="Loading sm" />
        <Button size="icon" loading aria-label="Loading" />
        <Button size="icon-lg" loading aria-label="Loading lg" />
      </div>
    </div>
  ),
}

export const DisabledStates: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>Default</Button>
      <Button variant="secondary" disabled>
        Secondary
      </Button>
      <Button variant="outline" disabled>
        Outline
      </Button>
      <Button variant="ghost" disabled>
        Ghost
      </Button>
      <Button variant="destructive" disabled>
        Destructive
      </Button>
      <Button variant="assist" disabled>
        Assist
      </Button>
      <Button variant="link" disabled>
        Link
      </Button>
    </div>
  ),
}
