import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { ActionSheet, ConfirmationPopover, GlassSheet, GlassSheetContent } from "@/components/glass/overlays"
import { Button } from "@/components/ui/button"
import { SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

const meta = { title: "Glass/Catalog/Overlays", parameters: { fullWidth: true } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function OverlayDemo() {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  return <div className="flex flex-wrap gap-3">
    <Button variant="glass" onClick={() => setOpen(true)}>Open action sheet</Button>
    <ActionSheet open={open} onOpenChange={setOpen} title="File actions" description="Choose an action for this note." actions={[{ label: "Duplicate", onSelect: () => undefined }, { label: "Move to Trash", destructive: true, onSelect: () => undefined }]} />
    <ConfirmationPopover open={confirmOpen} onOpenChange={setConfirmOpen} trigger="Remove note" title="Move to Trash?" description="You can restore this note from Trash." onConfirm={() => undefined} />
    <GlassSheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger render={<Button variant="glass" />}>Open detent sheet</SheetTrigger>
      <GlassSheetContent side="bottom" detents={["medium", "large"]} defaultDetent={0}>
        <SheetHeader><SheetTitle>Sheet with detents</SheetTitle><SheetDescription>Use the grabber or arrow keys to resize.</SheetDescription></SheetHeader>
        <div className="px-4 pb-6 text-sm text-muted-foreground">The panel can expand between its medium and large resting positions.</div>
      </GlassSheetContent>
    </GlassSheet>
  </div>
}

export const Showcase: Story = { render: () => <OverlayDemo /> }
