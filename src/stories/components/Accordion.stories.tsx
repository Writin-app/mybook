import type { Meta, StoryObj } from '@storybook/react-vite'
import { AccordionExample } from '../shadcnExamples'

const meta = { title: 'Components/Accordion' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <AccordionExample /> }

export const Grouped: Story = { render: () => <AccordionExample variant="grouped" /> }
