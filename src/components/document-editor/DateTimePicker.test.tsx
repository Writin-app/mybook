// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'

import { DateTimePicker, type DateTimePickerProps } from './DateTimePicker'

const defaults: Omit<DateTimePickerProps, 'value' | 'includeTime'> = {
  endDateEnabled: false,
  endValue: null,
  use24Hour: false,
  dateFormat: 'relative',
  onChange: vi.fn(),
  onEndDateChange: vi.fn(),
  onIncludeTimeChange: vi.fn(),
  onTimeFormatChange: vi.fn(),
  onDateFormatChange: vi.fn(),
  onClear: vi.fn(),
}

function renderPicker(value: string | null = '2026-10-03', includeTime = false, overrides: Partial<DateTimePickerProps> = {}) {
  return render(<DateTimePicker {...defaults} value={value} includeTime={includeTime} {...overrides} />)
}

function ControlledMobilePicker() {
  const [value, setValue] = useState<string | null>('2026-10-03')
  return <DateTimePicker {...defaults} value={value} includeTime={false} dateFormat="full" onChange={setValue} />
}

describe('DateTimePicker', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  })

  afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
})

  it('shows an inline @ mention and opens the calendar with editable start fields', async () => {
    renderPicker()
    expect(screen.getByText(/^@/u)).toBeTruthy()
    const trigger = screen.getByRole('button', { name: /date and time/i })
    expect(trigger.className).toContain('text-[length:inherit]')
    expect(trigger.className).toContain('text-inherit')
    expect(trigger.className).not.toContain('text-muted-foreground')
    fireEvent.click(trigger)
    expect(await screen.findByRole('grid')).toBeTruthy()
    expect(screen.getByLabelText('Start date')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose month' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose year' })).toBeTruthy()
  })

  it('opens immediately when a newly inserted block requests the picker', async () => {
    render(<DateTimePicker {...defaults} value="2026-10-03T14:30:00.000Z" includeTime endDateEnabled={false} autoOpen />)
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.getByLabelText('Start date')).toBeTruthy()
  })

  it('opens the picker as a bottom sheet on mobile', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    renderPicker()

    fireEvent.click(screen.getByRole('button', { name: /date and time/i }))

    const sheet = await screen.findByLabelText('Date and time picker')
    expect(sheet.getAttribute('data-slot')).toBe('sheet-content')
    expect(screen.getByRole('grid')).toBeTruthy()
  })

  it('discards mobile sheet edits on close and keeps them when Add is pressed', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    render(<ControlledMobilePicker />)

    fireEvent.click(screen.getByRole('button', { name: /date and time/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Next month' }))
    fireEvent.click(await screen.findByRole('button', { name: /November 12th, 2026/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('button', { name: /October 3, 2026/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /date and time/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Next month' }))
    fireEvent.click(await screen.findByRole('button', { name: /December 12th, 2026/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('button', { name: /December 12, 2026/i })).toBeTruthy()
    expect(screen.queryByLabelText('Date and time picker')).toBeNull()
  })

  it('supports month navigation and selecting a calendar day', async () => {
    const onChange = vi.fn()
    renderPicker('2026-10-03', false, { onChange })
    fireEvent.click(screen.getByRole('button', { name: /date and time/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('button', { name: 'Choose month' }).textContent).toContain('November')
    fireEvent.click(screen.getByRole('button', { name: /November 12th, 2026/ }))
    expect(onChange).toHaveBeenLastCalledWith('2026-11-12', false)
  })

  it('opens 4-column month and year grids and pages them with arrows', async () => {
    renderPicker()
    fireEvent.click(screen.getByRole('button', { name: /date and time/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Choose month' }))
    const monthGrid = await screen.findByRole('grid', { name: 'Select month' })
    expect(monthGrid.querySelectorAll('[role="gridcell"]')).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: 'Next year' }))
    fireEvent.click(screen.getByRole('gridcell', { name: 'June' }))
    expect(screen.getByRole('button', { name: 'Choose month' }).textContent).toContain('June')

    fireEvent.click(screen.getByRole('button', { name: 'Choose year' }))
    const yearGrid = await screen.findByRole('grid', { name: 'Select year' })
    expect(yearGrid.querySelectorAll('[role="gridcell"]')).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: 'Next years' }))
    fireEvent.click(screen.getByRole('gridcell', { name: '2038' }))
    expect(screen.getByRole('button', { name: 'Choose year' }).textContent).toContain('2038')
  })

  it('shows bounded hour/minute inputs and allows end date and time format settings', async () => {
    const onEndDateChange = vi.fn()
    const onTimeFormatChange = vi.fn()
    renderPicker('2026-10-03T14:30:00.000Z', true, { onEndDateChange, onTimeFormatChange })
    fireEvent.click(screen.getByRole('button', { name: /date and time/i }))
    expect(await screen.findByRole('spinbutton', { name: 'Hour' })).toBeTruthy()
    expect(screen.getByRole('spinbutton', { name: 'Minute' })).toBeTruthy()
    fireEvent.click(screen.getByRole('switch', { name: 'End date' }))
    expect(onEndDateChange).toHaveBeenCalledWith(true, '2026-10-03T14:30:00.000Z')
    expect(screen.getByRole('switch', { name: '24 hours time format' })).toBeTruthy()
  })

  it('lets users type valid time values and rejects values outside the displayed range', async () => {
    const onChange = vi.fn()
    renderPicker('2026-10-03T14:30:00.000Z', true, { onChange })
    fireEvent.click(screen.getByRole('button', { name: /date and time/i }))
    const hour = await screen.findByRole('spinbutton', { name: 'Hour' })
    fireEvent.change(hour, { target: { value: '13' } })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(hour, { target: { value: '11' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('toggles AM and PM by changing the stored hour', async () => {
    const onChange = vi.fn()
    renderPicker('2026-10-03T14:30:00.000Z', true, { onChange })
    fireEvent.click(screen.getByRole('button', { name: /date and time/i }))
    expect(screen.getByRole('button', { name: 'Toggle AM or PM' }).textContent).toBe('PM')
    fireEvent.click(screen.getByRole('button', { name: 'Toggle AM or PM' }))
    expect(onChange).toHaveBeenLastCalledWith('2026-10-03T02:30:00.000Z', true)
  })

  it('hides time inputs when include time is off and shows the clear placeholder', async () => {
    renderPicker(null, false)
    expect(screen.getByText('@Select date & time')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /date and time/i }))
    expect(await screen.findByPlaceholderText('Select date & time')).toBeTruthy()
    expect(screen.queryByRole('spinbutton', { name: 'Hour' })).toBeNull()
    expect(screen.queryByRole('switch', { name: '24 hours time format' })).toBeNull()
  })

  it('shows the selected date format in the top date input', async () => {
    const { rerender } = renderPicker('2026-10-03', false, { dateFormat: 'full' })
    fireEvent.click(screen.getByRole('button', { name: /date and time/i }))
    expect((await screen.findByLabelText('Start date') as HTMLInputElement).value).toBe('October 3, 2026')
    rerender(<DateTimePicker {...defaults} value="2026-10-03" includeTime={false} dateFormat="month-day-year" />)
    expect((screen.getByLabelText('Start date') as HTMLInputElement).value).toBe('10/03/2026')
  })
})
