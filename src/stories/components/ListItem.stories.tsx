import type { Meta, StoryObj } from "@storybook/react"
import {
  ListItem,
  ListItemMedia,
  ListItemActions,
  ListItemDefaultActions,
} from "@/components/ui/list-item"
import type { ListItemOrientation, ListItemVariant, ListItemState, ListItemSelection } from "@/components/ui/list-item"
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
    selected: { control: "boolean" },
    disabled: { control: "boolean" },
    title: { control: "text" },
    description: { control: "text" },
  },
  args: {
    orientation: "horizontal",
    variant: "default",
    state: "default",
    selection: "none",
    selected: false,
    disabled: false,
    title: "Project Document",
    description: "Updated 2 hours ago",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ListItem>

export default meta
type Story = StoryObj<typeof meta>

// Playground
export const Playground: Story = {
  render: (args) => (
    <ListItem
      {...args}
      media={
        <ListItemMedia>
          <WritinDocument size="md" />
        </ListItemMedia>
      }
      actions={<ListItemDefaultActions />}
    />
  ),
}

// Horizontal variants
export const HorizontalDefault: Story = {
  name: "Horizontal — Default",
  render: () => (
    <div className="flex flex-col gap-1 w-80">
      {["Project Brief.docx", "Design Tokens", "Meeting Notes", "API Reference"].map((title, i) => (
        <ListItem
          key={i}
          orientation="horizontal"
          variant="default"
          title={title}
          description="Modified today"
          media={
            <ListItemMedia>
              <WritinDocument size="md" />
            </ListItemMedia>
          }
          actions={<ListItemDefaultActions />}
        />
      ))}
    </div>
  ),
}

export const HorizontalWithAvatars: Story = {
  name: "Horizontal — With Avatars",
  render: () => (
    <div className="flex flex-col gap-1 w-80">
      {[
        { name: "Jordan Davis",    initials: "JD", desc: "Active now" },
        { name: "Maria Kim",       initials: "MK", desc: "Away · 2h ago" },
        { name: "Alex Brown",      initials: "AB", desc: "Offline" },
      ].map(({ name, initials, desc }) => (
        <ListItem
          key={name}
          orientation="horizontal"
          variant="default"
          title={name}
          description={desc}
          media={
            <Avatar size="md">
              <AvatarFallback size="md" initials={initials} />
            </Avatar>
          }
          actions={<ListItemDefaultActions />}
        />
      ))}
    </div>
  ),
}

export const HorizontalVariants: Story = {
  name: "Horizontal — All Variants",
  render: () => (
    <div className="flex flex-col gap-3 w-80">
      {(["default", "muted", "outline"] as ListItemVariant[]).map((variant) => (
        <div key={variant}>
          <div className="text-xs text-[var(--token-colors-foreground-secondary)] mb-1 font-[family-name:var(--token-typography-font-family-primary)] capitalize px-1">
            {variant}
          </div>
          <ListItem
            orientation="horizontal"
            variant={variant}
            title="Document Title"
            description="Updated 3 hours ago"
            media={<WritinDocument size="md" />}
            actions={<ListItemDefaultActions />}
          />
        </div>
      ))}
    </div>
  ),
}

export const WithSelection: Story = {
  name: "With Selection Controls",
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <div>
        <div className="text-xs text-[var(--token-colors-foreground-secondary)] mb-1 font-[family-name:var(--token-typography-font-family-primary)]">Multi-select (checkbox)</div>
        <div className="flex flex-col gap-1">
          <ListItem orientation="horizontal" selection="multi" selected title="Selected Item" description="Checked" media={<WritinDocument size="md" />} />
          <ListItem orientation="horizontal" selection="multi" title="Unchecked Item" description="Not selected" media={<WritinDocument size="md" />} />
        </div>
      </div>
      <div>
        <div className="text-xs text-[var(--token-colors-foreground-secondary)] mb-1 font-[family-name:var(--token-typography-font-family-primary)]">Single-select (radio)</div>
        <div className="flex flex-col gap-1">
          <ListItem orientation="horizontal" selection="single" selected title="Selected Item" description="Active" media={<WritinDocument size="md" />} />
          <ListItem orientation="horizontal" selection="single" title="Other Item" description="Inactive" media={<WritinDocument size="md" />} />
        </div>
      </div>
    </div>
  ),
}

export const VerticalVariants: Story = {
  name: "Vertical Orientation",
  render: () => (
    <div className="flex gap-4">
      {(["default", "muted", "outline"] as ListItemVariant[]).map((variant) => (
        <ListItem
          key={variant}
          orientation="vertical"
          variant={variant}
          title="Project Document"
          description="A shared document with the team notes and planning."
          media={
            <ListItemMedia mediaType="image" style={{ width: "100%", height: 72 }}>
              <img src="https://picsum.photos/seed/doc/200/80" alt="" />
            </ListItemMedia>
          }
          footer={
            <>
              <ListItemActions>
                <ListItemDefaultActions />
              </ListItemActions>
            </>
          }
          style={{ width: 160 }}
        />
      ))}
    </div>
  ),
}

export const States: Story = {
  name: "Interaction States",
  render: () => (
    <div className="flex flex-col gap-1 w-80">
      {(["default", "hover", "focus", "selected", "disabled"] as ListItemState[]).map((state) => (
        <ListItem
          key={state}
          orientation="horizontal"
          state={state}
          title={`State: ${state}`}
          description="ListItem in this state"
          media={<WritinDocument size="md" />}
        />
      ))}
    </div>
  ),
}
