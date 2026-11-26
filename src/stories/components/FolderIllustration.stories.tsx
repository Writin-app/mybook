import type { Meta, StoryObj } from "@storybook/react"
import { FolderIllustration } from "@/components/ui/folder-illustration"
import type { FolderSize, FolderStyle, FolderType, FolderVariant } from "@/components/ui/folder-illustration"

const FOLDER_STYLES: FolderStyle[] = ["grey", "yellow", "green", "violet", "blue", "orange", "pink", "red"]
const FOLDER_SIZES: FolderSize[]   = ["xs", "sm", "md", "lg"]

const meta = {
  title: "Components/FolderIllustration",
  component: FolderIllustration,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: FOLDER_SIZES,
      description: "Size of the folder",
    },
    folderStyle: {
      control: "select",
      options: FOLDER_STYLES,
      description: "Color style of the folder",
    },
    type: {
      control: "radio",
      options: ["empty", "filled"] satisfies FolderType[],
      description: "Whether the folder appears filled with content",
    },
    variant: {
      control: "radio",
      options: ["subtle", "strong"] satisfies FolderVariant[],
      description: "Subtle uses light tokens; strong uses inverse/saturated tokens",
    },
    name: {
      control: "text",
      description: "Folder name (visible in lg size)",
    },
    description: {
      control: "text",
      description: "Folder description (visible in lg size)",
    },
  },
  args: {
    size: "lg",
    folderStyle: "yellow",
    type: "empty",
    variant: "subtle",
    name: "My Documents",
    description: "32 items",
  },
} satisfies Meta<typeof FolderIllustration>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const AllStyles: Story = {
  name: "All Styles",
  render: () => (
    <div className="flex flex-wrap gap-4">
      {FOLDER_STYLES.map((folderStyle) => (
        <div key={folderStyle} className="flex flex-col items-center gap-2">
          <FolderIllustration
            size="lg"
            folderStyle={folderStyle}
            type="empty"
            variant="subtle"
            name={folderStyle.charAt(0).toUpperCase() + folderStyle.slice(1)}
            description="12 items"
          />
        </div>
      ))}
    </div>
  ),
}

export const AllStylesStrong: Story = {
  name: "All Styles — Strong",
  render: () => (
    <div className="flex flex-wrap gap-4">
      {FOLDER_STYLES.map((folderStyle) => (
        <div key={folderStyle} className="flex flex-col items-center gap-2">
          <FolderIllustration
            size="lg"
            folderStyle={folderStyle}
            type="filled"
            variant="strong"
            name={folderStyle.charAt(0).toUpperCase() + folderStyle.slice(1)}
            description="12 items"
          />
        </div>
      ))}
    </div>
  ),
}

export const AllSizes: Story = {
  name: "All Sizes",
  render: () => (
    <div className="flex items-end gap-6">
      {FOLDER_SIZES.map((size) => (
        <div key={size} className="flex flex-col items-center gap-3">
          <FolderIllustration
            size={size}
            folderStyle="yellow"
            type="empty"
            variant="subtle"
            name={size === "lg" ? "Documents" : undefined}
            description={size === "lg" ? "24 items" : undefined}
          />
          <span className="text-xs text-[var(--token-colors-foreground-secondary)] font-[family-name:var(--token-typography-font-family-primary)]">
            {size}
          </span>
        </div>
      ))}
    </div>
  ),
}

export const FilledVsEmpty: Story = {
  name: "Filled vs Empty",
  render: () => (
    <div className="flex gap-6">
      {(["empty", "filled"] as FolderType[]).map((type) => (
        <div key={type} className="flex flex-col items-center gap-3">
          <FolderIllustration
            size="lg"
            folderStyle="blue"
            type={type}
            variant="subtle"
            name={type.charAt(0).toUpperCase() + type.slice(1)}
            description="8 items"
          />
          <span className="text-xs text-[var(--token-colors-foreground-secondary)] capitalize font-[family-name:var(--token-typography-font-family-primary)]">
            {type}
          </span>
        </div>
      ))}
    </div>
  ),
}
