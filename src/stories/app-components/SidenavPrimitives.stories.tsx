import type { Meta, StoryObj } from "@storybook/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Clock01Icon,
  Folder01Icon,
  Home01Icon,
  Settings01Icon,
  StarIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"

import {
  NavGroup,
  NavItem,
  TrailingContent,
  type NavItemSize,
  type NavItemState,
  type TrailingContentType,
} from "@/components/layout/sidenav/SidenavPrimitives"

const meta = {
  title: "Components/Sidenav/NavItem",
  component: NavItem,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "radio",
      options: ["sm", "md"] satisfies NavItemSize[],
      description: "Row height, icon size, and typography scale",
    },
    state: {
      control: "select",
      options: ["default", "hover", "active", "focus", "disabled"] satisfies NavItemState[],
      description: "Visual interaction state",
    },
    leading: { control: "boolean" },
    active: { control: "boolean" },
    disabled: { control: "boolean" },
    label: { control: "text" },
  },
  args: {
    label: "Nav item",
    size: "sm",
    state: "default",
    leading: true,
    active: false,
    disabled: false,
  },
  decorators: [
    (Story) => (
      <div className="w-[340px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NavItem>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  render: (args) => (
    <NavItem
      {...args}
      icon={<HugeiconsIcon icon={Home01Icon} strokeWidth={1.75} />}
      trailingContent={{ type: "badge", label: "Badge" }}
      trailingAction
    />
  ),
}

export const AllStates: Story = {
  name: "NavItem — All States (sm & md)",
  render: () => (
    <div className="flex w-[340px] max-w-full flex-col gap-6">
      {(["sm", "md"] as NavItemSize[]).map((size) => (
        <div key={size} className="flex flex-col gap-1">
          <div className="mb-1 px-2 font-[family-name:var(--token-typography-font-family-primary)] text-xs text-[var(--token-colors-foreground-secondary)]">
            size=&quot;{size}&quot;
          </div>
          {(["default", "hover", "active", "focus", "disabled"] as NavItemState[]).map(
            (state) => (
              <NavItem
                key={state}
                size={size}
                state={state}
                label={`State: ${state}`}
                icon={<HugeiconsIcon icon={Folder01Icon} strokeWidth={1.75} />}
                trailingContent={{ type: "badge", label: "Badge" }}
                trailingAction
              />
            )
          )}
        </div>
      ))}
    </div>
  ),
}

export const TrailingContentVariants: Story = {
  name: "TrailingContent — Badge, Count, Kbd",
  render: () => (
    <div className="flex w-[340px] max-w-full flex-col gap-4">
      {(["sm", "md"] as NavItemSize[]).map((size) => (
        <div key={size} className="flex flex-col gap-2">
          <div className="px-2 font-[family-name:var(--token-typography-font-family-primary)] text-xs text-[var(--token-colors-foreground-secondary)]">
            size=&quot;{size}&quot;
          </div>
          <div className="flex items-center gap-4 px-2">
            {(["badge", "count", "kbd"] as TrailingContentType[]).map((type) => (
              <TrailingContent key={type} type={type} size={size} />
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
}

export const NavGroupExample: Story = {
  name: "NavGroup — With Title, Link & Separator",
  render: () => (
    <div className="flex w-[340px] max-w-full flex-col gap-2">
      <NavGroup title="Workspace" actionLabel="See all" onActionClick={() => {}}>
        <NavItem
          label="Recent"
          active
          icon={<HugeiconsIcon icon={Clock01Icon} strokeWidth={1.75} />}
          trailingContent={{ type: "count", label: "12" }}
        />
        <NavItem
          label="Library"
          icon={<HugeiconsIcon icon={Folder01Icon} strokeWidth={1.75} />}
          trailingContent={{ type: "badge", label: "New" }}
          trailingAction
        />
        <NavItem
          label="Favorites"
          icon={<HugeiconsIcon icon={StarIcon} strokeWidth={1.75} />}
          trailingAction
        />
      </NavGroup>

      <NavGroup title="System" showSeparator={false}>
        <NavItem
          label="Settings"
          icon={<HugeiconsIcon icon={Settings01Icon} strokeWidth={1.75} />}
          trailingContent={{ type: "kbd", label: "⌘," }}
        />
        <NavItem
          label="Trash"
          icon={<HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} />}
        />
      </NavGroup>
    </div>
  ),
}
