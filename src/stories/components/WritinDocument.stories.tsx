import type { Meta, StoryObj } from "@storybook/react"
import { WritinDocument } from "@/components/ui/writin-document"
import type { WritinDocumentSize } from "@/components/ui/writin-document"

const meta = {
  title: "Components/WritinDocument",
  component: WritinDocument,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg", "xxl"] satisfies WritinDocumentSize[],
      description: "Size of the document illustration",
    },
  },
  args: {
    size: "md",
  },
} satisfies Meta<typeof WritinDocument>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const AllSizes: Story = {
  name: "All Sizes",
  render: () => (
    <div className="flex items-end gap-8">
      {(["sm", "md", "lg", "xxl"] as WritinDocumentSize[]).map((size) => (
        <div key={size} className="flex flex-col items-center gap-3">
          <WritinDocument size={size} />
          <span className="text-xs text-[var(--token-colors-foreground-secondary)] font-[family-name:var(--token-typography-font-family-primary)]">
            {size}
          </span>
        </div>
      ))}
    </div>
  ),
}
