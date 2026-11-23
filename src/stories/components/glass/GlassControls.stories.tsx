import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { DatePicker, GlassGroup, GlassCluster, GlassMorph, GlassPreferences, SegmentedControl, Stepper } from "@/components/glass/controls"
import { Button } from "@/components/ui/button"

const meta = { title: "Glass/Catalog/Controls", parameters: { fullWidth: true } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function ControlsDemo() {
  const [segment, setSegment] = useState("week")
  const [count, setCount] = useState(3)
  const [morph, setMorph] = useState(false)
  return <div className="grid max-w-xl gap-8">
    <SegmentedControl ariaLabel="Date range" value={segment} onValueChange={setSegment} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
    <GlassGroup indicator><Button variant="ghost">Undo</Button><Button variant="ghost">Redo</Button><Button variant="ghost">More</Button></GlassGroup>
    <GlassCluster><Button variant="glass">One</Button><Button variant="glass">Two</Button><Button variant="glass">Three</Button></GlassCluster>
    <GlassMorph transitionKey={morph ? "expanded" : "compact"} className="grid gap-3 rounded-2xl border p-4"><span>{morph ? "Expanded content" : "Compact content"}</span><Button size="sm" onClick={() => setMorph((open) => !open)}>Morph</Button></GlassMorph>
    <Stepper ariaLabel="Page count" min={1} max={10} value={count} onValueChange={setCount} />
    <div className="flex flex-wrap gap-3"><DatePicker label="Date" /><DatePicker mode="range" label="Date range" /><DatePicker mode="date-time" label="Date and time" /></div>
    <GlassPreferences />
  </div>
}

export const Showcase: Story = { render: () => <ControlsDemo /> }
