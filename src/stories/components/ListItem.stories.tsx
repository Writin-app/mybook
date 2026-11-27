import type { Meta, StoryObj } from "@storybook/react"
import {
  ListItem,
  ListItemMedia,
  ListItemActions,
  ListItemDefaultActions,
} from "@/components/ui/list-item"
import type {
  ListItemOrientation,
  ListItemSize,
  ListItemVariant,
  ListItemState,
  ListItemSelection,
} from "@/components/ui/list-item"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { WritinDocument } from "@/components/ui/writin-document"

const meta = {
  title: "Components/ListItem",
  component: ListItem,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"] satisfies ListItemOrientation[],
      description: "Layout orientation",
    },
    size: {
      control: "radio",
      options: ["sm", "md", "lg"] satisfies ListItemSize[],
      description: "Component size (affects padding, gap, radius, and typography)",
    },
    variant: {
      control: "select",
      options: ["default", "muted", "outline"] satisfies ListItemVariant[],
      description: "Visual style variant",
    },
    state: {
      control: "select",
      options: ["default", "hover", "focus", "selected", "disabled"] satisfies ListItemState[],
      description: "Interaction state",
    },
    selection: {
      control: "radio",
      options: ["none", "single", "multi"] satisfies ListItemSelection[],
      description: "Selection mode",
    },
    actionsVisibility: {
      control: "radio",
      options: ["always", "hover"],
      description: "Whether trailing actions are always visible or shown on hover/focus",
    },
    selected: { control: "boolean" },
    disabled: { control: "boolean" },
    title: { control: "text" },
    description: { control: "text" },
  },
  args: {
    orientation: "horizontal",
    size: "md",
    variant: "default",
    state: "default",
    selection: "none",
    actionsVisibility: "always",
    selected: false,
    disabled: false,
    title: "List item title",
    description: "List item description goes here",
  },
  decorators: [
    (Story) => (
      <div className="w-[520px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ListItem>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  render: (args) => (
    <ListItem
      {...args}
      media={
        <ListItemMedia>
          <WritinDocument size={args.size ?? "md"} />
        </ListItemMedia>
      }
      actions={
        args.orientation === "horizontal" ? (
          <ListItemDefaultActions size={args.size ?? "md"} />
        ) : undefined
      }
      footer={
        args.orientation === "vertical" ? (
          <ListItemActions>
            <ListItemDefaultActions size={args.size ?? "md"} />
          </ListItemActions>
        ) : undefined
      }
    />
  ),
}

export const AllSizes: Story = {
  name: "All Sizes (sm / md / lg)",
  render: () => (
    <div className="flex w-[520px] max-w-full flex-col gap-3">
      {(["sm", "md", "lg"] as ListItemSize[]).map((size) => (
        <div key={size}>
          <div className="mb-1 px-1 font-[family-name:var(--token-typography-font-family-primary)] text-xs text-[var(--token-colors-foreground-secondary)]">
            size=&quot;{size}&quot;
          </div>
          <ListItem
            orientation="horizontal"
            size={size}
            variant="outline"
            title="List item title"
            description="List item description goes here"
            media={
              <ListItemMedia>
                <WritinDocument size={size} />
              </ListItemMedia>
            }
            actions={<ListItemDefaultActions size={size} />}
          />
        </div>
      ))}
    </div>
  ),
}

export const HorizontalDefault: Story = {
  name: "Horizontal — Default",
  render: () => (
    <div className="flex w-[520px] max-w-full flex-col gap-1">
      {["Project Brief.docx", "Design Tokens", "Meeting Notes", "API Reference"].map((title, i) => (
        <ListItem
          key={i}
          orientation="horizontal"
          size="md"
          variant="default"
          title={title}
          description="Modified today"
          media={
            <ListItemMedia>
              <WritinDocument size="md" />
            </ListItemMedia>
          }
          actions={<ListItemDefaultActions size="md" />}
        />
      ))}
    </div>
  ),
}

export const HorizontalWithAvatars: Story = {
  name: "Horizontal — With Avatars",
  render: () => (
    <div className="flex w-[520px] max-w-full flex-col gap-1">
      {[
        { name: "Jordan Davis", initials: "JD", desc: "Active now" },
        { name: "Maria Kim", initials: "MK", desc: "Away · 2h ago" },
        { name: "Alex Brown", initials: "AB", desc: "Offline" },
      ].map(({ name, initials, desc }) => (
        <ListItem
          key={name}
          orientation="horizontal"
          size="md"
          variant="default"
          title={name}
          description={desc}
          media={
            <Avatar size="md">
              <AvatarFallback size="md" initials={initials} />
            </Avatar>
          }
          actions={<ListItemDefaultActions size="md" />}
        />
      ))}
    </div>
  ),
}

export const HorizontalVariants: Story = {
  name: "Horizontal — All Variants",
  render: () => (
    <div className="flex w-[520px] max-w-full flex-col gap-3">
      {(["default", "muted", "outline"] as ListItemVariant[]).map((variant) => (
        <div key={variant}>
          <div className="mb-1 px-1 font-[family-name:var(--token-typography-font-family-primary)] text-xs capitalize text-[var(--token-colors-foreground-secondary)]">
            {variant}
          </div>
          <ListItem
            orientation="horizontal"
            size="md"
            variant={variant}
            title="List item title"
            description="List item description goes here"
            media={<WritinDocument size="md" />}
            actions={<ListItemDefaultActions size="md" />}
          />
        </div>
      ))}
    </div>
  ),
}

export const WithSelection: Story = {
  name: "With Selection Controls",
  render: () => (
    <div className="flex w-[520px] max-w-full flex-col gap-4">
      <div>
        <div className="mb-1 font-[family-name:var(--token-typography-font-family-primary)] text-xs text-[var(--token-colors-foreground-secondary)]">
          Multi-select (checkbox)
        </div>
        <div className="flex flex-col gap-1">
          <ListItem
            orientation="horizontal"
            selection="multi"
            selected
            title="Selected Item"
            description="Checked"
            media={<WritinDocument size="md" />}
            actions={<ListItemDefaultActions size="md" />}
          />
          <ListItem
            orientation="horizontal"
            selection="multi"
            title="Unchecked Item"
            description="Not selected"
            media={<WritinDocument size="md" />}
            actions={<ListItemDefaultActions size="md" />}
          />
        </div>
      </div>
      <div>
        <div className="mb-1 font-[family-name:var(--token-typography-font-family-primary)] text-xs text-[var(--token-colors-foreground-secondary)]">
          Single-select (radio)
        </div>
        <div className="flex flex-col gap-1">
          <ListItem
            orientation="horizontal"
            selection="single"
            selected
            title="Selected Item"
            description="Active"
            media={<WritinDocument size="md" />}
            actions={<ListItemDefaultActions size="md" />}
          />
          <ListItem
            orientation="horizontal"
            selection="single"
            title="Other Item"
            description="Inactive"
            media={<WritinDocument size="md" />}
            actions={<ListItemDefaultActions size="md" />}
          />
        </div>
      </div>
    </div>
  ),
}

export const VerticalVariants: Story = {
  name: "Vertical Orientation",
  render: () => (
    <div className="flex flex-wrap gap-4">
      {(["default", "muted", "outline"] as ListItemVariant[]).map((variant) => (
        <ListItem
          key={variant}
          orientation="vertical"
          size="md"
          variant={variant}
          title="List item title"
          description="List item description goes here"
          media={
            <ListItemMedia>
              <WritinDocument size="md" />
            </ListItemMedia>
          }
          footer={
            <ListItemActions>
              <ListItemDefaultActions size="md" />
            </ListItemActions>
          }
          style={{ width: 220 }}
        />
      ))}
    </div>
  ),
}

export const States: Story = {
  name: "Interaction States",
  render: () => (
    <div className="flex w-[520px] max-w-full flex-col gap-1">
      {(["default", "hover", "focus", "selected", "disabled"] as ListItemState[]).map((state) => (
        <ListItem
          key={state}
          orientation="horizontal"
          size="md"
          state={state}
          title={`State: ${state}`}
          description="List item description goes here"
          media={<WritinDocument size="md" />}
          actions={<ListItemDefaultActions size="md" />}
        />
      ))}
    </div>
  ),
}
