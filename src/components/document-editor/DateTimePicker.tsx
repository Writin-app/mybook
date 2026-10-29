import { ArrowLeftIcon, ArrowRightIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { format, isValid, parse } from 'date-fns'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

const MONTHS = Array.from({ length: 12 }, (_, month) => format(new Date(2024, month, 1), 'MMMM'))
const YEAR_START = 1900
const YEAR_END = 2100
const YEAR_PAGE_MAX = YEAR_START + Math.floor((YEAR_END - YEAR_START) / 12) * 12
const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: 'full', label: 'Full date' },
  { value: 'short', label: 'Short date' },
  { value: 'month-day-year', label: 'Month/Day/Year' },
  { value: 'day-month-year', label: 'Day/Month/Year' },
  { value: 'year-month-day', label: 'Year/Month/Day' },
  { value: 'relative', label: 'Relative' },
]

export type DateFormat = 'relative' | 'full' | 'short' | 'month-day-year' | 'day-month-year' | 'year-month-day'
type PickerView = 'calendar' | 'months' | 'years'
type ActiveDate = 'start' | 'end'
type MobilePickerSnapshot = {
  value: string | null
  endDateEnabled: boolean
  endValue: string | null
  includeTime: boolean
  use24Hour: boolean
  dateFormat: DateFormat
}

export interface DateTimePickerProps {
  value: string | null
  endDateEnabled: boolean
  endValue: string | null
  includeTime: boolean
  use24Hour: boolean
  dateFormat: DateFormat
  onChange: (value: string | null, includeTime: boolean) => void
  onEndDateChange: (enabled: boolean, value: string | null) => void
  onIncludeTimeChange: (includeTime: boolean) => void
  onTimeFormatChange: (use24Hour: boolean) => void
  onDateFormatChange: (dateFormat: DateFormat) => void
  onClear: () => void
  className?: string
  disabled?: boolean
  autoOpen?: boolean
}

function validDate(value: string | null) {
  if (!value) return null
  const localDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if (localDateOnly) return new Date(Number(localDateOnly[1]), Number(localDateOnly[2]) - 1, Number(localDateOnly[3]))
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateValue(date: Date, includeTime: boolean) {
  if (includeTime) return date.toISOString()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateFromValue(value: string | null) {
  const parsed = validDate(value)
  if (parsed) return parsed
  const now = new Date()
  now.setSeconds(0, 0)
  return now
}

function formatDate(date: Date, dateFormat: DateFormat) {
  if (dateFormat === 'full') return format(date, 'MMMM d, yyyy')
  if (dateFormat === 'short') return format(date, 'MMM d, yyyy')
  if (dateFormat === 'month-day-year') return format(date, 'MM/dd/yyyy')
  if (dateFormat === 'day-month-year') return format(date, 'dd/MM/yyyy')
  if (dateFormat === 'year-month-day') return format(date, 'yyyy/MM/dd')

  const today = new Date()
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const dayDelta = Math.round((dateDay - todayDay) / 86_400_000)
  if (dayDelta === 0) return 'Today'
  if (dayDelta === -1) return 'Yesterday'
  if (dayDelta === 1) return 'Tomorrow'
  return format(date, 'MMM d, yyyy')
}

function formatTime(date: Date, use24Hour: boolean) {
  return format(date, use24Hour ? 'HH:mm' : 'h:mm aa')
}

function formatLabel(value: string | null, includeTime: boolean, use24Hour: boolean, dateFormat: DateFormat) {
  if (!value) return 'Select date & time'
  const date = dateFromValue(value)
  return `${formatDate(date, dateFormat)}${includeTime ? ` ${formatTime(date, use24Hour)}` : ''}`
}

function mergeDateAndTime(date: Date, year: number, month: number, day: number, hour: number, minute: number) {
  return new Date(year, month, day, hour, minute, 0, 0)
}

function TimeInputs({ date, use24Hour, disabled, onChange, onToggleMeridiem }: { date: Date; use24Hour: boolean; disabled?: boolean; onChange: (field: 'hour' | 'minute', value: string) => void; onToggleMeridiem: () => void }) {
  const hour24 = date.getHours()
  const hourValue = use24Hour ? hour24 : hour24 % 12 || 12
  const minuteValue = date.getMinutes()
  return (
    <div className="flex min-w-0 items-center gap-1 px-2">
      <input aria-label="Hour" type="number" inputMode="numeric" min={use24Hour ? 0 : 1} max={use24Hour ? 23 : 12} step={1} disabled={disabled} value={String(hourValue).padStart(2, '0')} onChange={(event) => onChange('hour', event.target.value)} onBlur={(event) => { const next = Number(event.currentTarget.value); if (!event.currentTarget.value || next < (use24Hour ? 0 : 1) || next > (use24Hour ? 23 : 12)) event.currentTarget.value = String(hourValue).padStart(2, '0') }} className="h-7 w-10 rounded-md border-0 bg-transparent px-0.5 text-center text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 [&::-webkit-inner-spin-button]:opacity-100" />
      <span className="text-muted-foreground">:</span>
      <input aria-label="Minute" type="number" inputMode="numeric" min={0} max={59} step={1} disabled={disabled} value={String(minuteValue).padStart(2, '0')} onChange={(event) => onChange('minute', event.target.value)} onBlur={(event) => { const next = Number(event.currentTarget.value); if (!event.currentTarget.value || next < 0 || next > 59) event.currentTarget.value = String(minuteValue).padStart(2, '0') }} className="h-7 w-10 rounded-md border-0 bg-transparent px-0.5 text-center text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 [&::-webkit-inner-spin-button]:opacity-100" />
      {!use24Hour && <button type="button" disabled={disabled} aria-label="Toggle AM or PM" onClick={onToggleMeridiem} className="rounded px-1 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-45">{hour24 >= 12 ? 'PM' : 'AM'}</button>}
    </div>
  )
}

export function DateTimePicker({
  value,
  endDateEnabled,
  endValue,
  includeTime,
  use24Hour,
  dateFormat,
  onChange,
  onEndDateChange,
  onIncludeTimeChange,
  onTimeFormatChange,
  onDateFormatChange,
  onClear,
  className,
  disabled,
  autoOpen = false,
}: DateTimePickerProps) {
  const isMobile = useIsMobile()
  const selected = validDate(value)
  const startDate = selected ?? dateFromValue(value)
  const endDate = validDate(endValue) ?? startDate
  const [open, setOpen] = useState(false)
  const [dateText, setDateText] = useState(value ? format(startDate, 'yyyy-MM-dd') : '')
  const [endDateText, setEndDateText] = useState(endValue ? format(endDate, 'yyyy-MM-dd') : '')
  const [visibleMonth, setVisibleMonth] = useState(() => selected ?? new Date())
  const [view, setView] = useState<PickerView>('calendar')
  const [dateFormatOpen, setDateFormatOpen] = useState(false)
  const [activeDate, setActiveDate] = useState<ActiveDate>('start')
  const mobileEditRef = useRef<{ snapshot: MobilePickerSnapshot; confirmed: boolean } | null>(null)
  const [yearPageStart, setYearPageStart] = useState(() => {
    const year = (selected ?? new Date()).getFullYear()
    return YEAR_START + Math.floor((year - YEAR_START) / 12) * 12
  })

  useEffect(() => {
    const sDate = validDate(value) ?? dateFromValue(value)
    const eDate = validDate(endValue) ?? sDate
    setDateText(value ? formatDate(sDate, dateFormat) : '')
    setEndDateText(endValue ? formatDate(eDate, dateFormat) : '')
  }, [value, endValue, dateFormat])

  useEffect(() => {
    if (!autoOpen) return
    if (isMobile && !mobileEditRef.current) {
      mobileEditRef.current = { snapshot: { value, endDateEnabled, endValue, includeTime, use24Hour, dateFormat }, confirmed: false }
    }
    setOpen(true)
  }, [autoOpen, isMobile, value, endDateEnabled, endValue, includeTime, use24Hour, dateFormat])

  const activeDateValue = activeDate === 'end' ? endDate : startDate
  const yearPage = Array.from({ length: 12 }, (_, index) => yearPageStart + index).filter((year) => year <= YEAR_END)

  const updateActiveDate = (nextDate: Date) => {
    const nextValue = toDateValue(nextDate, includeTime)
    if (activeDate === 'end') onEndDateChange(true, nextValue)
    else onChange(nextValue, includeTime)
    setVisibleMonth(nextDate)
  }

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return
    updateActiveDate(mergeDateAndTime(date, date.getFullYear(), date.getMonth(), date.getDate(), activeDateValue.getHours(), activeDateValue.getMinutes()))
  }

  const handleDateText = (raw: string, target: ActiveDate) => {
    if (target === 'start') setDateText(raw)
    else setEndDateText(raw)
    const formatTokens: Record<Exclude<DateFormat, 'relative'>, string> = {
      full: 'MMMM d, yyyy', short: 'MMM d, yyyy', 'month-day-year': 'MM/dd/yyyy',
      'day-month-year': 'dd/MM/yyyy', 'year-month-day': 'yyyy/MM/dd',
    }
    let parsed: Date
    if (dateFormat === 'relative') {
      const normalized = raw.trim().toLowerCase()
      const today = new Date()
      if (normalized === 'today') parsed = today
      else if (normalized === 'yesterday') parsed = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
      else if (normalized === 'tomorrow') parsed = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      else parsed = parse(raw, 'MMM d, yyyy', new Date())
    } else parsed = parse(raw, formatTokens[dateFormat], new Date())
    if (!isValid(parsed) || parsed.getFullYear() < 1000) return
    const base = target === 'end' ? endDate : startDate
    const nextDate = mergeDateAndTime(base, parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), base.getHours(), base.getMinutes())
    if (target === 'end') onEndDateChange(true, toDateValue(nextDate, includeTime))
    else onChange(toDateValue(nextDate, includeTime), includeTime)
    setVisibleMonth(nextDate)
  }

  const handleStartDateTime = (nextDate: Date) => {
    if (activeDate === 'end') onEndDateChange(true, toDateValue(nextDate, includeTime))
    else onChange(toDateValue(nextDate, includeTime), includeTime)
  }

  const handleTimeField = (field: 'hour' | 'minute', raw: string) => {
    if (!/^\d+$/u.test(raw)) return
    const number = Number(raw)
    const min = field === 'hour' && !use24Hour ? 1 : 0
    const max = field === 'hour' ? (use24Hour ? 23 : 12) : 59
    if (number < min || number > max) return
    const hour = field === 'hour' ? (use24Hour ? number : number % 12 + (activeDateValue.getHours() >= 12 ? 12 : 0)) : activeDateValue.getHours()
    const minute = field === 'minute' ? number : activeDateValue.getMinutes()
    handleStartDateTime(mergeDateAndTime(activeDateValue, activeDateValue.getFullYear(), activeDateValue.getMonth(), activeDateValue.getDate(), hour, minute))
  }

  const toggleMeridiem = () => {
    const nextHour = (activeDateValue.getHours() + 12) % 24
    handleStartDateTime(mergeDateAndTime(activeDateValue, activeDateValue.getFullYear(), activeDateValue.getMonth(), activeDateValue.getDate(), nextHour, activeDateValue.getMinutes()))
  }

  const handleIncludeTime = (enabled: boolean) => {
    onIncludeTimeChange(enabled)
    if (value) onChange(toDateValue(dateFromValue(value), enabled), enabled)
    if (endDateEnabled && endValue) onEndDateChange(true, toDateValue(dateFromValue(endValue), enabled))
  }

  const handleEndDate = (enabled: boolean) => onEndDateChange(enabled, enabled ? (endValue ?? toDateValue(startDate, includeTime)) : endValue)

  const setMonthAndYear = (month: number, year: number) => {
    setVisibleMonth((current) => new Date(year, month, Math.min(current.getDate(), new Date(year, month + 1, 0).getDate())))
  }

  const handleOverlayOpenChange = (nextOpen: boolean) => {
    if (isMobile && nextOpen && !mobileEditRef.current) {
      mobileEditRef.current = { snapshot: { value, endDateEnabled, endValue, includeTime, use24Hour, dateFormat }, confirmed: false }
    }
    if (isMobile && !nextOpen && mobileEditRef.current) {
      const { snapshot, confirmed } = mobileEditRef.current
      mobileEditRef.current = null
      if (!confirmed && (
        snapshot.value !== value || snapshot.endDateEnabled !== endDateEnabled || snapshot.endValue !== endValue ||
        snapshot.includeTime !== includeTime || snapshot.use24Hour !== use24Hour || snapshot.dateFormat !== dateFormat
      )) {
        onChange(snapshot.value, snapshot.includeTime)
        onEndDateChange(snapshot.endDateEnabled, snapshot.endValue)
        onIncludeTimeChange(snapshot.includeTime)
        onTimeFormatChange(snapshot.use24Hour)
        onDateFormatChange(snapshot.dateFormat)
      }
    }
    setOpen(nextOpen)
    if (!nextOpen) setView('calendar')
  }

  const confirmMobileSelection = () => {
    if (mobileEditRef.current) mobileEditRef.current.confirmed = true
    handleOverlayOpenChange(false)
  }

  return (
    <DateTimePickerOverlay
      isMobile={isMobile}
      open={open}
      onOpenChange={handleOverlayOpenChange}
      disabled={disabled}
      className={className}
      ariaLabel={`Date and time: ${formatLabel(value, includeTime, use24Hour, dateFormat)}${endDateEnabled ? ` to ${formatLabel(endValue, includeTime, use24Hour, dateFormat)}` : ''}`}
      label={`@${formatLabel(value, includeTime, use24Hour, dateFormat)}${endDateEnabled ? ` → ${formatLabel(endValue ?? value, includeTime, use24Hour, dateFormat)}` : ''}`}
    >
        <div className="space-y-1.5" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <div className={cn('flex min-h-10 items-center rounded-lg border bg-background transition-colors', activeDate === 'start' ? 'border-ring ring-2 ring-ring/25' : 'border-input')} onFocusCapture={() => setActiveDate('start')}>
            <input aria-label="Start date" type="text" inputMode="text" placeholder="Select date & time" value={value ? dateText : ''} onBlur={() => { if (value) setDateText(formatDate(startDate, dateFormat)) }} onChange={(event) => handleDateText(event.target.value, 'start')} className="h-8 min-w-0 flex-1 rounded-l-lg border-0 bg-transparent px-2.5 text-sm outline-none" />
            {includeTime && <><div className="h-6 border-l border-border" /><TimeInputs date={startDate} use24Hour={use24Hour} onChange={handleTimeField} onToggleMeridiem={toggleMeridiem} /></>}
          </div>
          {endDateEnabled && (
            <div className={cn('flex min-h-10 items-center rounded-lg border bg-background transition-colors', activeDate === 'end' ? 'border-ring ring-2 ring-ring/25' : 'border-input')} onFocusCapture={() => setActiveDate('end')}>
              <input aria-label="End date" type="text" inputMode="text" placeholder="Select date & time" value={endValue ? endDateText : ''} onBlur={() => { if (endValue) setEndDateText(formatDate(endDate, dateFormat)) }} onChange={(event) => handleDateText(event.target.value, 'end')} className="h-8 min-w-0 flex-1 rounded-l-lg border-0 bg-transparent px-2.5 text-sm outline-none" />
              {includeTime && <><div className="h-6 border-l border-border" /><TimeInputs date={endDate} use24Hour={use24Hour} onChange={handleTimeField} onToggleMeridiem={toggleMeridiem} /></>}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1 px-0.5" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <button type="button" aria-label="Choose month" onClick={() => setView(view === 'months' ? 'calendar' : 'months')} className={cn('rounded px-1 py-0.5 text-sm font-semibold hover:bg-muted', view === 'months' && 'bg-muted text-primary')}>
            {format(visibleMonth, 'MMMM')}
          </button>
          <button type="button" aria-label="Choose year" onClick={() => { setYearPageStart(YEAR_START + Math.floor((visibleMonth.getFullYear() - YEAR_START) / 12) * 12); setView(view === 'years' ? 'calendar' : 'years') }} className={cn('rounded px-1 py-0.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground', view === 'years' && 'bg-muted text-primary')}>
            {visibleMonth.getFullYear()}
          </button>
          <button type="button" onClick={() => { updateActiveDate(new Date()); setVisibleMonth(new Date()); setView('calendar') }} className="ml-auto rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">Today</button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={view === 'calendar' ? 'Previous month' : view === 'months' ? 'Previous year' : 'Previous years'} className="text-muted-foreground" onClick={() => {
              if (view === 'calendar') setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
              else if (view === 'months') setVisibleMonth((current) => new Date(current.getFullYear() - 1, current.getMonth(), 1))
              else setYearPageStart((current) => Math.max(YEAR_START, current - 12))
            }}><HugeiconsIcon icon={ArrowLeftIcon} strokeWidth={2} className="size-4" /></Button>
            <Button variant="ghost" size="icon-sm" aria-label={view === 'calendar' ? 'Next month' : view === 'months' ? 'Next year' : 'Next years'} className="text-muted-foreground" onClick={() => {
              if (view === 'calendar') setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
              else if (view === 'months') setVisibleMonth((current) => new Date(current.getFullYear() + 1, current.getMonth(), 1))
              else setYearPageStart((current) => Math.min(YEAR_PAGE_MAX, current + 12))
            }}><HugeiconsIcon icon={ArrowRightIcon} strokeWidth={2} className="size-4" /></Button>
          </div>
        </div>

        <div className="pt-1" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          {view === 'calendar' ? (
            <Calendar
              mode="single"
              selected={activeDateValue}
              onSelect={handleCalendarSelect}
              month={visibleMonth}
              onMonthChange={setVisibleMonth}
              style={{ width: '268px', maxWidth: '100%' }}
              className="mybook-date-time-calendar !mx-0 !w-full p-0 [--cell-size:--spacing(7)]"
              styles={{
                root: { width: '268px', maxWidth: '100%' },
                months: { width: '100%', maxWidth: 'none' },
                month: { width: '268px', maxWidth: '100%' },
                month_grid: { display: 'block', width: '268px', maxWidth: '100%' },
                weekdays: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', width: '268px', maxWidth: '100%' },
                weekday: { minWidth: 0, width: '100%', textAlign: 'center' },
                week: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', width: '268px', maxWidth: '100%' },
                day: { minWidth: 0, width: '100%' },
              }}
              classNames={{
                root: '!w-full',
                months: '!w-full !max-w-none',
                month: '!w-full gap-1',
                month_caption: 'hidden',
                nav: 'hidden',
                month_grid: '!block !w-full table-fixed border-collapse',
                weeks: '!block !w-full',
                weekdays: '!grid !w-full grid-cols-7',
                weekday: '!w-full min-w-0 text-center text-xs',
                week: 'mt-1 !grid !w-full grid-cols-7',
                day: '!flex !w-full min-w-0 items-center justify-center p-0 text-center',
                today: '!rounded-[6px] !bg-transparent',
                day_button: '!size-7 !h-7 !w-7 !min-w-7 !aspect-square !rounded-[6px] p-0 text-xs',
              }}
            />
          ) : view === 'months' ? (
            <div role="grid" aria-label="Select month" className="grid grid-cols-4 gap-1 py-3">
              {MONTHS.map((month, index) => <button type="button" role="gridcell" aria-label={month} aria-pressed={visibleMonth.getMonth() === index} key={month} onClick={() => { setMonthAndYear(index, visibleMonth.getFullYear()); setView('calendar') }} className={cn('h-10 rounded-md text-sm font-medium hover:bg-muted', visibleMonth.getMonth() === index && 'bg-primary text-primary-foreground hover:bg-primary')}>{month.slice(0, 3)}</button>)}
            </div>
          ) : (
            <div role="grid" aria-label="Select year" className="grid grid-cols-4 gap-1 py-3">
              {yearPage.map((year) => <button type="button" role="gridcell" aria-label={String(year)} aria-pressed={visibleMonth.getFullYear() === year} key={year} onClick={() => { setMonthAndYear(visibleMonth.getMonth(), year); setView('calendar') }} className={cn('h-10 rounded-md text-sm font-medium hover:bg-muted', visibleMonth.getFullYear() === year && 'bg-primary text-primary-foreground hover:bg-primary')}>{year}</button>)}
            </div>
          )}
        </div>

        <div className="my-1.5 border-t border-border" />
        <div className="relative">
          <SettingsRow label="End date"><Switch aria-label="End date" checked={endDateEnabled} onCheckedChange={handleEndDate} /></SettingsRow>
          <div className="relative">
            <button type="button" aria-label="Date format" aria-expanded={dateFormatOpen} onClick={() => setDateFormatOpen((current) => !current)} className="flex min-h-8 w-full items-center justify-between rounded px-1 text-left text-sm hover:bg-muted">
              <span>Date format</span><span className="flex items-center gap-1 text-muted-foreground">{DATE_FORMATS.find((option) => option.value === dateFormat)?.label}<HugeiconsIcon icon={ArrowRightIcon} strokeWidth={2} className="size-4" /></span>
            </button>
            {dateFormatOpen && <div role="menu" aria-label="Date format options" data-editor-popover="true" className={cn('absolute right-0 top-0 z-50 w-44 translate-x-[calc(100%+0.5rem)] rounded-lg border border-border bg-popover p-1 shadow-lg', isMobile && 'left-0 top-full w-full translate-x-0')}>
              {DATE_FORMATS.map((option) => <button key={option.value} type="button" role="menuitemradio" aria-checked={dateFormat === option.value} onClick={() => { onDateFormatChange(option.value); setDateFormatOpen(false) }} className="flex h-7 w-full items-center justify-between rounded px-2 text-left text-xs hover:bg-muted">{option.label}{dateFormat === option.value ? <span aria-hidden="true">✓</span> : null}</button>)}
            </div>}
          </div>
          <SettingsRow label="Include time"><Switch aria-label="Include time" checked={includeTime} onCheckedChange={handleIncludeTime} /></SettingsRow>
          {includeTime && <SettingsRow label="24hrs time format"><Switch aria-label="24 hours time format" checked={use24Hour} onCheckedChange={onTimeFormatChange} /></SettingsRow>}
        </div>
        <div className="mt-1.5 border-t border-border pt-1.5">
          <div className="flex items-center gap-2">
            <button type="button" className={cn('flex h-8 items-center rounded px-1 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground', isMobile ? 'flex-1' : 'w-full')} onClick={() => { onClear(); setDateFormatOpen(false) }}>Clear</button>
            {isMobile && <Button type="button" className="h-8 flex-1 rounded-md" onClick={confirmMobileSelection}>Add</Button>}
          </div>
        </div>
    </DateTimePickerOverlay>
  )
}

function DateTimePickerOverlay({ isMobile, open, onOpenChange, disabled, className, ariaLabel, label, children }: {
  isMobile: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
  className?: string
  ariaLabel: string
  label: string
  children: ReactNode
}) {
  const trigger = <Button variant="ghost" size="sm" disabled={disabled} className={cn('h-auto px-0 py-0 font-normal text-muted-foreground hover:bg-transparent hover:text-muted-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground', className)} aria-label={ariaLabel}>{label}</Button>

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger render={trigger} />
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3" aria-label="Date and time picker">
          <SheetHeader className="sr-only"><SheetTitle>Date &amp; Time</SheetTitle></SheetHeader>
          <div className="mx-auto w-full max-w-[280px]">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover modal="trap-focus" open={open} onOpenChange={(nextOpen, details) => {
      if (!nextOpen && details.reason === 'focus-out') return
      onOpenChange(nextOpen)
    }}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" className="w-[min(280px,calc(100vw-1rem))] gap-0 rounded-xl p-1.5 shadow-lg">{children}</PopoverContent>
    </Popover>
  )
}

function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex min-h-8 items-center justify-between gap-3 py-1 pl-1 text-sm"><span>{label}</span>{children}</div>
}
