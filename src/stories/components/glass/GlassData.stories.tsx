import type { Meta, StoryObj } from "@storybook/react-vite"

import { ActivityRings, AreaChart, BarChart, BarList, CategoryBar, DataTable, DonutChart, Gauge, Heatmap, KPI, LineChart, ProgressRing, RangeChart, Sparkline, Stat, Tracker, Widget } from "@/components/glass/data"

const meta = { title: "Glass/Catalog/Data", parameters: { fullWidth: true } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const series = [{ name: "Pages", values: [5, 8, 6, 11, 9, 14, 12] }, { name: "Goals", values: [4, 5, 6, 7, 8, 9, 10], color: "var(--chart-2)" }]
const categoryData = [{ label: "Documents", value: 48 }, { label: "Notes", value: 28, color: "var(--chart-2)" }, { label: "Spreadsheets", value: 24, color: "var(--chart-3)" }]

type Row = { name: string; type: string; status: string }
const rows: Row[] = [
  { name: "Product brief", type: "Document", status: "Synced" },
  { name: "Annual plan", type: "Spreadsheet", status: "Local" },
  { name: "Research index", type: "Folder", status: "Shared" },
  { name: "Reading list", type: "Document", status: "Synced" },
  { name: "Meeting notes", type: "Document", status: "Local" },
]

export const Showcase: Story = {
  render: () => <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
    <div className="grid gap-3 rounded-3xl border border-[var(--glass-rim)] bg-[var(--app-surface)] p-5"><ActivityRings rings={[{ label: "Move", value: 0.78 }, { label: "Exercise", value: 0.62 }, { label: "Stand", value: 0.9 }]} /><ProgressRing value={68} label="Weekly goal" /><Sparkline data={[3, 6, 4, 8, 6, 11, 9]} label="Weekly pages trend" /></div>
    <Stat label="Pages this week" value="42" description="8 more than last week" trend={{ value: "+23%", sentiment: "positive" }} chart={<Sparkline data={[3, 5, 4, 7, 6, 10]} label="Pages trend" />} />
    <KPI label="Focus time" value="6h 24m" context="Across 12 writing sessions" trend="+12%" sparkline={[2, 4, 3, 6, 7, 9]} />
    <Widget title="Weekly overview" size="medium" accented><div className="flex items-center justify-between"><span className="text-sm">Goal progress</span><ProgressRing size={64} value={72} label="Goal progress" /></div></Widget>
    <div className="grid content-center gap-5 rounded-3xl border border-[var(--glass-rim)] bg-[var(--app-surface)] p-5"><RangeChart label="Daily focus range" min={0} max={12} low={4} high={9} current={7} /><BarList data={[{ label: "Writing", value: 18 }, { label: "Research", value: 9 }, { label: "Planning", value: 6 }]} /><Gauge value={76} target={80} label="Readiness" /></div>
    <div className="grid content-center gap-5 rounded-3xl border border-[var(--glass-rim)] bg-[var(--app-surface)] p-5"><Tracker values={[1, 0.6, 1, 0.3, 0, 1, 0.8, 1, 1, 0.4, 0, 1, 1, 1]} /><CategoryBar categories={categoryData} marker={62} /><Heatmap values={Array.from({ length: 56 }, (_, index) => (index * 7 + index * index) % 11)} /></div>
    <div className="grid gap-5 rounded-3xl border border-[var(--glass-rim)] bg-[var(--app-surface)] p-5 md:col-span-2"><AreaChart labels={labels} series={series} /><BarChart labels={labels} series={series} height={140} /><LineChart labels={labels} series={series} height={140} /><DonutChart label="Document distribution" data={categoryData} size={140} /></div>
    <div className="rounded-3xl border border-[var(--glass-rim)] bg-[var(--app-surface)] p-5 md:col-span-2 xl:col-span-3"><DataTable rows={rows} getRowId={(row) => row.name} selectable columns={[{ id: "name", header: "Name", cell: (row) => row.name, searchValue: (row) => row.name, sortValue: (row) => row.name }, { id: "type", header: "Type", cell: (row) => row.type, searchValue: (row) => row.type, sortValue: (row) => row.type }, { id: "status", header: "Status", cell: (row) => row.status, searchValue: (row) => row.status, sortValue: (row) => row.status }]} /></div>
  </div>,
}
