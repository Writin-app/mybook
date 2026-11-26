import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon, Delete02Icon } from '@hugeicons/core-free-icons'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { AlertDialogExample } from '../shadcnExamples'

type PlaygroundArgs = {
  size: 'default' | 'sm'
  align: 'start' | 'center'
  title: string
  description: string
  showMedia: boolean
  destructive: boolean
  cancelLabel: string
  actionLabel: string
  open: boolean
}

const meta = {
  title: 'Components/Alert Dialog',
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['default', 'sm'],
    },
    align: {
      control: 'inline-radio',
      options: ['start', 'center'],
    },
    title: { control: 'text' },
    description: { control: 'text' },
    showMedia: { control: 'boolean' },
    destructive: { control: 'boolean' },
    cancelLabel: { control: 'text' },
    actionLabel: { control: 'text' },
    open: { control: 'boolean' },
  },
  args: {
    size: 'default',
    align: 'start',
    title: 'Are you absolutely sure?',
    description:
      'This action cannot be undone. This will permanently delete your account from our servers.',
    showMedia: true,
    destructive: false,
    cancelLabel: 'Cancel',
    actionLabel: 'Continue',
    open: false,
  },
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

function AlertDialogPlayground({
  size,
  align,
  title,
  description,
  showMedia,
  destructive,
  cancelLabel,
  actionLabel,
  open,
}: PlaygroundArgs) {
  const [isOpen, setIsOpen] = useState(open)

  useEffect(() => {
    setIsOpen(open)
  }, [open])

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger render={<Button variant="outline">Open alert dialog</Button>} />
      <AlertDialogContent size={size} align={align}>
        <AlertDialogHeader>
          {showMedia ? (
            <AlertDialogMedia>
              <HugeiconsIcon
                icon={destructive ? Delete02Icon : Alert02Icon}
                strokeWidth={2}
              />
            </AlertDialogMedia>
          ) : null}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => setIsOpen(false)}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export const Playground: Story = {
  render: (args) => <AlertDialogPlayground {...args} />,
}

export const Default: Story = {
  render: () => <AlertDialogExample />,
}

export const SmallWithMedia: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline">Open small dialog</Button>} />
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
          </AlertDialogMedia>
          <AlertDialogTitle>Allow sync access?</AlertDialogTitle>
          <AlertDialogDescription>
            This lets Writin back up your local vault to Google Drive automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Allow</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
}

export const DestructiveConfirmation: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive">Delete folder</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete workspace folder?</AlertDialogTitle>
          <AlertDialogDescription>
            All documents inside this folder will be moved to trash.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep folder</AlertDialogCancel>
          <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
}
