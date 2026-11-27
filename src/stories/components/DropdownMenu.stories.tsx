import type { Meta, StoryObj } from '@storybook/react-vite'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
  Folder01Icon,
} from '@hugeicons/core-free-icons'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DropdownMenuExample } from '../shadcnExamples'

type PlaygroundArgs = {
  side: 'bottom' | 'top' | 'left' | 'right'
  align: 'start' | 'center' | 'end'
  showShortcuts: boolean
  showGroupTitleAction: boolean
  bottomSheet: boolean
}

const meta = {
  title: 'Components/Dropdown Menu',
  tags: ['autodocs'],
  argTypes: {
    side: {
      control: 'select',
      options: ['bottom', 'top', 'left', 'right'],
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
    },
    showShortcuts: { control: 'boolean' },
    showGroupTitleAction: { control: 'boolean' },
    bottomSheet: { control: 'boolean' },
  },
  args: {
    side: 'bottom',
    align: 'start',
    showShortcuts: true,
    showGroupTitleAction: true,
    bottomSheet: false,
  },
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

export const Playground: Story = {
  render: ({ side, align, showShortcuts, showGroupTitleAction, bottomSheet }) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Open menu</Button>} />
      <DropdownMenuContent
        className="w-64"
        side={side}
        align={align}
        bottomSheet={bottomSheet}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel
            trailingAction={
              showGroupTitleAction ? (
                <span className="text-[length:var(--token-typography-font-size-12)] text-[var(--token-colors-foreground-elevated)]">
                  4 items
                </span>
              ) : undefined
            }
          >
            Document actions
          </DropdownMenuLabel>
          <DropdownMenuItem>
            <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
            Rename
            {showShortcuts && <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
            Duplicate
            {showShortcuts && <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
            Move to folder
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            Export (disabled)
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
          Move to trash
          {showShortcuts && <DropdownMenuShortcut>⌫</DropdownMenuShortcut>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

export const Default: Story = {
  render: () => <DropdownMenuExample />,
}
