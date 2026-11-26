import type { Meta, StoryObj } from "@storybook/react"
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupItem,
  AvatarGroupCount,
  AvatarAdd,
} from "@/components/ui/avatar"
import type { AvatarSize } from "@/components/ui/avatar"
import type { StatusIndicatorStatus } from "@/components/ui/status-indicator"

const SIZES: AvatarSize[] = ["xs", "sm", "md", "lg", "xl", "2xl"]
const STATUSES: StatusIndicatorStatus[] = ["offline", "online", "away", "busy"]

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: SIZES,
      description: "Avatar size",
    },
    variant: {
      control: "radio",
      options: ["filled", "empty"],
      description: "Filled (solid bg) or empty (dashed border)",
    },
    status: {
      control: "select",
      options: [undefined, ...STATUSES],
      description: "Status indicator badge",
    },
  },
  args: {
    size: "md",
    variant: "filled",
    status: undefined,
  },
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback size={args.size} />
    </Avatar>
  ),
}

export const WithInitials: Story = {
  name: "Initials Fallback",
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback size={args.size} initials="JD" />
    </Avatar>
  ),
}

export const WithImage: Story = {
  name: "With Image",
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="https://picsum.photos/seed/avatar/80/80" />
      <AvatarFallback size={args.size} initials="JD" />
    </Avatar>
  ),
}

export const AllSizes: Story = {
  name: "All Sizes",
  render: () => (
    <div className="flex items-end gap-4">
      {SIZES.map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <Avatar size={size}>
            <AvatarFallback size={size} initials="JD" />
          </Avatar>
          <span className="text-xs text-[var(--token-colors-foreground-secondary)] font-[family-name:var(--token-typography-font-family-primary)]">
            {size}
          </span>
        </div>
      ))}
    </div>
  ),
}

export const WithStatus: Story = {
  name: "With Status Indicators",
  render: () => (
    <div className="flex items-end gap-6">
      {STATUSES.map((status) => (
        <div key={status} className="flex flex-col items-center gap-2">
          <Avatar size="lg" status={status}>
            <AvatarFallback size="lg" initials="AB" />
          </Avatar>
          <span className="text-xs text-[var(--token-colors-foreground-secondary)] capitalize font-[family-name:var(--token-typography-font-family-primary)]">
            {status}
          </span>
        </div>
      ))}
    </div>
  ),
}

export const AllSizesWithStatus: Story = {
  name: "All Sizes with Status",
  render: () => (
    <div className="flex items-end gap-4">
      {SIZES.map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <Avatar size={size} status="online">
            <AvatarFallback size={size} initials="JD" />
          </Avatar>
          <span className="text-xs text-[var(--token-colors-foreground-secondary)] font-[family-name:var(--token-typography-font-family-primary)]">
            {size}
          </span>
        </div>
      ))}
    </div>
  ),
}

export const EmptyVariant: Story = {
  name: "Empty (Add) Variant",
  render: () => (
    <div className="flex items-end gap-4">
      {SIZES.map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <AvatarAdd size={size} />
          <span className="text-xs text-[var(--token-colors-foreground-secondary)] font-[family-name:var(--token-typography-font-family-primary)]">
            {size}
          </span>
        </div>
      ))}
    </div>
  ),
}

export const Group: Story = {
  name: "Avatar Group",
  render: () => (
    <div className="flex flex-col gap-6">
      {SIZES.map((size) => (
        <div key={size} className="flex items-center gap-4">
          <span className="w-8 text-xs text-[var(--token-colors-foreground-secondary)] font-[family-name:var(--token-typography-font-family-primary)]">
            {size}
          </span>
          <AvatarGroup size={size}>
            {["JD", "MK", "AB", "SR"].map((initials, i) => (
              <AvatarGroupItem key={i} size={size}>
                <AvatarFallback size={size} initials={initials} />
              </AvatarGroupItem>
            ))}
            <AvatarGroupCount size={size} count={12} />
          </AvatarGroup>
        </div>
      ))}
    </div>
  ),
}

export const GroupWithImages: Story = {
  name: "Group with Images",
  render: () => (
    <AvatarGroup size="md">
      {[1, 2, 3, 4].map((seed) => (
        <AvatarGroupItem key={seed} size="md">
          <AvatarImage src={`https://picsum.photos/seed/${seed}/80/80`} />
          <AvatarFallback size="md" initials="?" />
        </AvatarGroupItem>
      ))}
      <AvatarGroupCount size="md" count={8} />
    </AvatarGroup>
  ),
}
