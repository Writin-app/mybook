import * as React from "react"

import { cn } from "@/lib/utils"
import { Glass } from "@/components/glass/glass"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type DockItem = { id: string; label: string; icon: React.ReactNode; badge?: React.ReactNode; disabled?: boolean; prominent?: boolean }

function Dock({ items, value, onValueChange, className, accessory, position = "fixed", minimizeBehavior = "never", layout = "default", ...props }: React.ComponentProps<"nav"> & { items: DockItem[]; value: string; onValueChange: (value: string) => void; accessory?: React.ReactNode; position?: "fixed" | "static"; minimizeBehavior?: "never" | "onScrollDown"; layout?: "default" | "compact" }) {
  const root = React.useRef<HTMLElement>(null)
  const [minimized, setMinimized] = React.useState(false)
  React.useEffect(() => {
    if (position !== "fixed") return
    const node = root.current
    const html = document.documentElement
    const oldInset = html.style.getPropertyValue("--dock-inset")
    const updateInset = () => { if (node) html.style.setProperty("--dock-inset", `calc(${node.offsetHeight}px + max(1rem, env(safe-area-inset-bottom)))`) }
    updateInset()
    const resize = typeof ResizeObserver === "undefined" || !node ? undefined : new ResizeObserver(updateInset)
    if (node) resize?.observe(node)
    return () => { resize?.disconnect(); if (html.style.getPropertyValue("--dock-inset") !== oldInset) { if (oldInset) html.style.setProperty("--dock-inset", oldInset); else html.style.removeProperty("--dock-inset") } }
  }, [position, minimized, layout])
  React.useEffect(() => {
    if (minimizeBehavior !== "onScrollDown") return
    let previous = window.scrollY
    const update = () => { const current = window.scrollY; if (Math.abs(current - previous) > 4) setMinimized(current > previous && current > 48); previous = current }
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [minimizeBehavior])
  return <nav ref={root} aria-label="Primary dock" data-slot="dock" data-position={position} data-minimized={minimized || undefined} data-layout={layout} className={cn("flex justify-center px-4", position === "fixed" ? "fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40" : "relative w-fit max-w-full", className)} {...props}>
    <Glass variant="liquid" intensity="strong" className={cn("flex max-w-full items-center gap-1 p-1.5", minimized && "scale-95")}>
      {items.map((item) => <button key={item.id} type="button" disabled={item.disabled} aria-current={value === item.id ? "page" : undefined} aria-label={item.label} data-slot="dock-item" data-active={value === item.id || undefined} data-prominent={item.prominent || undefined} onClick={() => onValueChange(item.id)} className={cn("relative flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full px-3 text-muted-foreground outline-none transition-[background-color,color,transform] focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50", layout === "default" && "flex-col py-2 text-[10px]", minimized && "min-h-10 min-w-10 px-2", value === item.id && "bg-[var(--app-surface)] text-primary shadow-sm", item.prominent && "bg-primary/10 text-primary")}>
        <span aria-hidden="true" className="text-lg leading-none">{item.icon}</span><span className={cn(minimized && "sr-only")}>{item.label}</span>{item.badge ? <span className="absolute -top-0.5 -right-0.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">{item.badge}</span> : null}
      </button>)}
      {accessory ? <span className="ml-1 border-l border-[var(--glass-rim)] pl-2">{accessory}</span> : null}
    </Glass>
  </nav>
}

function Toolbar({ className, title, leading, trailing, children, placement = "top", minimize = "never", onKeyDown, ...props }: React.ComponentProps<"div"> & { title?: React.ReactNode; leading?: React.ReactNode; trailing?: React.ReactNode; placement?: "top" | "bottom" | "sticky-top" | "sticky-bottom" | "static"; minimize?: "never" | "onScrollDown" }) {
  const [minimized, setMinimized] = React.useState(false)
  React.useEffect(() => {
    if (minimize !== "onScrollDown") return
    let previous = window.scrollY
    const update = () => { const current = window.scrollY; if (Math.abs(current - previous) > 4) setMinimized(current > previous && current > 48); previous = current }
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [minimize])
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || event.target instanceof HTMLInputElement) return
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (index < 0 || !items.length) return
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl"
    const step = event.key === "ArrowRight" ? (rtl ? -1 : 1) : event.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + step + items.length) % items.length
    items[next]?.focus()
    event.preventDefault()
  }
  const placementClass = placement === "top" ? "fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 mx-auto max-w-5xl" : placement === "bottom" ? "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-5xl" : placement === "sticky-top" ? "sticky top-3 z-30" : placement === "sticky-bottom" ? "sticky bottom-3 z-30" : ""
  return <Glass data-slot="toolbar" role="toolbar" data-placement={placement} data-minimized={minimized || undefined} onMouseEnter={() => setMinimized(false)} onFocus={() => setMinimized(false)} onKeyDown={handleKeyDown} variant="liquid" intensity="strong" className={cn("flex min-h-12 w-full items-center gap-2 px-2 py-1.5 transition-[min-height,padding,transform] duration-200", placementClass, minimized && "min-h-10 scale-[0.92] p-1", className)} {...props}>
    {leading ? <div className="flex items-center gap-1">{leading}</div> : null}
    {title ? <span className="min-w-0 flex-1 truncate px-2 text-sm font-semibold">{title}</span> : <span className="flex-1" />}
    {children ? <div className="flex items-center gap-1">{children}</div> : null}
    {trailing ? <div className="flex items-center gap-1">{trailing}</div> : null}
  </Glass>
}

function ScrollEdge({ className, children, maxHeight = "24rem", style, ...props }: React.ComponentProps<"div"> & { maxHeight?: string }) {
  const viewport = React.useRef<HTMLDivElement>(null)
  const [edges, setEdges] = React.useState({ top: false, bottom: false })
  const update = React.useCallback(() => {
    const node = viewport.current
    if (!node) return
    setEdges({ top: node.scrollTop > 1, bottom: node.scrollTop + node.clientHeight < node.scrollHeight - 1 })
  }, [])
  React.useEffect(() => { update(); const node = viewport.current; if (!node) return; const observer = new ResizeObserver(update); observer.observe(node); return () => observer.disconnect() }, [update, children])
  return <div data-slot="scroll-edge" className={cn("relative overflow-hidden", className)} style={{ maxHeight, ...style }} {...props}>
    {edges.top ? <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[var(--app-surface)] to-transparent" /> : null}
    <div ref={viewport} onScroll={update} className="max-h-[inherit] overflow-y-auto">{children}</div>
    {edges.bottom ? <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-[var(--app-surface)] to-transparent" /> : null}
  </div>
}

function NavigationBar({ className, title, subtitle, leading, trailing, collapsed, titleDisplayMode = "large", children, ...props }: Omit<React.ComponentProps<"header">, "title"> & { title: React.ReactNode; subtitle?: React.ReactNode; leading?: React.ReactNode; trailing?: React.ReactNode; collapsed?: boolean; titleDisplayMode?: "large" | "inline" }) {
  const bar = React.useRef<HTMLElement>(null)
  const largeTitle = React.useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = React.useState(titleDisplayMode === "inline")
  React.useEffect(() => {
    const target = largeTitle.current
    if (!target || titleDisplayMode === "inline" || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry?.isIntersecting), { threshold: 0, rootMargin: `-${bar.current?.offsetHeight ?? 56}px 0px 0px 0px` })
    observer.observe(target)
    return () => observer.disconnect()
  }, [titleDisplayMode])
  const isCollapsed = collapsed ?? scrolled
  return <><header ref={bar} data-slot="navigation-bar" data-collapsed={isCollapsed || undefined} className={cn("sticky top-0 z-30 border-b border-[color-mix(in_srgb,var(--app-border)_48%,transparent)] bg-transparent px-4 py-3 transition-[padding,background-color] duration-200", isCollapsed && "bg-[color-mix(in_srgb,var(--background)_82%,transparent)] backdrop-blur-xl", className)} {...props}>
    <div className="mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-3">{leading ? <NavigationBarLeading>{leading}</NavigationBarLeading> : null}<div aria-hidden={titleDisplayMode === "large" && !isCollapsed} className={cn("col-start-2 row-start-1 min-w-0 truncate text-center text-lg font-semibold transition-opacity", isCollapsed ? "opacity-100" : "pointer-events-none opacity-0")}>{title}</div>{trailing ? <NavigationBarTrailing>{trailing}</NavigationBarTrailing> : null}{children}</div>
  </header>{titleDisplayMode === "large" ? <div ref={largeTitle} data-slot="navigation-bar-large-title" className="px-4 pt-1 pb-3"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>{subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}</div> : null}</>
}

function NavigationBarLeading({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="navigation-bar-leading" className={cn("col-start-1 row-start-1 flex min-w-0 items-center gap-2 justify-self-start", className)} {...props} />
}

function NavigationBarTrailing({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="navigation-bar-trailing" className={cn("col-start-3 row-start-1 flex min-w-0 items-center gap-2 justify-self-end", className)} {...props} />
}

type SearchToken = { id: string; label: string }
type SearchSuggestion = string | { value: string; label: React.ReactNode }
type SearchFieldProps = Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "onSubmit"> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  onSubmit?: (value: string) => void
  placeholder?: string
  suggestions?: SearchSuggestion[]
  onSuggestionSelect?: (value: string) => void
  tokens?: readonly SearchToken[]
  onTokenRemove?: (id: string) => void
  minimized?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  placement?: "inline" | "bottom"
  showCancel?: "auto" | "always" | "never"
  cancelLabel?: string
  onCancel?: () => void
}

function SearchField({ className, value: controlledValue, defaultValue = "", onValueChange, onSubmit, placeholder = "Search", suggestions = [], onSuggestionSelect, tokens = [], onTokenRemove, minimized = false, expanded, onExpandedChange, placement = "inline", showCancel = "auto", cancelLabel = "Cancel", onCancel, id, onFocus, onBlur, onKeyDown, ...props }: SearchFieldProps) {
  const [innerValue, setInnerValue] = React.useState(defaultValue)
  const value = controlledValue ?? innerValue
  const [internalExpanded, setInternalExpanded] = React.useState(!minimized)
  const isExpanded = expanded ?? internalExpanded
  const [focused, setFocused] = React.useState(false)
  const [active, setActive] = React.useState(-1)
  const root = React.useRef<HTMLDivElement>(null)
  const input = React.useRef<HTMLInputElement>(null)
  const generatedId = React.useId()
  const listId = `${id ?? generatedId}-suggestions`
  const updateValue = (next: string) => { if (controlledValue === undefined) setInnerValue(next); onValueChange?.(next) }
  const updateExpanded = (next: boolean) => { if (expanded === undefined) setInternalExpanded(next); onExpandedChange?.(next) }
  React.useEffect(() => {
    if (minimized && isExpanded) input.current?.focus()
  }, [isExpanded, minimized])
  const pick = (suggestion: SearchSuggestion) => {
    const next = typeof suggestion === "string" ? suggestion : suggestion.value
    updateValue(next); setActive(-1); onSuggestionSelect?.(next)
  }
  const cancel = () => { updateValue(""); setActive(-1); input.current?.blur(); if (minimized) updateExpanded(false); onCancel?.() }
  React.useEffect(() => {
    if (placement !== "bottom" || !root.current || !window.visualViewport) return
    const viewport = window.visualViewport
    const update = () => root.current?.style.setProperty("--search-keyboard-inset", `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`)
    update(); viewport.addEventListener("resize", update); viewport.addEventListener("scroll", update)
    return () => { viewport.removeEventListener("resize", update); viewport.removeEventListener("scroll", update) }
  }, [placement])
  if (minimized && !isExpanded) return <Button data-slot="search-field-minimized" variant="glass" size="icon" aria-label={placeholder} onClick={() => updateExpanded(true)}>⌕</Button>
  const showCancelButton = showCancel === "always" || (showCancel === "auto" && (focused || (minimized && isExpanded)))
  return <div ref={root} data-slot="search-field" data-placement={placement} className={cn("relative grid gap-2", placement === "bottom" && "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 translate-y-[calc(-1*var(--search-keyboard-inset,0px))]", className)}>
    <div className="flex items-center gap-2 rounded-full border border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity-strong),transparent)] px-3 shadow-[var(--glass-chrome-shadow),inset_0_1px_0_var(--glass-chrome-highlight)] backdrop-blur-xl">
      {tokens.map((token) => <span key={token.id} data-slot="search-token" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{token.label}<button type="button" aria-label={`Remove ${token.label}`} onClick={() => onTokenRemove?.(token.id)}>×</button></span>)}
      <span aria-hidden="true" className="text-muted-foreground">⌕</span><Input {...props} ref={input} id={id} role="combobox" aria-label={props["aria-label"] ?? placeholder} aria-autocomplete="list" aria-expanded={focused && suggestions.length > 0} aria-controls={listId} aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined} type="search" value={value} onChange={(event) => { updateValue(event.target.value); setActive(-1) }} onFocus={(event) => { setFocused(true); onFocus?.(event) }} onBlur={(event) => { setFocused(false); onBlur?.(event) }} onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.key === "ArrowDown" && suggestions.length) { event.preventDefault(); setActive((current) => (current + 1) % suggestions.length) }
        else if (event.key === "ArrowUp" && suggestions.length) { event.preventDefault(); setActive((current) => (current - 1 + suggestions.length) % suggestions.length) }
        else if (event.key === "Enter") { if (active >= 0 && suggestions[active]) { event.preventDefault(); pick(suggestions[active]) } else onSubmit?.(value) }
        else if (event.key === "Escape") { if (value) updateValue(""); else cancel() }
        else if (event.key === "Backspace" && !value && tokens.length) onTokenRemove?.(tokens[tokens.length - 1]!.id)
      }} placeholder={placeholder} className="h-10 min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0" />
      {value ? <Button type="button" size="icon-xs" variant="ghost" aria-label="Clear search" onClick={() => updateValue("")}>×</Button> : null}
      {showCancelButton ? <Button type="button" size="sm" variant="ghost" onClick={cancel}>{cancelLabel}</Button> : null}
    </div>
    {focused && suggestions.length ? <div id={listId} role="listbox" data-slot="search-field-suggestions" className={cn("absolute inset-x-0 top-full z-50 mt-2 max-h-64 overflow-auto rounded-2xl border border-[var(--glass-rim)] bg-[var(--app-surface)] p-1 shadow-xl", placement === "bottom" && "top-auto bottom-full mb-2")}>{suggestions.map((suggestion, index) => { const itemValue = typeof suggestion === "string" ? suggestion : suggestion.value; const label = typeof suggestion === "string" ? suggestion : suggestion.label; return <button key={itemValue} id={`${listId}-${index}`} type="button" role="option" aria-selected={active === index} onMouseDown={(event) => event.preventDefault()} onClick={() => pick(suggestion)} className={cn("w-full rounded-xl px-3 py-2 text-left text-sm", active === index && "bg-primary/10 text-primary")}>{label}</button> })}</div> : null}
  </div>
}

type GroupedListRow = { id: string; title: React.ReactNode; description?: React.ReactNode; icon?: React.ReactNode; value?: React.ReactNode; onSelect?: () => void; disabled?: boolean }
type GroupedListGroup = { id: string; title?: React.ReactNode; footer?: React.ReactNode; rows: GroupedListRow[] }

function GroupedList({ groups, className, ...props }: React.ComponentProps<"div"> & { groups: GroupedListGroup[] }) {
  return <div data-slot="grouped-list" className={cn("grid gap-5", className)} {...props}>
    {groups.map((group) => <section key={group.id} className="overflow-hidden rounded-3xl border border-[var(--glass-rim)] bg-[color-mix(in_srgb,var(--glass-tint)_var(--glass-opacity),transparent)] shadow-[inset_0_1px_0_var(--glass-chrome-highlight)] backdrop-blur-xl">
      {group.title ? <h3 className="px-4 pt-4 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.title}</h3> : null}
      <ul className="divide-y divide-[color-mix(in_srgb,var(--app-border)_55%,transparent)]">{group.rows.map((row) => <li key={row.id}>
        <button type="button" disabled={row.disabled} onClick={row.onSelect} className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:opacity-50">
          {row.icon ? <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{row.icon}</span> : null}
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{row.title}</span>{row.description ? <span className="block truncate text-xs text-muted-foreground">{row.description}</span> : null}</span>{row.value ? <span className="text-sm text-muted-foreground">{row.value}</span> : null}
        </button>
      </li>)}</ul>{group.footer ? <div className="border-t border-[color-mix(in_srgb,var(--app-border)_55%,transparent)] px-4 py-3 text-xs text-muted-foreground">{group.footer}</div> : null}
    </section>)}
  </div>
}

export { Dock, Toolbar, ScrollEdge, NavigationBar, NavigationBarLeading, NavigationBarTrailing, SearchField, GroupedList, type SearchToken }
