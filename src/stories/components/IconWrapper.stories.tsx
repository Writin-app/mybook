import type { Meta, StoryObj } from '@storybook/react-vite'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Folder01Icon,
  Search01Icon,
  Settings01Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'

import { IconWrapper, type IconWrapperProps } from '@/components/ui/icon-wrapper'

const sizes = ['12', '16', '20', '24', '32', '40', '48', '56', '64'] as const

const iconMap = {
  add: Add01Icon,
  folder: Folder01Icon,
  search: Search01Icon,
  settings: Settings01Icon,
  sparkles: SparklesIcon,
} as const

type PlaygroundArgs = IconWrapperProps & {
  iconName?: keyof typeof iconMap
}

const meta = {
  title: 'Components/IconWrapper',
  component: IconWrapper,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: [...sizes],
    },
    iconName: {
      control: 'select',
      options: Object.keys(iconMap),
    },
  },
  args: {
    size: '24',
    iconName: 'sparkles',
  },
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

export const Playground: Story = {
  render: ({ iconName = 'sparkles', size, ...args }) => (
    <div className="inline-flex items-center justify-center rounded-lg border border-dashed border-[var(--app-border)] p-4">
      <IconWrapper {...args} size={size}>
        <HugeiconsIcon icon={iconMap[iconName]} />
      </IconWrapper>
    </div>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-6">
      {sizes.map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <div className="inline-flex items-center justify-center rounded-md border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] p-1">
            <IconWrapper size={size}>
              <HugeiconsIcon icon={SparklesIcon} />
            </IconWrapper>
          </div>
          <span className="text-xs text-muted-foreground">{size}px</span>
        </div>
      ))}
    </div>
  ),
}
