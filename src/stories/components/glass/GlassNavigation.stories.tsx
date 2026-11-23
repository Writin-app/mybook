import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Dock, GroupedList, NavigationBar, ScrollEdge, SearchField, Toolbar } from "@/components/glass/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const meta = { title: "Glass/Catalog/Navigation", parameters: { fullWidth: true } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function NavigationDemo() {
  const [active, setActive] = useState("notes")
  const [query, setQuery] = useState("")
  const groups = [{ id: "recent", title: "Recent", footer: "Synced moments ago", rows: [
    { id: "coast", title: "Coast field notes", description: "Edited 5 minutes ago", icon: "✎", value: "Today" },
    { id: "launch", title: "Launch checklist", description: "A shared document", icon: "✓", value: "Yesterday" },
    { id: "research", title: "Research references", description: "Ideas and sources", icon: "⌕", value: "Monday" },
  ] }]
  return <div className="grid min-h-[45rem] gap-5 pb-20">
    <NavigationBar title="Library" subtitle="Your recent notes" leading={<Button variant="glass" size="icon" aria-label="Back">‹</Button>} trailing={<Badge variant="glass">12 notes</Badge>} />
    <div className="mx-auto grid w-full max-w-2xl gap-5 px-4">
      <Toolbar title="Notes" leading={<Button size="icon-sm" variant="ghost" aria-label="Undo">↶</Button>} trailing={<Button size="sm" variant="tinted">New note</Button>} />
      <SearchField value={query} onValueChange={setQuery} placeholder="Search notes" suggestions={query ? [{ value: query, label: `Search for “${query}”` }] : []} onSuggestionSelect={setQuery} />
      <ScrollEdge maxHeight="20rem"><GroupedList groups={groups} /></ScrollEdge>
    </div>
    <Dock value={active} onValueChange={setActive} items={[{ id: "notes", label: "Notes", icon: "▤" }, { id: "search", label: "Search", icon: "⌕" }, { id: "shared", label: "Shared", icon: "♧", badge: <span className="size-2 rounded-full bg-primary" /> }]} />
  </div>
}

export const Showcase: Story = { render: () => <NavigationDemo /> }

function DockDemo() {
  const [active, setActive] = useState("home")
  return <div className="grid min-h-48 place-items-center rounded-3xl border border-dashed border-border p-8">
    <Dock position="static" value={active} onValueChange={setActive} items={[
      { id: "home", label: "Home", icon: "⌂" },
      { id: "search", label: "Search", icon: "⌕" },
      { id: "saved", label: "Saved", icon: "▤", badge: "2" },
      { id: "profile", label: "Profile", icon: "○" },
    ]} />
  </div>
}

export const DockComponent: Story = { render: () => <DockDemo /> }
