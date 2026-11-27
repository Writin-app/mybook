import type { Meta, StoryObj } from "@storybook/react"
import { StatusIndicator } from "@/components/ui/status-indicator"
import type { StatusIndicatorSize, StatusIndicatorStatus } from "@/components/ui/status-indicator"

const meta = {
  title: "Components/StatusIndicator",
  component: StatusIndicator,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg", "xl", "2xl"] satisfies StatusIndicatorSize[],
      description: "Size of the status indicator dot",
    },
    status: {
      control: "select",
      options: ["offline", "online", "away", "busy"] satisfies StatusIndicatorStatus[],
      description: "Presence status",
    },
    withIcon: {
      control: "boolean",
      description: "Show icon inside (only for lg/xl/2xl sizes)",
    },
  },
  args: {
    size: "md",
    status: "online",
    withIcon: false,
  },
} satisfies Meta<typeof StatusIndicator>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const AllStatuses: Story = {
  name: "All Statuses",
  render: () => (
    <div className="flex items-center gap-6">
      {(["offline", "online", "away", "busy"] as StatusIndicatorStatus[]).map((status) => (
        <div key={status} className="flex flex-col items-center gap-2">
          <StatusIndicator size="lg" status={status} />
          <span className="text-xs text-[var(--token-colors-foreground-secondary)] capitalize font-[family-name:var(--token-typography-font-family-primary)]">
            {status}
          </span>
        </div>
      ))}
    </div>
  ),
}

export const AllSizes: Story = {
  name: "All Sizes",
  render: () => (
    <div className="flex items-end gap-6">
      {(["xs", "sm", "md", "lg", "xl", "2xl"] as StatusIndicatorSize[]).map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <StatusIndicator size={size} status="online" />
          <span className="text-xs text-[var(--token-colors-foreground-secondary)] font-[family-name:var(--token-typography-font-family-primary)]">
            {size}
          </span>
        </div>
      ))}
    </div>
  ),
}

export const Grid: Story = {
  name: "Status × Size Grid",
  render: () => (
    <div className="flex flex-col gap-4">
      {(["offline", "online", "away", "busy"] as StatusIndicatorStatus[]).map((status) => (
        <div key={status} className="flex items-center gap-4">
          <span className="w-16 text-xs text-[var(--token-colors-foreground-secondary)] capitalize font-[family-name:var(--token-typography-font-family-primary)]">
            {status}
          </span>
          {(["xs", "sm", "md", "lg", "xl", "2xl"] as StatusIndicatorSize[]).map((size) => (
            <StatusIndicator key={size} size={size} status={status} />
          ))}
        </div>
      ))}
    </div>
  ),
}
