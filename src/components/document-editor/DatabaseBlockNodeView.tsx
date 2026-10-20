import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react'

import {
  addDatabaseFilter,
  addDatabaseOption,
  addDatabaseColumn,
  addDatabaseRow,
  clearDatabaseFilters,
  clearDatabaseSort,
  DATABASE_OPTION_COLORS,
  deleteDatabaseColumn,
  deleteDatabaseFilter,
  deleteDatabaseOption,
  deleteDatabaseRow,
  filterNeedsValue,
  filterOperatorsForType,
  getDatabaseVisibleRows,
  moveDatabaseColumn,
  moveDatabaseRow,
  normalizeDatabaseAttrs,
  renameDatabaseColumn,
  renameDatabaseOption,
  setDatabaseSort,
  updateDatabaseFilter,
  updateDatabaseOptionColor,
  updateDatabaseCell,
  type DatabaseAttrs,
  type DatabaseCellValue,
  type DatabaseColumn,
  type DatabaseColumnType,
  type DatabaseFilter,
  type DatabaseFilterOperator,
  type DatabaseOptionColor,
  type DatabaseRow,
  type DatabaseSortDirection,
} from './databaseModel'

function stopEditorKeyHandling(event: React.KeyboardEvent) {
  event.stopPropagation()
}

const optionColorClass: Record<DatabaseOptionColor, string> = {
  gray: 'bg-gray-400',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
}

function TextCommitInput({
  ariaLabel,
  className,
  inputMode,
  type = 'text',
  value,
  onCommit,
}: {
  ariaLabel: string
  className: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  type?: 'text' | 'number' | 'date'
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const skipNextBlurCommit = useRef(false)

  useEffect(() => setDraft(value), [value])

  const commit = () => onCommit(draft)
  const cancel = () => {
    skipNextBlurCommit.current = true
    setDraft(value)
  }

  return (
    <input
      aria-label={ariaLabel}
      inputMode={inputMode}
      type={type}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (skipNextBlurCommit.current) {
          skipNextBlurCommit.current = false
          return
        }
        commit()
      }}
      onKeyDown={(event) => {
        stopEditorKeyHandling(event)
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          cancel()
          event.currentTarget.blur()
        } else if (event.key === 'Tab') {
          commit()
        }
      }}
      className={className}
    />
  )
}

function TextCell({
  column,
  row,
  onCommit,
}: {
  column: DatabaseColumn
  row: DatabaseRow
  onCommit: (rowId: string, columnId: string, value: DatabaseCellValue) => void
}) {
  const rawValue = row.values[column.id]
  const value = typeof rawValue === 'string' ? rawValue : ''
  return (
    <TextCommitInput
      ariaLabel={`${column.name} value`}
      value={value}
      onCommit={(next) => onCommit(row.id, column.id, next)}
      className="h-9 w-full rounded-[6px] border border-transparent bg-transparent px-2 text-sm outline-none transition hover:border-[var(--app-border)] focus:border-[var(--accent)] focus:bg-[var(--app-surface)]"
    />
  )
}

function NumberCell({
  column,
  row,
  onCommit,
}: {
  column: DatabaseColumn
  row: DatabaseRow
  onCommit: (rowId: string, columnId: string, value: DatabaseCellValue) => void
}) {
  const rawValue = row.values[column.id]
  const value = typeof rawValue === 'number' ? String(rawValue) : ''
  return (
    <TextCommitInput
      ariaLabel={`${column.name} number`}
      inputMode="decimal"
      type="number"
      value={value}
      onCommit={(next) => {
        const trimmed = next.trim()
        if (!trimmed) onCommit(row.id, column.id, null)
        else {
          const parsed = Number(trimmed)
          onCommit(row.id, column.id, Number.isFinite(parsed) ? parsed : null)
        }
      }}
      className="h-9 w-full rounded-[6px] border border-transparent bg-transparent px-2 text-sm outline-none transition hover:border-[var(--app-border)] focus:border-[var(--accent)] focus:bg-[var(--app-surface)]"
    />
  )
}

function SelectCell({
  column,
  row,
  onCommit,
}: {
  column: DatabaseColumn
  row: DatabaseRow
  onCommit: (rowId: string, columnId: string, value: DatabaseCellValue) => void
}) {
  const options = column.options ?? []
  const rawValue = row.values[column.id]
  const value = typeof rawValue === 'string' ? rawValue : ''
  const selectedOption = options.find((option) => option.id === value)
  return (
    <div className="relative">
      {selectedOption ? <span className={`pointer-events-none absolute left-2 top-1/2 size-2.5 -translate-y-1/2 rounded-full ${optionColorClass[selectedOption.color]}`} aria-hidden="true" /> : null}
      <select
        aria-label={`${column.name} select`}
        value={options.some((option) => option.id === value) ? value : ''}
        onChange={(event) => onCommit(row.id, column.id, event.target.value || null)}
        onKeyDown={stopEditorKeyHandling}
        className={`h-9 w-full rounded-[6px] border border-[var(--app-border)] bg-[var(--app-surface)] py-0 pr-2 text-sm outline-none transition focus:border-[var(--accent)] ${selectedOption ? 'pl-6' : 'pl-2'}`}
      >
        <option value="">Empty</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}

function StatusCell({
  column,
  row,
  onCommit,
}: {
  column: DatabaseColumn
  row: DatabaseRow
  onCommit: (rowId: string, columnId: string, value: DatabaseCellValue) => void
}) {
  const options = column.options ?? []
  const rawValue = row.values[column.id]
  const value = typeof rawValue === 'string' ? rawValue : ''
  const selectedOption = options.find((option) => option.id === value)
  return (
    <div className="relative">
      {selectedOption ? <span className={`pointer-events-none absolute left-2 top-1/2 size-2.5 -translate-y-1/2 rounded-full ${optionColorClass[selectedOption.color]}`} aria-hidden="true" /> : null}
      <select
        aria-label={`${column.name} status`}
        value={options.some((option) => option.id === value) ? value : ''}
        onChange={(event) => onCommit(row.id, column.id, event.target.value || null)}
        onKeyDown={stopEditorKeyHandling}
        className={`h-9 w-full rounded-[6px] border border-[var(--app-border)] bg-[var(--app-surface)] py-0 pr-2 text-sm outline-none transition focus:border-[var(--accent)] ${selectedOption ? 'pl-6' : 'pl-2'}`}
      >
        <option value="">Empty</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}

function OptionSettings({
  column,
  onAddOption,
  onRenameOption,
  onUpdateOptionColor,
  onDeleteOption,
}: {
  column: DatabaseColumn
  onAddOption: (columnId: string) => void
  onRenameOption: (columnId: string, optionId: string, label: string) => void
  onUpdateOptionColor: (columnId: string, optionId: string, color: DatabaseOptionColor) => void
  onDeleteOption: (columnId: string, optionId: string) => void
}) {
  if (column.type !== 'select' && column.type !== 'status') return null
  const options = column.options ?? []

  return (
    <details className="mt-2 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)]" onKeyDown={stopEditorKeyHandling}>
      <summary className="cursor-pointer px-2 py-1 text-xs font-medium text-muted-foreground">Options</summary>
      <div className="space-y-1 border-t border-[var(--app-border)] p-2">
        {options.length ? options.map((option) => (
          <div key={option.id} className="flex items-center gap-1">
            <span className={`size-2.5 shrink-0 rounded-full ${optionColorClass[option.color]}`} aria-hidden="true" />
            <TextCommitInput
              ariaLabel={`${option.label} option name`}
              value={option.label}
              onCommit={(next) => onRenameOption(column.id, option.id, next)}
              className="h-8 min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-1.5 text-xs outline-none transition hover:border-[var(--app-border)] focus:border-[var(--accent)] focus:bg-[var(--app-surface)]"
            />
            <label className="sr-only" htmlFor={`${column.id}-${option.id}-color`}>Option color</label>
            <select
              id={`${column.id}-${option.id}-color`}
              aria-label={`${option.label} option color`}
              value={option.color}
              onChange={(event) => onUpdateOptionColor(column.id, option.id, event.target.value as DatabaseOptionColor)}
              onKeyDown={stopEditorKeyHandling}
              className="h-8 rounded-[6px] border border-[var(--app-border)] bg-[var(--app-surface)] px-1 text-xs outline-none focus:border-[var(--accent)]"
            >
              {DATABASE_OPTION_COLORS.map((color) => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`Delete ${option.label} option`}
              title="Delete option"
              onClick={() => onDeleteOption(column.id, option.id)}
              onKeyDown={stopEditorKeyHandling}
              className="flex size-8 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
            >
              ×
            </button>
          </div>
        )) : (
          <p className="px-1 py-1 text-xs text-muted-foreground">No options</p>
        )}
        <button
          type="button"
          onClick={() => onAddOption(column.id)}
          onKeyDown={stopEditorKeyHandling}
          className="h-8 rounded-[6px] px-2 text-xs font-medium text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          + Add option
        </button>
      </div>
    </details>
  )
}

function DateCell({
  column,
  row,
  onCommit,
}: {
  column: DatabaseColumn
  row: DatabaseRow
  onCommit: (rowId: string, columnId: string, value: DatabaseCellValue) => void
}) {
  const rawValue = row.values[column.id]
  const value = typeof rawValue === 'string' ? rawValue : ''
  return (
    <TextCommitInput
      ariaLabel={`${column.name} date`}
      type="date"
      value={value}
      onCommit={(next) => onCommit(row.id, column.id, next.trim() || null)}
      className="h-9 w-full rounded-[6px] border border-transparent bg-transparent px-2 text-sm outline-none transition hover:border-[var(--app-border)] focus:border-[var(--accent)] focus:bg-[var(--app-surface)]"
    />
  )
}

function CheckboxCell({
  column,
  row,
  onCommit,
}: {
  column: DatabaseColumn
  row: DatabaseRow
  onCommit: (rowId: string, columnId: string, value: DatabaseCellValue) => void
}) {
  return (
    <label className="flex h-9 items-center justify-center">
      <span className="sr-only">{column.name}</span>
      <input
        type="checkbox"
        checked={row.values[column.id] === true}
        onChange={(event) => onCommit(row.id, column.id, event.target.checked)}
        onKeyDown={stopEditorKeyHandling}
        className="size-4 accent-[var(--accent)]"
      />
    </label>
  )
}

function DatabaseCell({
  column,
  row,
  onCommit,
}: {
  column: DatabaseColumn
  row: DatabaseRow
  onCommit: (rowId: string, columnId: string, value: DatabaseCellValue) => void
}) {
  if (column.type === 'number') return <NumberCell column={column} row={row} onCommit={onCommit} />
  if (column.type === 'select') return <SelectCell column={column} row={row} onCommit={onCommit} />
  if (column.type === 'status') return <StatusCell column={column} row={row} onCommit={onCommit} />
  if (column.type === 'date') return <DateCell column={column} row={row} onCommit={onCommit} />
  if (column.type === 'checkbox') return <CheckboxCell column={column} row={row} onCommit={onCommit} />
  return <TextCell column={column} row={row} onCommit={onCommit} />
}

function propertyLabel(type: DatabaseColumnType) {
  if (type === 'number') return 'Number'
  if (type === 'select') return 'Select'
  if (type === 'status') return 'Status'
  if (type === 'date') return 'Date'
  if (type === 'checkbox') return 'Checkbox'
  return 'Text'
}

function columnWidthClass(type: DatabaseColumnType, isPrimary = false) {
  if (isPrimary) return 'min-w-[14rem] w-[18rem]'
  if (type === 'checkbox') return 'min-w-[6rem] w-24'
  if (type === 'number') return 'min-w-[9rem] w-36'
  if (type === 'date') return 'min-w-[10rem] w-40'
  return 'min-w-[11rem] w-48'
}

function operatorLabel(operator: DatabaseFilterOperator) {
  if (operator === 'doesNotContain') return 'does not contain'
  if (operator === 'isNot') return 'is not'
  if (operator === 'notEquals') return '≠'
  if (operator === 'greaterThan') return '>'
  if (operator === 'greaterThanOrEqual') return '≥'
  if (operator === 'lessThan') return '<'
  if (operator === 'lessThanOrEqual') return '≤'
  if (operator === 'isBefore') return 'is before'
  if (operator === 'isAfter') return 'is after'
  if (operator === 'isEmpty') return 'is empty'
  if (operator === 'isNotEmpty') return 'is not empty'
  if (operator === 'isChecked') return 'is checked'
  if (operator === 'isUnchecked') return 'is unchecked'
  if (operator === 'equals') return '='
  return operator
}

function coerceFilterInputValue(column: DatabaseColumn, value: string): DatabaseCellValue {
  if (column.type === 'number') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return value || null
}

function FilterValueControl({
  column,
  filter,
  onChange,
}: {
  column: DatabaseColumn
  filter: DatabaseFilter
  onChange: (value: DatabaseCellValue) => void
}) {
  if (!filterNeedsValue(filter.operator)) return null
  if (column.type === 'select' || column.type === 'status') {
    const value = typeof filter.value === 'string' ? filter.value : ''
    const selectedOption = column.options?.find((option) => option.id === value)
    return (
      <div className="relative min-w-0">
        {selectedOption ? <span className={`pointer-events-none absolute left-2 top-1/2 size-2.5 -translate-y-1/2 rounded-full ${optionColorClass[selectedOption.color]}`} aria-hidden="true" /> : null}
        <select
          aria-label={`${column.name} filter value`}
          value={column.options?.some((option) => option.id === value) ? value : ''}
          onChange={(event) => onChange(event.target.value || null)}
          onKeyDown={stopEditorKeyHandling}
          className={`h-9 w-full rounded-[6px] border border-[var(--app-border)] bg-[var(--app-surface)] py-0 pr-2 text-sm outline-none focus:border-[var(--accent)] ${selectedOption ? 'pl-6' : 'pl-2'}`}
        >
          <option value="">Empty</option>
          {column.options?.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>
    )
  }
  const type = column.type === 'date' ? 'date' : column.type === 'number' ? 'number' : 'text'
  const value = filter.value == null ? '' : String(filter.value)
  return (
    <input
      aria-label={`${column.name} filter value`}
      type={type}
      inputMode={column.type === 'number' ? 'decimal' : undefined}
      value={value}
      onChange={(event) => onChange(coerceFilterInputValue(column, event.target.value))}
      onKeyDown={stopEditorKeyHandling}
      className="h-9 min-w-0 flex-1 rounded-[6px] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-sm outline-none focus:border-[var(--accent)]"
    />
  )
}

function sortDirectionLabel(column: DatabaseColumn | undefined, direction: DatabaseSortDirection) {
  if (column?.type === 'number') return direction === 'asc' ? 'Smallest to largest' : 'Largest to smallest'
  if (column?.type === 'date') return direction === 'asc' ? 'Earliest to latest' : 'Latest to earliest'
  if (column?.type === 'checkbox') return direction === 'asc' ? 'Unchecked to checked' : 'Checked to unchecked'
  return direction === 'asc' ? 'A to Z' : 'Z to A'
}

function SortControls({
  database,
  onClearSort,
  onSetSort,
}: {
  database: DatabaseAttrs
  onClearSort: () => void
  onSetSort: (columnId: string, direction: DatabaseSortDirection) => void
}) {
  const sort = database.viewState?.sort
  const sortColumn = sort ? database.columns.find((column) => column.id === sort.columnId) : undefined
  return (
    <details className="relative" onKeyDown={stopEditorKeyHandling}>
      <summary className={`flex h-9 cursor-pointer list-none items-center rounded-[8px] border px-3 text-sm font-medium ${sort ? 'border-[var(--accent)] text-foreground' : 'border-[var(--app-border)] text-muted-foreground'} bg-[var(--app-surface)]`}>
        Sort
      </summary>
      <div className="fixed left-3 right-3 top-24 z-20 max-h-[min(70vh,calc(100dvh-var(--mybook-keyboard-offset,0px)-7rem))] overflow-auto rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(18rem,calc(100vw-2rem))]">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-muted-foreground" htmlFor={`${database.id}-sort-column`}>Property</label>
          <select
            id={`${database.id}-sort-column`}
            aria-label="Sort property"
            value={sort?.columnId ?? ''}
            onChange={(event) => {
              const columnId = event.target.value
              if (!columnId) onClearSort()
              else onSetSort(columnId, sort?.direction ?? 'asc')
            }}
            className="h-9 w-full rounded-[6px] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">No sort</option>
            {database.columns.map((column) => (
              <option key={column.id} value={column.id}>{column.name}</option>
            ))}
          </select>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor={`${database.id}-sort-direction`}>Direction</label>
          <select
            id={`${database.id}-sort-direction`}
            aria-label="Sort direction"
            value={sort?.direction ?? 'asc'}
            disabled={!sort}
            onChange={(event) => {
              if (!sort) return
              onSetSort(sort.columnId, event.target.value as DatabaseSortDirection)
            }}
            className="h-9 w-full rounded-[6px] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-50"
          >
            <option value="asc">{sortDirectionLabel(sortColumn, 'asc')}</option>
            <option value="desc">{sortDirectionLabel(sortColumn, 'desc')}</option>
          </select>
          {sort ? (
            <button
              type="button"
              onClick={onClearSort}
              className="h-8 rounded-[6px] px-2 text-xs font-medium text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground"
            >
              Remove sort
            </button>
          ) : null}
        </div>
      </div>
    </details>
  )
}

function SearchControls({
  query,
  onChange,
}: {
  query: string
  onChange: (query: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isActive = query.trim().length > 0

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  const clearSearch = () => {
    onChange('')
    setIsOpen(false)
  }

  if (!isOpen && !isActive) {
    return (
      <button
        type="button"
        aria-label="Search database"
        onClick={() => setIsOpen(true)}
        onKeyDown={stopEditorKeyHandling}
        className="h-9 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        Search
      </button>
    )
  }

  return (
    <div className="flex h-9 min-w-[12rem] max-w-full flex-1 items-center rounded-[8px] border border-[var(--accent)] bg-[var(--app-surface)] px-2 sm:flex-none sm:w-56">
      <input
        ref={inputRef}
        aria-label="Search database"
        value={query}
        placeholder="Search database..."
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          stopEditorKeyHandling(event)
          if (event.key === 'Escape') {
            event.preventDefault()
            clearSearch()
          } else if (event.key === 'Enter') {
            event.preventDefault()
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <button
        type="button"
        aria-label="Clear database search"
        title="Clear search"
        onClick={clearSearch}
        onKeyDown={stopEditorKeyHandling}
        className="ml-1 flex size-7 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground"
      >
        ×
      </button>
    </div>
  )
}

function FilterControls({
  database,
  onAddFilter,
  onDeleteFilter,
  onUpdateFilter,
}: {
  database: DatabaseAttrs
  onAddFilter: (columnId: string) => void
  onDeleteFilter: (filterId: string) => void
  onUpdateFilter: (filterId: string, patch: Partial<Omit<DatabaseFilter, 'id'>>) => void
}) {
  const filters = database.viewState?.filters ?? []
  const columnById = new Map(database.columns.map((column) => [column.id, column]))
  return (
    <details className="relative" onKeyDown={stopEditorKeyHandling}>
      <summary className={`flex h-9 cursor-pointer list-none items-center rounded-[8px] border px-3 text-sm font-medium ${filters.length ? 'border-[var(--accent)] text-foreground' : 'border-[var(--app-border)] text-muted-foreground'} bg-[var(--app-surface)]`}>
        Filter{filters.length ? ` ${filters.length}` : ''}
      </summary>
      <div className="fixed left-3 right-3 top-24 z-20 max-h-[min(70vh,calc(100dvh-var(--mybook-keyboard-offset,0px)-7rem))] overflow-auto rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(34rem,calc(100vw-2rem))]">
        <div className="space-y-2">
          {filters.length ? filters.map((filter) => {
            const column = columnById.get(filter.columnId) ?? database.columns[0]
            if (!column) return null
            return (
              <div key={filter.id} className="grid gap-2 rounded-[6px] border border-[var(--app-border)] p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                <select
                  aria-label="Filter property"
                  value={column.id}
                  onChange={(event) => onUpdateFilter(filter.id, { columnId: event.target.value })}
                  onKeyDown={stopEditorKeyHandling}
                  className="h-9 min-w-0 rounded-[6px] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  {database.columns.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter operator"
                  value={filter.operator}
                  onChange={(event) => onUpdateFilter(filter.id, { operator: event.target.value as DatabaseFilterOperator })}
                  onKeyDown={stopEditorKeyHandling}
                  className="h-9 min-w-0 rounded-[6px] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  {filterOperatorsForType(column.type).map((operator) => (
                    <option key={operator} value={operator}>{operatorLabel(operator)}</option>
                  ))}
                </select>
                <FilterValueControl
                  column={column}
                  filter={filter}
                  onChange={(value) => onUpdateFilter(filter.id, { value })}
                />
                <button
                  type="button"
                  aria-label="Remove filter"
                  title="Remove filter"
                  onClick={() => onDeleteFilter(filter.id)}
                  onKeyDown={stopEditorKeyHandling}
                  className="flex size-8 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            )
          }) : (
            <p className="text-xs text-muted-foreground">No filters</p>
          )}
          <button
            type="button"
            onClick={() => {
              const firstColumn = database.columns[0]
              if (firstColumn) onAddFilter(firstColumn.id)
            }}
            onKeyDown={stopEditorKeyHandling}
            className="h-9 rounded-[6px] px-2 text-sm font-medium text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground"
          >
            + Add filter
          </button>
        </div>
      </div>
    </details>
  )
}

function PropertyMenu({
  canMoveLeft,
  canMoveRight,
  column,
  isPrimary,
  onAddOption,
  onDeleteColumn,
  onDeleteOption,
  onMoveColumn,
  onRenameColumn,
  onRenameOption,
  onUpdateOptionColor,
}: {
  canMoveLeft: boolean
  canMoveRight: boolean
  column: DatabaseColumn
  isPrimary: boolean
  onAddOption: (columnId: string) => void
  onDeleteColumn: (columnId: string) => void
  onDeleteOption: (columnId: string, optionId: string) => void
  onMoveColumn: (columnId: string, direction: 'left' | 'right') => void
  onRenameColumn: (columnId: string, name: string) => void
  onRenameOption: (columnId: string, optionId: string, label: string) => void
  onUpdateOptionColor: (columnId: string, optionId: string, color: DatabaseOptionColor) => void
}) {
  return (
    <details className="relative shrink-0" onKeyDown={stopEditorKeyHandling}>
      <summary
        aria-label={`Open property menu for ${column.name}`}
        className="flex size-8 cursor-pointer list-none items-center justify-center rounded-[6px] text-muted-foreground transition hover:bg-[var(--app-surface)] hover:text-foreground"
      >
        ⋯
      </summary>
      <div className="fixed left-3 right-3 top-24 z-20 max-h-[min(70vh,calc(100dvh-var(--mybook-keyboard-offset,0px)-7rem))] overflow-auto rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(19rem,calc(100vw-2rem))]">
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Property name</div>
            <TextCommitInput
              ariaLabel={`${column.name} property name`}
              value={column.name}
              onCommit={(next) => onRenameColumn(column.id, next)}
              className="h-9 w-full rounded-[6px] border border-[var(--app-border)] bg-transparent px-2 text-sm font-semibold outline-none transition focus:border-[var(--accent)] focus:bg-[var(--app-surface)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <MoveButton ariaLabel={`Move ${column.name} column left`} disabled={isPrimary || !canMoveLeft} label="←" onClick={() => onMoveColumn(column.id, 'left')} />
            <MoveButton ariaLabel={`Move ${column.name} column right`} disabled={isPrimary || !canMoveRight} label="→" onClick={() => onMoveColumn(column.id, 'right')} />
            <span className="rounded-[6px] bg-[var(--app-subtle)] px-2 py-1 text-xs font-medium text-muted-foreground">{propertyLabel(column.type)}</span>
          </div>
          <OptionSettings
            column={column}
            onAddOption={onAddOption}
            onRenameOption={onRenameOption}
            onUpdateOptionColor={onUpdateOptionColor}
            onDeleteOption={onDeleteOption}
          />
          {!isPrimary ? (
            <button
              type="button"
              aria-label={`Delete ${column.name} property`}
              onClick={() => onDeleteColumn(column.id)}
              onKeyDown={stopEditorKeyHandling}
              className="h-9 w-full rounded-[6px] px-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              Delete property
            </button>
          ) : null}
        </div>
      </div>
    </details>
  )
}

function MoveButton({
  ariaLabel,
  disabled,
  label,
  onClick,
}: {
  ariaLabel: string
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={stopEditorKeyHandling}
      className="inline-flex size-7 items-center justify-center rounded-[6px] text-xs font-semibold text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
    >
      {label}
    </button>
  )
}

export function DatabaseBlockNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const database = useMemo(() => normalizeDatabaseAttrs(node.attrs), [node.attrs])
  const [searchQuery, setSearchQuery] = useState('')
  const activeSearchQuery = searchQuery.trim()
  const visibleRows = useMemo(() => getDatabaseVisibleRows(database, searchQuery), [database, searchQuery])
  const hasSearch = activeSearchQuery.length > 0
  const hasViewTransform = Boolean(database.viewState?.sort || database.viewState?.filters?.length || hasSearch)

  const commitDatabase = (next: DatabaseAttrs) => updateAttributes(normalizeDatabaseAttrs(next))
  const updateTitle = (title: string) => commitDatabase({ ...database, title })
  const addColumn = (type: DatabaseColumnType) => commitDatabase(addDatabaseColumn(database, type))
  const renameColumn = (columnId: string, name: string) => commitDatabase(renameDatabaseColumn(database, columnId, name))
  const deleteColumn = (columnId: string) => commitDatabase(deleteDatabaseColumn(database, columnId))
  const addOption = (columnId: string) => commitDatabase(addDatabaseOption(database, columnId))
  const renameOption = (columnId: string, optionId: string, label: string) => commitDatabase(renameDatabaseOption(database, columnId, optionId, label))
  const updateOptionColor = (columnId: string, optionId: string, color: DatabaseOptionColor) => commitDatabase(updateDatabaseOptionColor(database, columnId, optionId, color))
  const deleteOption = (columnId: string, optionId: string) => commitDatabase(deleteDatabaseOption(database, columnId, optionId))
  const addRow = () => commitDatabase(addDatabaseRow(database))
  const deleteRow = (rowId: string) => commitDatabase(deleteDatabaseRow(database, rowId))
  const moveRow = (rowId: string, direction: 'up' | 'down') => commitDatabase(moveDatabaseRow(database, rowId, direction))
  const moveColumn = (columnId: string, direction: 'left' | 'right') => commitDatabase(moveDatabaseColumn(database, columnId, direction))
  const updateCell = (rowId: string, columnId: string, value: DatabaseCellValue) => commitDatabase(updateDatabaseCell(database, rowId, columnId, value))
  const setSort = (columnId: string, direction: DatabaseSortDirection) => commitDatabase(setDatabaseSort(database, columnId, direction))
  const clearSort = () => commitDatabase(clearDatabaseSort(database))
  const clearFilters = () => commitDatabase(clearDatabaseFilters(database))
  const addFilter = (columnId: string) => commitDatabase(addDatabaseFilter(database, columnId))
  const updateFilter = (filterId: string, patch: Partial<Omit<DatabaseFilter, 'id'>>) => commitDatabase(updateDatabaseFilter(database, filterId, patch))
  const deleteFilter = (filterId: string) => commitDatabase(deleteDatabaseFilter(database, filterId))

  return (
    <NodeViewWrapper
      as="section"
      data-drag-handle
      className={`mybook-database-block my-5 min-w-0 max-w-full overflow-hidden rounded-[8px] border bg-[var(--app-surface)] shadow-sm [contain:layout_paint] ${selected ? 'border-[var(--accent)] ring-2 ring-[var(--focus-ring)]' : 'border-[var(--app-border)]'}`}
      contentEditable={false}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--app-border)] px-3 py-2">
        <div className="min-w-[12rem] flex-1">
          <TextCommitInput
            ariaLabel="Database title"
            value={database.title}
            onCommit={updateTitle}
            className="h-10 w-full rounded-[6px] border border-transparent bg-transparent px-2 text-base font-semibold outline-none transition hover:border-[var(--app-border)] focus:border-[var(--accent)] focus:bg-[var(--app-surface)]"
          />
        </div>
        <button
          type="button"
          aria-label="Add row"
          onClick={addRow}
          onKeyDown={stopEditorKeyHandling}
          className="h-9 rounded-[8px] bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent-foreground)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          + New
        </button>
        <FilterControls
          database={database}
          onAddFilter={addFilter}
          onDeleteFilter={deleteFilter}
          onUpdateFilter={updateFilter}
        />
        <SortControls database={database} onClearSort={clearSort} onSetSort={setSort} />
        <SearchControls query={searchQuery} onChange={setSearchQuery} />
        <label className="sr-only" htmlFor={`${database.id}-add-property`}>Add property</label>
        <select
          id={`${database.id}-add-property`}
          aria-label="Add property"
          value=""
          onChange={(event) => {
            if (!event.target.value) return
            addColumn(event.target.value as DatabaseColumnType)
            event.target.value = ''
          }}
          onKeyDown={stopEditorKeyHandling}
          className="h-9 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-sm font-medium text-muted-foreground outline-none focus:border-[var(--accent)]"
        >
          <option value="">+ Property</option>
          {(['text', 'number', 'select', 'status', 'date', 'checkbox'] as const).map((type) => (
            <option key={type} value={type}>{propertyLabel(type)}</option>
          ))}
        </select>
      </div>

      <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain [contain:layout_paint]">
        <table className="w-max min-w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--app-subtle)]">
              {database.columns.map((column, index) => {
                const isPrimary = index === 0
                return (
                  <th key={column.id} className={`${columnWidthClass(column.type, isPrimary)} border-b border-r border-[var(--app-border)] p-2 text-left align-middle last:border-r-0`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold" title={column.name}>{column.name}</div>
                        <div className="text-[11px] font-medium text-muted-foreground">{propertyLabel(column.type)}</div>
                      </div>
                      <PropertyMenu
                        canMoveLeft={index > 1}
                        canMoveRight={index < database.columns.length - 1}
                        column={column}
                        isPrimary={isPrimary}
                        onAddOption={addOption}
                        onDeleteColumn={deleteColumn}
                        onDeleteOption={deleteOption}
                        onMoveColumn={moveColumn}
                        onRenameColumn={renameColumn}
                        onRenameOption={renameOption}
                        onUpdateOptionColor={updateOptionColor}
                      />
                    </div>
                  </th>
                )
              })}
              <th className="w-12 border-b border-[var(--app-border)] p-2" aria-label="Row actions" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={row.id} className="border-b border-[var(--app-border)] last:border-b-0">
                {database.columns.map((column) => (
                  <td key={column.id} className={`${columnWidthClass(column.type, database.columns[0]?.id === column.id)} border-r border-[var(--app-border)] p-1.5 align-middle last:border-r-0`}>
                    <DatabaseCell column={column} row={row} onCommit={updateCell} />
                  </td>
                ))}
                <td className="w-12 p-1.5 text-center align-middle">
                  <details className="relative" onKeyDown={stopEditorKeyHandling}>
                    <summary
                      aria-label="Open row actions"
                      className="inline-flex size-9 cursor-pointer list-none items-center justify-center rounded-[6px] text-muted-foreground transition hover:bg-[var(--app-subtle)] hover:text-foreground"
                    >
                      ⋯
                    </summary>
                    <div className="fixed left-3 right-3 top-24 z-20 max-h-[min(70vh,calc(100dvh-var(--mybook-keyboard-offset,0px)-7rem))] overflow-auto rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:w-44">
                      <button
                        type="button"
                        aria-label="Move row up"
                        disabled={hasViewTransform || rowIndex === 0}
                        onClick={() => moveRow(row.id, 'up')}
                        className="block h-9 w-full rounded-[6px] px-2 text-left text-sm text-foreground hover:bg-[var(--app-subtle)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        aria-label="Move row down"
                        disabled={hasViewTransform || rowIndex >= visibleRows.length - 1}
                        onClick={() => moveRow(row.id, 'down')}
                        className="block h-9 w-full rounded-[6px] px-2 text-left text-sm text-foreground hover:bg-[var(--app-subtle)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        aria-label="Delete row"
                        onClick={() => deleteRow(row.id)}
                        className="block h-9 w-full rounded-[6px] px-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete row
                      </button>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
            {database.rows.length > 0 && visibleRows.length === 0 ? (
              <tr>
                <td colSpan={database.columns.length + 1} className="p-4 text-center text-sm text-muted-foreground">
                  {hasSearch ? `No rows match "${activeSearchQuery}".` : 'No rows match these filters.'}
                  {hasSearch ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      onKeyDown={stopEditorKeyHandling}
                      className="ml-2 rounded-[6px] px-2 py-1 text-xs font-medium text-foreground hover:bg-[var(--app-subtle)]"
                    >
                      Clear search
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        clearFilters()
                      }}
                      onKeyDown={stopEditorKeyHandling}
                      className="ml-2 rounded-[6px] px-2 py-1 text-xs font-medium text-foreground hover:bg-[var(--app-subtle)]"
                    >
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {database.rows.length === 0 ? (
        <div className="border-t border-[var(--app-border)] px-3 py-3 text-sm text-muted-foreground">
          No rows yet.
          <button
            type="button"
            onClick={addRow}
            onKeyDown={stopEditorKeyHandling}
            className="ml-2 rounded-[6px] px-2 py-1 text-sm font-medium text-foreground hover:bg-[var(--app-subtle)]"
          >
            + Add row
          </button>
        </div>
      ) : null}
    </NodeViewWrapper>
  )
}
