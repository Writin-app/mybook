import type { Meta, StoryObj } from '@storybook/react-vite'

import { Separator } from '@/components/ui/separator'
import { SeparatorExample } from '../shadcnExamples'

type PlaygroundArgs = {
  orientation: 'horizontal' | 'vertical'
}

const meta = {
  title: 'Components/Separator',
  component: Separator,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
  },
  args: {
    orientation: 'horizontal',
  },
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

export const Playground: Story = {
  render: ({ orientation }) =>
    orientation === 'vertical' ? (
      <div className="flex h-8 items-center gap-3 text-sm">
        <span>Left</span>
        <Separator orientation="vertical" />
        <span>Right</span>
      </div>
    ) : (
      <div className="w-64 space-y-3 text-sm">
        <div>Above</div>
        <Separator orientation="horizontal" />
        <div>Below</div>
      </div>
    ),
}

export const Default: Story = {
  render: () => <SeparatorExample />,
}
