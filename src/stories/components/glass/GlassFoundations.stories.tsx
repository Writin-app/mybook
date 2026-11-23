import type { Meta, StoryObj } from "@storybook/react-vite"

import { Glass } from "@/components/glass/glass"
import { Button } from "@/components/ui/button"

const meta = {
  title: "Glass/Foundations",
  parameters: { fullWidth: true },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Materials: Story = {
  render: () => (
    <div className="grid gap-6 rounded-[2rem] bg-[radial-gradient(ellipse_at_20%_20%,#e2e8ff,transparent_45%),radial-gradient(ellipse_at_85%_80%,#e4f4ff,transparent_40%),#f8fafc] p-8 md:grid-cols-3">
      <Glass intensity="subtle" className="grid min-h-40 content-end gap-2 p-5">
        <strong>Subtle</strong><span className="text-sm text-muted-foreground">21% material opacity</span>
      </Glass>
      <Glass className="grid min-h-40 content-end gap-2 p-5">
        <strong>Default</strong><span className="text-sm text-muted-foreground">85% clarity · 15% tint</span>
      </Glass>
      <Glass intensity="strong" className="grid min-h-40 content-end gap-2 p-5">
        <strong>Strong</strong><span className="text-sm text-muted-foreground">Overlay surface</span>
      </Glass>
      <Glass variant="liquid" className="col-span-full flex items-center justify-between gap-4 p-3">
        <span className="px-2 text-sm">Liquid control surface</span><Button size="sm">Action</Button>
      </Glass>
      <Glass variant="liquid-clear" className="col-span-full flex min-h-24 items-end p-4 text-sm text-white" style={{ backgroundImage: "linear-gradient(130deg,#456, #a8c)" }}>
        Clear liquid surface (use over media)
      </Glass>
    </div>
  ),
}

export const ReducedTransparency: Story = {
  render: () => (
    <div className="grid gap-4 bg-muted p-8 sm:grid-cols-2">
      <Glass className="p-6">Glass material</Glass>
      <p className="self-center text-sm text-muted-foreground">Enable the operating system's reduced transparency setting to preview the opaque fallback.</p>
    </div>
  ),
}
