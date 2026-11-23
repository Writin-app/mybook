import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import type { DateRange } from "react-day-picker"

type Segment = { value: string; label: React.ReactNode; disabled?: boolean }

type SegmentedControlProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  options: Segment[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  ariaLabel: string
  momentary?: boolean
  size?: "sm" | "default" | "lg"
  shape?: "capsule" | "rounded"
}

function SegmentedControl({ className, options, value: controlledValue, defaultValue, onValueChange, ariaLabel, momentary = false, size = "default", shape = "capsule", ...props }: SegmentedControlProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? options.find((option) => !option.disabled)?.value ?? "")
  const value = controlledValue ?? uncontrolledValue
  const refs = React.useRef<Array<HTMLButtonElement | null>>([])
  const track = React.useRef<HTMLDivElement>(null)
  const pointerValue = React.useRef<string | null>(null)
  const [indicator, setIndicator] = React.useState({ left: 0, width: 0, visible: false })
  const choose = (next: string) => { if (controlledValue === undefined) setUncontrolledValue(next); onValueChange?.(next) }
  React.useLayoutEffect(() => {
    const update = () => {
      const root = track.current
      const active = refs.current[options.findIndex((option) => option.value === value)]
      if (!root || !active || momentary) { setIndicator((current) => ({ ...current, visible: false })); return }
      const rootRect = root.getBoundingClientRect()
      const itemRect = active.getBoundingClientRect()
      setIndicator({ left: itemRect.left - rootRect.left, width: itemRect.width, visible: true })
    }
    update()
    const observer = typeof ResizeObserver === "undefined" || !track.current ? undefined : new ResizeObserver(update)
    if (track.current) observer?.observe(track.current)
    return () => observer?.disconnect()
  }, [value, options, momentary, size])
  const selectAtPoint = (x: number, y: number) => {
    const target = document.elementFromPoint(x, y)?.closest<HTMLButtonElement>("[data-segment-index]")
    if (target && !target.disabled) {
      const option = options[Number(target.dataset.segmentIndex)]
      if (option && pointerValue.current !== option.value) {
        pointerValue.current = option.value
        choose(option.value)
      }
    }
  }
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    selectAtPoint(event.clientX, event.clientY)
  }
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) selectAtPoint(event.clientX, event.clientY)
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0
    if (!direction) return
    event.preventDefault()
    const enabled = options.map((option, index) => !option.disabled ? index : -1).filter((index) => index >= 0)
    const current = enabled.indexOf(options.findIndex((option) => option.value === value))
    const next = enabled[(current + direction + enabled.length) % enabled.length]
    const nextOption = next === undefined ? undefined : options[next]
    if (next !== undefined && nextOption) {
      choose(nextOption.value)
      refs.current[next]?.focus()
    }
  }
  return (
    <div ref={track} role={momentary ? "group" : "radiogroup"} aria-label={ariaLabel} data-slot="segmented-control" data-momentary={momentary || undefined} data-shape={shape} data-size={size} onKeyDown={onKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} className={cn("relative inline-flex max-w-full items-center gap-1 border border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity-subtle),transparent)] p-1 shadow-[inset_0_1px_0_var(--glass-chrome-highlight)] backdrop-blur-xl", shape === "capsule" ? "rounded-full" : "rounded-2xl", className)} {...props}>
      <span aria-hidden="true" data-slot="segmented-control-thumb" className={cn("pointer-events-none absolute bottom-1 top-1 left-0 z-0 rounded-[inherit] bg-[var(--app-surface)] shadow-[0_1px_4px_rgb(15_23_42/12%),inset_0_1px_0_white] transition-[width,transform,opacity] duration-300 ease-[var(--glass-ease)] motion-reduce:transition-none", indicator.visible ? "opacity-100" : "opacity-0")} style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }} />
      {options.map((option, index) => {
        const selected = !momentary && value === option.value
        return <button key={option.value} ref={(node) => { refs.current[index] = node }} type="button" role={momentary ? undefined : "radio"} aria-checked={momentary ? undefined : selected} disabled={option.disabled} tabIndex={momentary || selected || (index === 0 && !options.some((item) => item.value === value)) ? 0 : -1} data-segment-index={index} data-slot="segmented-control-item" data-selected={selected || undefined} onClick={() => { if (pointerValue.current === option.value) { pointerValue.current = null; return } choose(option.value) }} className={cn("relative z-10 rounded-full px-4 text-sm font-medium text-muted-foreground outline-none transition-colors duration-[var(--glass-duration)] focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50", size === "sm" ? "min-h-8 px-3 text-xs" : size === "lg" ? "min-h-11 px-5" : "min-h-9", selected && "text-foreground")}>{option.label}</button>
      })}
    </div>
  )
}

function GlassGroup({ className, indicator = false, children, ...props }: React.ComponentProps<"div"> & { indicator?: boolean }) {
  const root = React.useRef<HTMLDivElement>(null)
  const [indicatorPosition, setIndicatorPosition] = React.useState({ left: 0, width: 0, visible: false })
  React.useLayoutEffect(() => {
    if (!indicator) return
    const update = () => {
      const container = root.current
      const selected = container?.querySelector<HTMLElement>('[data-selected="true"], [aria-pressed="true"], [aria-checked="true"]')
      if (!container || !selected) { setIndicatorPosition((current) => ({ ...current, visible: false })); return }
      const bounds = container.getBoundingClientRect()
      const item = selected.getBoundingClientRect()
      setIndicatorPosition({ left: item.left - bounds.left, width: item.width, visible: true })
    }
    update()
    const observer = root.current && typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : undefined
    if (root.current) { observer?.observe(root.current); observer?.observe(root.current.parentElement ?? root.current) }
    const mutation = root.current ? new MutationObserver(update) : undefined
    if (root.current) mutation?.observe(root.current, { subtree: true, attributes: true, attributeFilter: ["aria-pressed", "aria-checked", "data-selected"] })
    return () => { observer?.disconnect(); mutation?.disconnect() }
  }, [children, indicator])
  return <div ref={root} role="group" data-slot="glass-group" data-indicator={indicator || undefined} className={cn("relative isolate inline-flex items-center gap-1 rounded-full border border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity-subtle),transparent)] p-1 shadow-[var(--glass-chrome-shadow),inset_0_1px_0_var(--glass-chrome-highlight)] backdrop-blur-xl [&>[data-slot=button]]:relative [&>[data-slot=button]]:z-[1] [&>[data-slot=button]]:rounded-full [&>[data-slot=button]]:shadow-none", className)} {...props}>{indicator ? <span aria-hidden="true" data-slot="glass-group-indicator" className={cn("pointer-events-none absolute bottom-1 top-1 left-0 z-0 rounded-full bg-[var(--app-surface)] shadow-[0_1px_4px_rgb(15_23_42/12%),inset_0_1px_0_white] transition-[width,transform,opacity] duration-300 ease-[var(--glass-ease)]", indicatorPosition.visible ? "opacity-100" : "opacity-0")} style={{ width: indicatorPosition.width, transform: `translateX(${indicatorPosition.left}px)` }} /> : null}{children}</div>
}

function GlassCluster({ className, children, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="glass-cluster" className={cn("isolate flex w-fit items-center gap-1 [&>*]:relative [&>*]:transition-transform [&>*:hover]:z-10", className)} {...props}>{children}</div>
}

function GlassMorph({ className, transitionKey, children, ...props }: React.ComponentProps<"div"> & { transitionKey?: string }) {
  return <div data-slot="glass-morph" data-transition-key={transitionKey} className={cn("transition-[width,height,opacity,transform] duration-300 ease-[var(--glass-ease)] motion-reduce:transition-none", className)} {...props}>{children}</div>
}

type GlassPreferencesProps = React.ComponentProps<"div"> & {
  defaultClarity?: number
  showBorders?: boolean
  reduceHighlights?: boolean
}

function GlassPreferences({ className, defaultClarity = 0.15, showBorders = true, reduceHighlights = false, ...props }: GlassPreferencesProps) {
  const [clarity, setClarity] = React.useState(defaultClarity)
  const [reduceTransparency, setReduceTransparency] = React.useState(false)
  const previousSettings = React.useRef<{ styles: Map<string, string>; attributes: Map<string, string | null> } | null>(null)
  React.useEffect(() => {
    const root = document.documentElement
    const styleProperties = ["--glass-clarity", "--glass-opacity", "--glass-opacity-strong", "--glass-opacity-subtle", "--glass-opacity-thick"]
    const attributes = ["data-glass-reduce-transparency", "data-glass-show-borders", "data-glass-reduce-highlights"]
    previousSettings.current = {
      styles: new Map(styleProperties.map((property) => [property, root.style.getPropertyValue(property)])),
      attributes: new Map(attributes.map((attribute) => [attribute, root.getAttribute(attribute)])),
    }
    return () => {
      const previous = previousSettings.current
      if (!previous) return
      for (const [property, value] of previous.styles) {
        if (value) root.style.setProperty(property, value)
        else root.style.removeProperty(property)
      }
      for (const [attribute, value] of previous.attributes) {
        if (value === null) root.removeAttribute(attribute)
        else root.setAttribute(attribute, value)
      }
      previousSettings.current = null
    }
  }, [])
  React.useEffect(() => {
    const root = document.documentElement
    const opacity = (base: number, range: number) => `${Math.round((base + clarity * range) * 100)}%`
    root.style.setProperty("--glass-clarity", String(reduceTransparency ? Math.max(clarity, 0.9) : clarity))
    root.style.setProperty("--glass-opacity", opacity(0.42, 0.2))
    root.style.setProperty("--glass-opacity-strong", opacity(0.6, 0.28))
    root.style.setProperty("--glass-opacity-subtle", opacity(0.18, 0.2))
    root.style.setProperty("--glass-opacity-thick", opacity(0.78, 0.16))
    root.toggleAttribute("data-glass-reduce-transparency", reduceTransparency)
    root.toggleAttribute("data-glass-show-borders", showBorders)
    root.toggleAttribute("data-glass-reduce-highlights", reduceHighlights)
  }, [clarity, reduceTransparency, showBorders, reduceHighlights])
  return (
    <div data-slot="glass-preferences" className={cn("grid gap-5", className)} {...props}>
      <div className="grid gap-3">
        <div className="flex items-center justify-between"><label htmlFor="glass-clarity" className="text-sm font-medium">Clarity</label><output htmlFor="glass-clarity" className="text-xs tabular-nums text-muted-foreground">{Math.round((1 - clarity) * 100)}%</output></div>
        <input id="glass-clarity" aria-label="Glass clarity" type="range" min="0" max="1" step="0.01" value={clarity} disabled={reduceTransparency} onChange={(event) => setClarity(Number(event.target.value))} className="w-full accent-primary" />
        <div className="flex justify-between text-xs text-muted-foreground"><span>Clear</span><span>Tinted</span></div>
      </div>
      <label className="flex items-center justify-between gap-4 text-sm">Reduce transparency<Switch checked={reduceTransparency} onCheckedChange={setReduceTransparency} aria-label="Reduce transparency" /></label>
    </div>
  )
}

type StepperProps = React.ComponentProps<"div"> & {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  largeStep?: number
  ariaLabel: string
}

function Stepper({ className, value, onValueChange, min = 0, max = Number.MAX_SAFE_INTEGER, step = 1, largeStep = step * 10, ariaLabel, ...props }: StepperProps) {
  const repeatTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeatInterval = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const didRepeat = React.useRef(false)
  const currentValue = React.useRef(value)
  React.useEffect(() => { currentValue.current = value }, [value])
  const update = (amount: number) => { const next = Math.min(max, Math.max(min, currentValue.current + amount)); currentValue.current = next; onValueChange(next) }
  const stopRepeat = () => { if (repeatTimeout.current) clearTimeout(repeatTimeout.current); if (repeatInterval.current) clearInterval(repeatInterval.current); repeatTimeout.current = null; repeatInterval.current = null }
  const startRepeat = (amount: number) => {
    stopRepeat()
    didRepeat.current = false
    repeatTimeout.current = setTimeout(() => {
      didRepeat.current = true
      update(amount)
      repeatInterval.current = setInterval(() => update(amount), 80)
    }, 420)
  }
  React.useEffect(() => stopRepeat, [])
  const clickStep = (amount: number) => { if (!didRepeat.current) update(amount); didRepeat.current = false }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") { event.preventDefault(); update(event.shiftKey ? largeStep : step) }
    if (event.key === "ArrowDown" || event.key === "ArrowLeft") { event.preventDefault(); update(-(event.shiftKey ? largeStep : step)) }
    if (event.key === "Home") { event.preventDefault(); onValueChange(min) }
    if (event.key === "End") { event.preventDefault(); onValueChange(max) }
  }
  return <div role="spinbutton" aria-label={ariaLabel} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} tabIndex={0} data-slot="stepper" onKeyDown={handleKeyDown} className={cn("inline-flex items-center gap-1 rounded-full border border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity-subtle),transparent)] p-1 shadow-[inset_0_1px_0_var(--glass-chrome-highlight)]", className)} {...props}>
    <Button type="button" aria-label={`Decrease ${ariaLabel}`} size="icon-sm" variant="ghost" disabled={value <= min} onPointerDown={() => startRepeat(-step)} onPointerUp={stopRepeat} onPointerCancel={stopRepeat} onPointerLeave={stopRepeat} onClick={() => clickStep(-step)}>−</Button>
    <output className="min-w-10 text-center text-sm font-medium tabular-nums">{value}</output>
    <Button type="button" aria-label={`Increase ${ariaLabel}`} size="icon-sm" variant="ghost" disabled={value >= max} onPointerDown={() => startRepeat(step)} onPointerUp={stopRepeat} onPointerCancel={stopRepeat} onPointerLeave={stopRepeat} onClick={() => clickStep(step)}>+</Button>
  </div>
}

type DatePickerValue = Date | DateRange | undefined
type DatePickerProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  mode?: "single" | "range" | "date-time"
  value?: DatePickerValue
  defaultValue?: DatePickerValue
  onValueChange?: (value: DatePickerValue) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  placeholder?: string
  label?: string
  minuteStep?: number
  variant?: "capsule" | "field"
}

function DatePicker({ mode = "single", value: controlledValue, defaultValue, onValueChange, open: controlledOpen, onOpenChange, placeholder = "Choose date", label, minuteStep = 15, variant = "capsule", className, ...props }: DatePickerProps) {
  const generatedId = React.useId()
  const [internalValue, setInternalValue] = React.useState<DatePickerValue>(defaultValue)
  const [internalOpen, setInternalOpen] = React.useState(false)
  const value = controlledValue ?? internalValue
  const open = controlledOpen ?? internalOpen
  const updateValue = (next: DatePickerValue) => { if (controlledValue === undefined) setInternalValue(next); onValueChange?.(next) }
  const updateOpen = (next: boolean) => { if (controlledOpen === undefined) setInternalOpen(next); onOpenChange?.(next) }
  const date = value instanceof Date ? value : value?.from
  const dateFormatter = React.useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }), [])
  const displayValue = mode === "range" && value && !(value instanceof Date)
    ? value.from && value.to ? `${dateFormatter.format(value.from)} – ${dateFormatter.format(value.to)}` : value.from ? `${dateFormatter.format(value.from)} – …` : placeholder
    : date ? `${dateFormatter.format(date)}${mode === "date-time" ? `, ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}` : placeholder
  const stepMinutes = Number.isInteger(minuteStep) && minuteStep > 0 && 60 % minuteStep === 0 ? minuteStep : 15
  const setDate = (next: Date | undefined) => {
    if (!next) return updateValue(undefined)
    if (mode === "date-time" && date) next.setHours(date.getHours(), date.getMinutes(), 0, 0)
    updateValue(next)
    if (mode === "single") updateOpen(false)
  }
  const setTime = (time: string) => {
    if (!date || !time) return
    const [hours = "0", minutes = "0"] = time.split(":")
    const next = new Date(date)
    next.setHours(Number(hours), Number(minutes), 0, 0)
    updateValue(next)
    updateOpen(false)
  }
  return <div data-slot="date-picker" data-mode={mode} className={cn("inline-grid gap-1.5", className)} {...props}>
    {label ? <span className="text-sm font-medium">{label}</span> : null}
    <Popover open={open} onOpenChange={updateOpen}>
      <PopoverTrigger render={<Button type="button" variant={variant === "capsule" ? "glass" : "outline"} className={cn("justify-start gap-2 text-left font-normal", variant === "capsule" ? "rounded-full" : "rounded-xl")} aria-label={label ?? placeholder} />}>⌕<span className="truncate">{displayValue}</span></PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-1.5rem)] p-2">
        {mode === "range" ? <Calendar mode="range" selected={value instanceof Date ? undefined : value} onSelect={(range) => { updateValue(range); if (range?.from && range.to) updateOpen(false) }} /> : <Calendar mode="single" selected={date} onSelect={setDate} />}
        {mode === "date-time" ? <div className="flex items-center justify-between gap-3 border-t border-border px-2 pt-2"><label htmlFor={`${generatedId}-time`} className="text-xs text-muted-foreground">Time</label><input id={`${generatedId}-time`} type="time" step={stepMinutes * 60} value={date ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : ""} onChange={(event) => setTime(event.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm" /></div> : null}
      </PopoverContent>
    </Popover>
  </div>
}

export { SegmentedControl, GlassGroup, GlassCluster, GlassMorph, GlassPreferences, Stepper, DatePicker, type DatePickerValue }
