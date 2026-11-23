import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlertDialogExample } from '../shadcnExamples'

const meta = { title: 'Components/Alert Dialog' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <AlertDialogExample /> }
export const Compact: Story = { render: () => <AlertDialogExample size="sm" /> }
