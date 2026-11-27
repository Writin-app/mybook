import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'

import { Switch, SwitchField, type SwitchProps } from '@/components/ui/switch'
import { SwitchExample } from '../shadcnExamples'

type PlaygroundArgs = SwitchProps & {
  label?: string
  caption?: string
}

const meta = {
  title: 'Components/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    'aria-invalid': { control: 'boolean' },
    label: { control: 'text' },
    caption: { control: 'text' },
  },
  args: {
    size: 'md',
    checked: true,
    disabled: false,
    'aria-invalid': false,
    label: 'Enable live sync',
    caption: 'Sync editor updates across devices',
  },
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

function SwitchPlayground({ label, caption, ...args }: PlaygroundArgs) {
  const [checked, setChecked] = useState(Boolean(args.checked))

  useEffect(() => {
    setChecked(Boolean(args.checked))
  }, [args.checked])

  return (
    <SwitchField
      {...args}
      label={label}
      caption={caption}
      checked={checked}
      onCheckedChange={(next) => setChecked(Boolean(next))}
    />
  )
}

export const Playground: Story = {
  render: (args) => <SwitchPlayground {...args} />,
}

export const Default: Story = {
  render: () => <SwitchExample />,
}

export const SizesWithLabels: Story = {
  name: 'Sizes with Labels',
  render: () => (
    <div className="grid gap-6 max-w-xs">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <SwitchField
          key={size}
          size={size}
          defaultChecked
          label={`${size.toUpperCase()} — Enable live sync`}
          caption={`${size} caption · Sync editor updates across devices`}
        />
      ))}
    </div>
  ),
}

export const SizesAndStates: Story = {
  render: () => (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <Switch size="sm" aria-label="Small off" />
        <Switch size="sm" defaultChecked aria-label="Small on" />
        <Switch size="md" aria-label="Medium off" />
        <Switch size="md" defaultChecked aria-label="Medium on" />
        <Switch size="lg" aria-label="Large off" />
        <Switch size="lg" defaultChecked aria-label="Large on" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Switch disabled aria-label="Disabled off" />
        <Switch disabled defaultChecked aria-label="Disabled on" />
        <Switch aria-invalid aria-label="Invalid off" />
        <Switch aria-invalid defaultChecked aria-label="Invalid on" />
      </div>
    </div>
  ),
}
