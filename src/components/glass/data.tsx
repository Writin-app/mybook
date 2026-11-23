import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type RingDatum = { label: string; value: number; color?: string }

function ActivityRings({ rings, className, size = 140, ...props }: React.ComponentProps<"div"> & { rings: RingDatum[]; size?: number }) {
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]
  return <div data-slot="activity-rings" role="img" aria-label={rings.map((ring) => `${ring.label}: ${Math.round(ring.value * 100)}%`).join(", ")} className={cn("inline-flex items-center gap-4", className)} {...props}>
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="-rotate-90">
      {rings.map((ring, index) => { const radius = 45 - index * 12; const circumference = 2 * Math.PI * radius; const value = Math.max(0, Math.min(1, ring.value)); return <g key={ring.label}><circle cx="50" cy="50" r={radius} fill="none" stroke="var(--app-border)" strokeWidth="8" /><circle cx="50" cy="50" r={radius} fill="none" stroke={ring.color ?? colors[index % colors.length]} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value)} /></g> })}
    </svg><div className="grid gap-1 text-xs">{rings.map((ring, index) => <div key={ring.label} className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: ring.color ?? colors[index % colors.length] }} /><span>{ring.label}</span><strong className="tabular-nums">{Math.round(ring.value * 100)}%</strong></div>)}</div>
  </div>
}

function ProgressRing({ value, max = 100, size = 96, strokeWidth = 8, color = "var(--primary)", label, children, className, ...props }: React.ComponentProps<"div"> & { value: number; max?: number; size?: number; strokeWidth?: number; color?: string; label: string }) {
  const normalized = Math.max(0, Math.min(1, value / (max || 1)))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  return <div data-slot="progress-ring" role="img" aria-label={`${label}: ${Math.round(normalized * 100)}%`} className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }} {...props}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true"><circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--app-border)" strokeWidth={strokeWidth} /><circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - normalized)} /></svg>
    <span className="absolute text-sm font-semibold tabular-nums">{children ?? `${Math.round(normalized * 100)}%`}</span>
  </div>
}

function Sparkline({ data, label, color = "var(--chart-1)", className, width = 128, height = 40, ...props }: React.ComponentProps<"svg"> & { data: number[]; label: string; color?: string; width?: number; height?: number }) {
  const min = Math.min(...data, 0); const max = Math.max(...data, 1); const span = max - min || 1
  const points = data.map((value, index) => `${data.length <= 1 ? width / 2 : (index / (data.length - 1)) * width},${height - ((value - min) / span) * (height - 4) - 2}`).join(" ")
  return <svg data-slot="sparkline" role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)} {...props}><polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{data.length ? <circle cx={Number(points.split(" ").at(-1)?.split(",")[0])} cy={Number(points.split(" ").at(-1)?.split(",")[1])} r="3" fill={color} /> : null}</svg>
}

type StatProps = React.ComponentProps<"div"> & { label: React.ReactNode; value: React.ReactNode; description?: React.ReactNode; trend?: { value: React.ReactNode; sentiment?: "positive" | "negative" | "neutral" }; chart?: React.ReactNode; compact?: boolean }

function Stat({ label, value, description, trend, chart, compact = false, className, ...props }: StatProps) {
  return <div data-slot="stat" data-compact={compact || undefined} className={cn("grid gap-3 rounded-3xl border border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity),transparent)] p-5 shadow-[inset_0_1px_0_var(--glass-chrome-highlight)] backdrop-blur-xl", compact && "gap-2 p-4", className)} {...props}>
    <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{label}</span>{trend ? <span className={cn("text-xs font-medium", trend.sentiment === "positive" && "text-emerald-600", trend.sentiment === "negative" && "text-destructive", trend.sentiment === "neutral" && "text-muted-foreground")}>{trend.value}</span> : null}</div>
    <div className="flex items-end justify-between gap-4"><strong className="text-3xl font-semibold tracking-tight tabular-nums">{value}</strong>{chart ? <div className="shrink-0">{chart}</div> : null}</div>{description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
  </div>
}

function KPI({ label, value, context, trend, sparkline, className, ...props }: React.ComponentProps<"div"> & { label: React.ReactNode; value: React.ReactNode; context?: React.ReactNode; trend?: React.ReactNode; sparkline?: number[] }) {
  return <div data-slot="kpi" className={cn("grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-3xl border border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity),transparent)] p-4 shadow-[inset_0_1px_0_var(--glass-chrome-highlight)]", className)} {...props}>
    <span className="text-sm text-muted-foreground">{label}</span>{trend ? <span className="text-xs font-medium text-primary">{trend}</span> : null}<strong className="text-2xl font-semibold tabular-nums">{value}</strong>{sparkline ? <Sparkline data={sparkline} label={`${label} trend`} className="row-span-2 self-center" /> : null}{context ? <span className="col-span-full text-xs text-muted-foreground">{context}</span> : null}
  </div>
}

type WidgetProps = React.ComponentProps<"section"> & { size?: "small" | "medium" | "large" | "extra-large" | "lock-circular" | "lock-rectangular" | "lock-inline"; accented?: boolean; title?: React.ReactNode }

function Widget({ size = "medium", accented = false, title, className, children, ...props }: WidgetProps) {
  return <section data-slot="widget" data-size={size} data-accented={accented || undefined} className={cn("@container/widget min-w-0 rounded-3xl border border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity),transparent)] p-4 shadow-[inset_0_1px_0_var(--glass-chrome-highlight)]", accented && "bg-[color-mix(in_srgb,var(--primary)_12%,var(--app-surface))]", size === "small" && "aspect-square", size === "large" && "min-h-64", size === "extra-large" && "min-h-80", size.startsWith("lock-") && "max-w-sm rounded-[2rem]", className)} {...props}>{title ? <h3 className="mb-3 text-sm font-semibold">{title}</h3> : null}{children}</section>
}

type RangeChartProps = React.ComponentProps<"div"> & { low: number; high: number; min?: number; max?: number; current?: number; label: string; color?: string }

function RangeChart({ low, high, min = 0, max = 100, current, label, color = "var(--chart-1)", className, ...props }: RangeChartProps) {
  const span = max - min || 1; const start = Math.max(0, Math.min(100, ((low - min) / span) * 100)); const width = Math.max(0, Math.min(100 - start, ((high - low) / span) * 100)); const point = current === undefined ? undefined : Math.max(0, Math.min(100, ((current - min) / span) * 100))
  return <div data-slot="range-chart" role="img" aria-label={`${label}: ${low} to ${high}${current === undefined ? "" : `, current ${current}`}`} className={cn("grid gap-2", className)} {...props}><div className="relative h-3 rounded-full bg-muted"><span className="absolute top-0 h-full rounded-full" style={{ left: `${start}%`, width: `${width}%`, background: color }} />{point !== undefined ? <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${point}%`, background: color }} /> : null}</div><div className="flex justify-between text-xs text-muted-foreground"><span>{low}</span><span>{high}</span></div></div>
}

type BarDatum = { label: string; value: number; color?: string }

function BarList({ data, max, className, ...props }: React.ComponentProps<"ol"> & { data: BarDatum[]; max?: number }) {
  const maximum = max ?? Math.max(1, ...data.map((item) => item.value))
  return <ol data-slot="bar-list" className={cn("grid gap-3", className)} {...props}>{data.map((item) => <li key={item.label} className="grid grid-cols-[minmax(5rem,1fr)_3fr_auto] items-center gap-3 text-sm"><span className="truncate">{item.label}</span><span className="h-7 overflow-hidden rounded-full bg-muted"><span className="flex h-full min-w-1 items-center rounded-full px-2 text-xs text-white" style={{ width: `${Math.max(4, Math.min(100, (item.value / maximum) * 100))}%`, background: item.color ?? "var(--primary)" }} /></span><strong className="tabular-nums">{item.value}</strong></li>)}</ol>
}

function Gauge({ value, min = 0, max = 100, target, label, className, ...props }: React.ComponentProps<"div"> & { value: number; min?: number; max?: number; target?: number; label: string }) {
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min || 1))); const arc = "M 14 82 A 36 36 0 1 1 86 82"; const targetRatio = target === undefined ? null : Math.max(0, Math.min(1, (target - min) / (max - min || 1))); const targetAngle = targetRatio === null ? null : (135 + targetRatio * 270) * Math.PI / 180
  return <div data-slot="gauge" role="img" aria-label={`${label}: ${value}`} className={cn("relative w-48", className)} {...props}><svg viewBox="0 0 100 92" className="w-full" aria-hidden="true"><path d={arc} fill="none" stroke="var(--app-border)" strokeWidth="8" strokeLinecap="round" pathLength="100" /><path d={arc} fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray={`${ratio * 100} 100`} />{targetAngle !== null ? <line x1={50 + Math.cos(targetAngle) * 31} y1={48 + Math.sin(targetAngle) * 31} x2={50 + Math.cos(targetAngle) * 43} y2={48 + Math.sin(targetAngle) * 43} stroke="var(--foreground)" strokeWidth="2" /> : null}</svg><div className="-mt-5 text-center"><strong className="text-2xl tabular-nums">{value}</strong><p className="text-xs text-muted-foreground">{label}</p></div></div>
}

type TrackerProps = React.ComponentProps<"div"> & { values: Array<number | boolean>; label?: string }

function Tracker({ values, label = "Progress tracker", className, ...props }: TrackerProps) {
  return <div data-slot="tracker" role="img" aria-label={`${label}: ${values.filter((value) => value === true || (typeof value === "number" && value > 0)).length} of ${values.length} active`} className={cn("grid grid-flow-col auto-cols-fr gap-1", className)} {...props}>{values.map((value, index) => <span key={index} className="h-6 rounded-md" style={{ backgroundColor: value === true ? "var(--primary)" : typeof value === "number" ? `color-mix(in srgb,var(--primary) ${Math.max(4, Math.min(100, value * 100))}%,var(--app-subtle))` : "var(--app-subtle)" }} />)}</div>
}

type CategoryBarProps = React.ComponentProps<"div"> & { categories: BarDatum[]; marker?: number; max?: number }

function CategoryBar({ categories, marker, max, className, ...props }: CategoryBarProps) {
  const total = max ?? (categories.reduce((sum, item) => sum + item.value, 0) || 1)
  return <div data-slot="category-bar" className={cn("grid gap-2", className)} {...props}><div className="relative flex h-3 overflow-hidden rounded-full bg-muted">{categories.map((item) => <span key={item.label} title={`${item.label}: ${item.value}`} style={{ width: `${(item.value / total) * 100}%`, background: item.color ?? "var(--primary)" }} />)}{marker !== undefined ? <span className="absolute top-[-3px] h-5 w-0.5 bg-foreground" style={{ left: `${Math.max(0, Math.min(100, (marker / total) * 100))}%` }} /> : null}</div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{categories.map((item) => <span key={item.label} className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: item.color ?? "var(--primary)" }} />{item.label}</span>)}</div></div>
}

type HeatmapProps = React.ComponentProps<"div"> & { values: number[]; columns?: number; label?: string }

function Heatmap({ values, columns = 7, label = "Activity heatmap", className, ...props }: HeatmapProps) {
  const maximum = Math.max(1, ...values)
  return <div data-slot="heatmap" role="img" aria-label={`${label}: ${values.map((value, index) => `${index + 1}: ${value}`).join(", ") || "no values"}`} className={cn("grid gap-1", className)} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, ...props.style }} {...props}>{values.map((value, index) => <span key={index} title={`${value}`} className="aspect-square rounded-[3px]" style={{ background: `color-mix(in srgb,var(--primary) ${Math.max(4, (value / maximum) * 100)}%,var(--app-subtle))` }} />)}</div>
}

type ChartSeries = { name: string; values: number[]; color?: string }
type CoordinateChartProps = React.ComponentProps<"div"> & { labels: string[]; series: ChartSeries[]; height?: number; showGrid?: boolean; loading?: boolean; error?: React.ReactNode; emptyMessage?: React.ReactNode }

function CoordinateChart({ labels, series, height = 180, showGrid = true, loading = false, error, emptyMessage = "No chart data available.", className, ...props }: CoordinateChartProps & { chartType: "area" | "bar" | "line" }) {
  const chartType = (props as CoordinateChartProps & { chartType: "area" | "bar" | "line" }).chartType
  const cleanProps = { ...props }; delete (cleanProps as { chartType?: string }).chartType
  const values = series.flatMap((item) => item.values); const min = Math.min(0, ...values); const max = Math.max(1, ...values); const span = max - min || 1; const width = Math.max(240, labels.length * 46)
  const x = (index: number) => 28 + (labels.length <= 1 ? (width - 56) / 2 : index / (labels.length - 1) * (width - 56))
  const y = (value: number) => height - 22 - ((value - min) / span) * (height - 38)
  const baseline = y(0)
  const hasData = labels.length > 0 && series.some((item) => item.values.length > 0)
  return <div data-slot={`${chartType}-chart`} className={cn("min-w-0 overflow-x-auto rounded-2xl", className)} {...cleanProps}>{loading ? <div role="status" className="p-6 text-center text-sm text-muted-foreground">Loading chart…</div> : error ? <div role="alert" className="p-6 text-center text-sm text-destructive">{error}</div> : !hasData ? <div role="status" className="p-6 text-center text-sm text-muted-foreground">{emptyMessage}</div> : <><svg role="img" aria-label={`${chartType} chart: ${series.map((item) => `${item.name} (${item.values.map((value, index) => `${labels[index] ?? index + 1}: ${value}`).join(", ")})`).join("; ")}`} viewBox={`0 0 ${width} ${height}`} className="min-w-full" preserveAspectRatio="none">
    {showGrid ? [0, 0.25, 0.5, 0.75, 1].map((fraction) => <line key={fraction} x1="28" x2={width - 16} y1={height - 22 - fraction * (height - 38)} y2={height - 22 - fraction * (height - 38)} stroke="var(--glass-chart-grid,var(--app-border))" strokeDasharray="2 4" />) : null}
    {series.map((item, seriesIndex) => { const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(" "); const color = item.color ?? `var(--chart-${(seriesIndex % 8) + 1})`; if (chartType === "bar") return item.values.map((value, index) => { const group = Math.max(1, (width - 56) / Math.max(1, labels.length)); const barWidth = Math.max(4, group / (series.length + 1)); const valueY = y(value); return <rect key={`${item.name}-${index}`} x={x(index) - barWidth * (series.length / 2) + seriesIndex * barWidth} y={Math.min(baseline, valueY)} width={barWidth - 2} height={Math.abs(baseline - valueY)} rx="4" fill={color} /> }); if (chartType === "area") { const first = item.values.map((value, index) => `${x(index)},${y(value)}`).join(" "); return <g key={item.name}><polygon points={`${x(0)},${baseline} ${first} ${x(item.values.length - 1)},${baseline}`} fill={color} opacity="0.16" /><polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></g> } return <g key={item.name}><polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{item.values.map((value, index) => <circle key={index} cx={x(index)} cy={y(value)} r="3" fill={color} />)}</g> })}
    {labels.map((label, index) => <text key={`${label}-${index}`} x={x(index)} y={height - 4} textAnchor="middle" fill="var(--glass-chart-muted,var(--muted-foreground))" fontSize="9">{label}</text>)}
  </svg><div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">{series.map((item, index) => <span key={item.name} className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: item.color ?? `var(--chart-${(index % 8) + 1})` }} />{item.name}</span>)}</div></>}</div>
}

function AreaChart(props: CoordinateChartProps) { return <CoordinateChart {...props} chartType="area" /> }
function BarChart(props: CoordinateChartProps) { return <CoordinateChart {...props} chartType="bar" /> }
function LineChart(props: CoordinateChartProps) { return <CoordinateChart {...props} chartType="line" /> }

type DonutChartProps = React.ComponentProps<"div"> & { data: BarDatum[]; label: string; size?: number }

function DonutChart({ data, label, size = 180, className, ...props }: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1; const radius = 38; const circumference = 2 * Math.PI * radius; let offset = 0
  return <div data-slot="donut-chart" className={cn("inline-flex items-center gap-4", className)} {...props}><div className="relative"><svg role="img" aria-label={label} width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">{data.map((item, index) => { const length = (item.value / total) * circumference; const current = offset; offset += length; return <circle key={item.label} cx="50" cy="50" r={radius} fill="none" stroke={item.color ?? `var(--chart-${(index % 8) + 1})`} strokeWidth="16" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-current} /> })}</svg><span className="absolute inset-0 grid place-items-center text-sm font-semibold">{total}</span></div><ul className="grid gap-1 text-xs">{data.map((item, index) => <li key={item.label} className="flex items-center gap-2"><i className="size-2 rounded-full" style={{ background: item.color ?? `var(--chart-${(index % 8) + 1})` }} />{item.label}<strong className="tabular-nums">{Math.round(item.value / total * 100)}%</strong></li>)}</ul></div>
}

type DataTableColumn<Row> = { id: string; header: React.ReactNode; cell: (row: Row) => React.ReactNode; searchValue?: (row: Row) => string; sortValue?: (row: Row) => string | number }
type DataTableProps<Row> = React.ComponentProps<"div"> & { rows: Row[]; columns: DataTableColumn<Row>[]; getRowId: (row: Row) => string; pageSize?: number; selectable?: boolean; onSelectionChange?: (ids: string[]) => void }

function DataTable<Row>({ rows, columns, getRowId, pageSize = 8, selectable = false, onSelectionChange, className, ...props }: DataTableProps<Row>) {
  const [query, setQuery] = React.useState(""); const [page, setPage] = React.useState(0); const [sort, setSort] = React.useState<{ id: string; direction: 1 | -1 } | null>(null); const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const filtered = rows.filter((row) => !query || columns.some((column) => (column.searchValue?.(row) ?? String((row as Record<string, unknown>)[column.id] ?? "")).toLocaleLowerCase().includes(query.toLocaleLowerCase())))
  const sorted = sort ? [...filtered].sort((left, right) => { const column = columns.find((item) => item.id === sort.id); const a = column?.sortValue?.(left) ?? (left as Record<string, unknown>)[sort.id] ?? ""; const b = column?.sortValue?.(right) ?? (right as Record<string, unknown>)[sort.id] ?? ""; const order = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }); return order * sort.direction }) : filtered
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize)); const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize)
  const toggle = (id: string) => { const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id); setSelected(next); onSelectionChange?.([...next]) }
  return <div data-slot="data-table" className={cn("grid gap-3", className)} {...props}>
    <div className="flex flex-wrap items-center justify-between gap-3"><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="Filter rows…" aria-label="Filter rows" className="max-w-xs" /><span className="text-xs text-muted-foreground">{filtered.length} rows</span></div>
    <Table><TableHeader><TableRow>{selectable ? <TableHead><span className="sr-only">Select row</span></TableHead> : null}{columns.map((column) => <TableHead key={column.id}><button type="button" onClick={() => setSort((current) => current?.id === column.id ? { id: column.id, direction: current.direction === 1 ? -1 : 1 } : { id: column.id, direction: 1 })} className="inline-flex items-center gap-1">{column.header}{sort?.id === column.id ? (sort.direction === 1 ? "↑" : "↓") : null}</button></TableHead>)}</TableRow></TableHeader><TableBody>{pageRows.map((row) => { const id = getRowId(row); return <TableRow key={id} data-state={selected.has(id) ? "selected" : undefined}>{selectable ? <TableCell><input type="checkbox" aria-label={`Select row ${id}`} checked={selected.has(id)} onChange={() => toggle(id)} /></TableCell> : null}{columns.map((column) => <TableCell key={column.id}>{column.cell(row)}</TableCell>)}</TableRow> })}{!pageRows.length ? <TableRow><TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="py-10 text-center text-muted-foreground">No results found.</TableCell></TableRow> : null}</TableBody></Table>
    <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Page {page + 1} of {pageCount}</span><div className="flex gap-2"><button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} className="rounded-full border px-3 py-1.5 text-sm disabled:opacity-40">Previous</button><button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} className="rounded-full border px-3 py-1.5 text-sm disabled:opacity-40">Next</button></div></div>
  </div>
}

export { ActivityRings, ProgressRing, Sparkline, Stat, KPI, Widget, RangeChart, BarList, Gauge, Tracker, CategoryBar, Heatmap, AreaChart, BarChart, LineChart, DonutChart, DataTable }
