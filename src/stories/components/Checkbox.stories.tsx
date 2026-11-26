import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'

import { Checkbox, CheckboxField, type CheckboxFieldProps } from '@/components/ui/checkbox'
import { CheckboxExample } from '../shadcnExamples'

const meta = {
  title: 'Components/Checkbox',
  component: CheckboxField,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    label: { control: 'text' },
    caption: { control: 'text' },
    checked: { control: 'boolean' },
    indeterminate: { control: 'boolean' },
    disabled: { control: 'boolean' },
    'aria-invalid': { control: 'boolean' },
  },
  args: {
    size: 'md',
    label: 'Sync changes automatically',
    caption: 'Keep local edits backed up to Google Drive',
    checked: false,
    indeterminate: false,
    disabled: false,
    'aria-invalid': false,
  },
} satisfies Meta<CheckboxFieldProps>

export default meta
type Story = StoryObj<CheckboxFieldProps>

function CheckboxPlayground(args: CheckboxFieldProps) {
  const [checked, setChecked] = useState(Boolean(args.checked))

  useEffect(() => {
    setChecked(Boolean(args.checked))
  }, [args.checked])

  return (
    <CheckboxField
      {...args}
      checked={checked}
      onCheckedChange={(next) => setChecked(Boolean(next))}
    />
  )
}

export const Playground: Story = {
  render: (args) => <CheckboxPlayground {...args} />,
}

export const Default: Story = {
  render: () => <CheckboxExample />,
}

export const SizesWithLabels: Story = {
  name: 'Sizes with Labels',
  render: () => (
    <div className="grid gap-6 max-w-xs">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <CheckboxField
          key={size}
          size={size}
          defaultChecked
          label={`${size.toUpperCase()} — Sync changes automatically`}
          caption={`${size} caption · Keep local edits backed up`}
        />
      ))}
    </div>
  ),
}

export const SizesAndStates: Story = {
  render: () => (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Checkbox size="sm" aria-label="Small unchecked" />
        <Checkbox size="sm" defaultChecked aria-label="Small checked" />
        <Checkbox size="sm" indeterminate aria-label="Small indeterminate" />
        <Checkbox size="md" aria-label="Medium unchecked" />
        <Checkbox size="md" defaultChecked aria-label="Medium checked" />
        <Checkbox size="md" indeterminate aria-label="Medium indeterminate" />
        <Checkbox size="lg" aria-label="Large unchecked" />
        <Checkbox size="lg" defaultChecked aria-label="Large checked" />
        <Checkbox size="lg" indeterminate aria-label="Large indeterminate" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Checkbox disabled aria-label="Disabled unchecked" />
        <Checkbox disabled defaultChecked aria-label="Disabled checked" />
        <Checkbox aria-invalid aria-label="Invalid unchecked" />
        <Checkbox aria-invalid defaultChecked aria-label="Invalid checked" />
      </div>
    </div>
  ),
}

export const CheckboxGroup: Story = {
  render: () => (
    <div className="grid max-w-sm gap-4">
      <CheckboxField
        size="md"
        defaultChecked
        label="Offline cache"
        caption="Store recent documents in IndexedDB"
      />
      <CheckboxField
        size="md"
        label="Auto-backup"
        caption="Create a snapshot before major edits"
      />
      <CheckboxField
        size="md"
        disabled
        label="Shared workspace lock"
        caption="Managed by workspace administrator"
      />
    </div>
  ),
}
