import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TooltipExample } from '../shadcnExamples'

type PlaygroundArgs = {
  label: string
  supportingText: string
  showSupportingText: boolean
  side: 'top' | 'bottom' | 'left' | 'right'
  align: 'start' | 'center' | 'end'
  showArrow: boolean
  open: boolean
}

const meta = {
  title: 'Components/Tooltip',
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    supportingText: { control: 'text' },
    showSupportingText: { control: 'boolean' },
    side: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
    },
    showArrow: { control: 'boolean' },
    open: { control: 'boolean' },
  },
  args: {
    label: 'This is a tooltip',
    supportingText:
      'Tooltips are used to describe or identify an element. In most scenarios, tooltips help the user understand the meaning, function or alt-text of an element.',
    showSupportingText: false,
    side: 'top',
    align: 'center',
    showArrow: true,
    open: true,
  },
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

export const Playground: Story = {
  render: ({ label, supportingText, showSupportingText, side, align, showArrow, open }) => (
    <div className="flex min-h-48 items-center justify-center p-12">
      <Tooltip open={open ? true : undefined}>
        <TooltipTrigger render={<Button variant="outline">Hover or focus me</Button>} />
        <TooltipContent
          side={side}
          align={align}
          showArrow={showArrow}
          supportingText={showSupportingText ? supportingText : undefined}
        >
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  ),
}

export const Default: Story = {
  render: () => <TooltipExample />,
}

export const Positions: Story = {
  render: () => (
    <div className="grid grid-cols-2 place-items-center gap-x-36 gap-y-24 py-16">
      <Tooltip defaultOpen>
        <TooltipTrigger render={<Button variant="outline">Top</Button>} />
        <TooltipContent side="top">Top tooltip</TooltipContent>
      </Tooltip>
      <Tooltip defaultOpen>
        <TooltipTrigger render={<Button variant="outline">Bottom</Button>} />
        <TooltipContent side="bottom">Bottom tooltip</TooltipContent>
      </Tooltip>
      <Tooltip defaultOpen>
        <TooltipTrigger render={<Button variant="outline">Left</Button>} />
        <TooltipContent side="left">Left tooltip</TooltipContent>
      </Tooltip>
      <Tooltip defaultOpen>
        <TooltipTrigger render={<Button variant="outline">Right</Button>} />
        <TooltipContent side="right">Right tooltip</TooltipContent>
      </Tooltip>
    </div>
  ),
}

export const WithSupportingText: Story = {
  render: () => (
    <div className="flex min-h-48 items-center justify-center p-12">
      <Tooltip open>
        <TooltipTrigger render={<Button variant="outline">Rich tooltip</Button>} />
        <TooltipContent
          side="bottom"
          supportingText="Tooltips are used to describe or identify an element. In most scenarios, tooltips help the user understand the meaning, function or alt-text of an element."
        >
          This is a tooltip
        </TooltipContent>
      </Tooltip>
    </div>
  ),
}
