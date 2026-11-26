import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'

import { RadioGroup, RadioGroupItem, RadioGroupItemField } from '@/components/ui/radio-group'
import { RadioGroupExample } from '../shadcnExamples'

type PlaygroundArgs = {
  size: 'sm' | 'md' | 'lg'
  value: string
  disabled: boolean
  invalid: boolean
}

const meta = {
  title: 'Components/Radio Group',
  component: RadioGroup,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    value: {
      control: 'select',
      options: ['local', 'drive', 'hybrid'],
    },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
  },
  args: {
    size: 'md',
    value: 'local',
    disabled: false,
    invalid: false,
  },
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

function RadioGroupPlayground({ size, value, disabled, invalid }: PlaygroundArgs) {
  const [selected, setSelected] = useState(value)

  useEffect(() => {
    setSelected(value)
  }, [value])

  return (
    <RadioGroup
      value={selected}
      onValueChange={(next) => setSelected(String(next))}
      disabled={disabled}
    >
      <RadioGroupItemField
        id="r-local" value="local" size={size} aria-invalid={invalid}
        label="Local vault"
        caption="Store documents on this device only"
      />
      <RadioGroupItemField
        id="r-drive" value="drive" size={size} aria-invalid={invalid}
        label="Google Drive"
        caption="Sync to your Drive automatically"
      />
      <RadioGroupItemField
        id="r-hybrid" value="hybrid" size={size} aria-invalid={invalid}
        label="Local + Drive sync"
        caption="Best of both: local speed, cloud backup"
      />
    </RadioGroup>
  )
}

export const Playground: Story = {
  render: (args) => <RadioGroupPlayground {...args} />,
}

export const Default: Story = {
  render: () => <RadioGroupExample />,
}

export const SizesWithLabels: Story = {
  name: 'Sizes with Labels',
  render: () => (
    <div className="grid gap-8">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size}>
          <div className="mb-2 text-xs text-[var(--token-colors-foreground-secondary)] font-[family-name:var(--token-typography-font-family-primary)] uppercase tracking-wide">
            Size: {size}
          </div>
          <RadioGroup defaultValue="a" className="gap-3">
            <RadioGroupItemField
              value="a" size={size}
              label={`${size} · Primary option label`}
              caption={`Caption text scales with size (${size})`}
            />
            <RadioGroupItemField
              value="b" size={size}
              label={`${size} · Secondary option`}
              caption="Another caption description"
            />
          </RadioGroup>
        </div>
      ))}
    </div>
  ),
}

export const SizesAndStates: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6">
      <RadioGroup defaultValue="sm" className="flex w-auto items-center gap-3">
        <RadioGroupItem value="sm" size="sm" aria-label="Small checked" />
        <RadioGroupItem value="sm-off" size="sm" aria-label="Small unchecked" />
      </RadioGroup>
      <RadioGroup defaultValue="md" className="flex w-auto items-center gap-3">
        <RadioGroupItem value="md" size="md" aria-label="Medium checked" />
        <RadioGroupItem value="md-off" size="md" aria-label="Medium unchecked" />
      </RadioGroup>
      <RadioGroup defaultValue="lg" className="flex w-auto items-center gap-3">
        <RadioGroupItem value="lg" size="lg" aria-label="Large checked" />
        <RadioGroupItem value="lg-off" size="lg" aria-label="Large unchecked" />
      </RadioGroup>
      <RadioGroup defaultValue="dis" disabled className="flex w-auto items-center gap-3">
        <RadioGroupItem value="dis" aria-label="Disabled checked" />
        <RadioGroupItem value="dis-off" aria-label="Disabled unchecked" />
      </RadioGroup>
    </div>
  ),
}
