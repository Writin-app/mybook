import {
  AlignLeftIcon,
  CheckmarkSquare01Icon,
  Copy01Icon,
  Delete02Icon,
  EraserIcon,
  InsertBottomImageIcon,
  InsertColumnLeftIcon,
  InsertColumnRightIcon,
  InsertPiIcon,
  PlusSignIcon,
  TextAlignJustifyIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'
import { CellSelection, deleteCellSelection, findTable, moveTableColumn, moveTableRow, selectedRect, TableMap } from 'prosemirror-tables'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type SVGProps } from 'react'

import { getTableInteractionState, setTableInteraction } from './extensions/TableInteraction'
import { tableColors } from './extensions/TableCellStyles'
import { resetHeaderCellBackgrounds } from './tableHeaderBackground'
import { activeCellCoordinates, isColumnGripInBounds, isRowGripInBounds, tableElementsFromNodeDom } from './tableDom'
import { rowGripMenuTop, tableMenuTop } from './tableMenuPosition'
import { useDeviceMode } from '../../hooks/useDeviceMode'
import { Button } from '../ui/button'

type Axis = 'row' | 'column'

interface TableGeometry {
  wrapper: HTMLElement
  table: HTMLTableElement
  tablePos: number
  tableStart: number
  map: TableMap
  rows: DOMRect[]
  columns: DOMRect[]
  tableRect: DOMRect
}

interface SelectionState {
  axis: Axis
  index: number
  tablePos: number
  rect: DOMRect
}

interface DragState {
  axis: Axis
  from: number
  tablePos: number
  rect: DOMRect
  startX: number
  startY: number
  isDragging: boolean
  dropIndex: number | null
  pointerX: number
  pointerY: number
}

interface TableResizeState {
  startX: number
  startWidth: number
  width: number
  minWidth: number
  maxWidth: number
}

interface HoverState {
  rowIndex: number | null
  columnIndex: number | null
}

interface TableInteractionState {
  selection: SelectionState | null
  menuOpen: boolean
  drag: DragState | null
}

const tableAlignments = ['left', 'center', 'right'] as const

const menuGroups = {
  row: [
    ['Insert above', InsertPiIcon],
    ['Insert below', InsertBottomImageIcon],
    ['Header row', CheckmarkSquare01Icon],
    ['Fixed visible rows', CheckmarkSquare01Icon],
    ['separator'],
    ['Color', AlignLeftIcon],
    ['Align', TextAlignJustifyIcon],
    ['separator'],
    ['Duplicate', Copy01Icon],
    ['Clear contents', EraserIcon],
    ['Delete', Delete02Icon],
  ],
  column: [
    ['Insert left', InsertColumnLeftIcon],
    ['Insert right', InsertColumnRightIcon],
    ['separator'],
    ['Color', AlignLeftIcon],
    ['Align', TextAlignJustifyIcon],
    ['separator'],
    ['Duplicate', Copy01Icon],
    ['Clear contents', EraserIcon],
    ['Delete', Delete02Icon],
  ],
} as const

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

function cellPosFor(table: TableGeometry, row: number, column: number) {
  return table.tableStart + (table.map.map[row * table.map.width + column] ?? 0)
}

function selectRow(editor: Editor, table: TableGeometry, row: number) {
  const anchor = editor.state.doc.resolve(cellPosFor(table, row, 0))
  const head = editor.state.doc.resolve(cellPosFor(table, row, table.map.width - 1))
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.rowSelection(anchor, head)))
}

function selectColumn(editor: Editor, table: TableGeometry, column: number) {
  const anchor = editor.state.doc.resolve(cellPosFor(table, 0, column))
  const head = editor.state.doc.resolve(cellPosFor(table, table.map.height - 1, column))
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.colSelection(anchor, head)))
}

function geometryFromEditor(editor: Editor): TableGeometry | null {
  const tableResult = findTable(editor.state.selection.$from)
  if (!tableResult) return null
  return geometryFromTable(editor, tableResult.pos, tableResult.start, tableResult.node)
}

function tableGeometriesFromEditor(editor: Editor): TableGeometry[] {
  const geometries: TableGeometry[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return
    const geometry = geometryFromTable(editor, pos, pos + 1, node)
    if (geometry) geometries.push(geometry)
  })
  return geometries
}

function geometryFromPointer(editor: Editor, event: PointerEvent) {
  const x = event.clientX
  const y = event.clientY
  return tableGeometriesFromEditor(editor).find((table) => (
    x >= table.tableRect.left - 32 &&
    x <= table.tableRect.right + 52 &&
    y >= table.tableRect.top - 32 &&
    y <= table.tableRect.bottom + 52
  )) ?? null
}

function geometryFromTable(editor: Editor, tablePos: number, tableStart: number, tableNode: ProseMirrorNode): TableGeometry | null {
  const nodeDom = editor.view.nodeDOM(tablePos)
  const elements = tableElementsFromNodeDom(nodeDom)
  if (!elements) return null
  const { wrapper, table } = elements
  const rows = Array.from(table.querySelectorAll('tr'))
  if (!rows.length) return null
  const firstRowCells = Array.from(rows[0]!.children).filter((child): child is HTMLElement => child instanceof HTMLElement)
  const tableRect = table.getBoundingClientRect()
  return {
    wrapper,
    table,
    tablePos,
    tableStart,
    map: TableMap.get(tableNode),
    rows: rows.map((row) => row.getBoundingClientRect()),
    columns: firstRowCells.map((cell) => cell.getBoundingClientRect()),
    tableRect,
  }
}

function syncFixedRowsViewport(editor: Editor, geometry: TableGeometry | null) {
  if (!geometry) return
  const wrapper = geometry.wrapper
  const tableNode = editor.state.doc.nodeAt(geometry.tablePos)
  const isFixed = wrapper.dataset.fixedRows === 'true' || tableNode?.attrs.fixedRowsEnabled === true
  if (!isFixed) {
    wrapper.style.removeProperty('max-height')
    return
  }
  const rowCount = Math.max(1, Number(wrapper.dataset.fixedRowCount) || Number(tableNode?.attrs.fixedRowCount) || 5)
  const visibleHeight = geometry.rows.slice(0, rowCount).reduce((total, row) => total + row.height, 0)
  wrapper.style.maxHeight = `${Math.ceil(visibleHeight) + 2}px`
}

function selectionFromEditor(editor: Editor, geometry: TableGeometry | null): SelectionState | null {
  if (!geometry) return null
  const selection = editor.state.selection
  if (!(selection instanceof CellSelection)) return null
  const rect = selectedRect(editor.state)
  if (rect.left === 0 && rect.right === geometry.map.width && rect.top < rect.bottom) {
    const row = clamp(rect.top, 0, geometry.rows.length - 1)
    return { axis: 'row', index: row, tablePos: geometry.tablePos, rect: geometry.rows[row]! }
  }
  if (rect.top === 0 && rect.bottom === geometry.map.height && rect.left < rect.right) {
    const column = clamp(rect.left, 0, geometry.columns.length - 1)
    return { axis: 'column', index: column, tablePos: geometry.tablePos, rect: geometry.columns[column]! }
  }
  return null
}

function duplicateRow(editor: Editor, geometry: TableGeometry, row: number) {
  const rowNode = geometry.table.querySelectorAll('tr')[row]
  if (!rowNode) return
  let rowPos = geometry.tableStart
  for (let index = 0; index <= row; index += 1) {
    const node = geometry.table.ownerDocument ? editor.state.doc.nodeAt(rowPos) : null
    if (!node) return
    if (index === row) {
      editor.view.dispatch(editor.state.tr.insert(rowPos + node.nodeSize, node.copy(node.content)).scrollIntoView())
      return
    }
    rowPos += node.nodeSize
  }
}

function isHeaderRow(geometry: TableGeometry, row: number) {
  const domRow = geometry.table.querySelectorAll('tr')[row]
  if (!domRow) return false
  const cells = Array.from(domRow.children)
  return cells.length > 0 && cells.every((cell) => cell.tagName.toLowerCase() === 'th')
}

function isFixedRowsEnabled(editor: Editor, geometry: TableGeometry) {
  return editor.state.doc.nodeAt(geometry.tablePos)?.attrs.fixedRowsEnabled === true
}

function fixedRowsCount(editor: Editor, geometry: TableGeometry) {
  return Number(editor.state.doc.nodeAt(geometry.tablePos)?.attrs.fixedRowCount) || 5
}

function updateFixedRowsCount(editor: Editor, geometry: TableGeometry, value: string) {
  const count = Math.max(1, Math.min(100, Number.parseInt(value, 10) || 1))
  const tableNode = editor.state.doc.nodeAt(geometry.tablePos)
  if (!tableNode) return
  editor.view.dispatch(editor.state.tr.setNodeMarkup(geometry.tablePos, undefined, {
    ...tableNode.attrs,
    fixedRowsEnabled: true,
    fixedRowCount: count,
  }))
}

function updateTableWidth(editor: Editor, geometry: TableGeometry, width: number) {
  const tableNode = editor.state.doc.nodeAt(geometry.tablePos)
  if (!tableNode) return
  editor.view.dispatch(editor.state.tr.setNodeMarkup(geometry.tablePos, undefined, {
    ...tableNode.attrs,
    tableWidth: Math.round(width),
  }))
}

function applyCellAttribute(editor: Editor, geometry: TableGeometry, selection: SelectionState, attribute: string, value: string | null) {
  const transaction = editor.state.tr
  const cells = selection.axis === 'row'
    ? Array.from({ length: geometry.map.width }, (_, column) => cellPosFor(geometry, selection.index, column))
    : Array.from({ length: geometry.map.height }, (_, row) => cellPosFor(geometry, row, selection.index))
  cells.forEach((position) => {
    const cell = editor.state.doc.nodeAt(position)
    if (cell) transaction.setNodeMarkup(position, undefined, { ...cell.attrs, [attribute]: value })
  })
  editor.view.dispatch(transaction)
}

function restoreEditorScroll(editor: Editor, top: number, left: number) {
  const scroller = editor.view.dom.closest('main')
  if (!(scroller instanceof HTMLElement)) return
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      scroller.scrollTop = top
      scroller.scrollLeft = left
    })
  })
}

function clearTableSelectionToCell(editor: Editor, cellPos: number) {
  const max = editor.state.doc.content.size
  const targetPos = Math.min(Math.max(0, cellPos + 1), max)
  const resolved = editor.state.doc.resolve(targetPos)
  const selection = TextSelection.findFrom(resolved, 1) || TextSelection.create(editor.state.doc, targetPos)
  editor.view.dispatch(editor.state.tr.setSelection(selection))
  editor.view.focus()
}

function runMenuAction(editor: Editor, geometry: TableGeometry, selection: SelectionState, label: string) {
  const scroller = editor.view.dom.closest('main')
  const scrollTop = scroller instanceof HTMLElement ? scroller.scrollTop : 0
  const scrollLeft = scroller instanceof HTMLElement ? scroller.scrollLeft : 0
  if (selection.axis === 'row') selectRow(editor, geometry, selection.index)
  else selectColumn(editor, geometry, selection.index)

  const chain = editor.chain().focus()
  if (label === 'Insert above') {
    chain.addRowBefore().run()
    const nextGeometry = geometryFromEditor(editor)
    if (nextGeometry) {
      clearTableSelectionToCell(editor, cellPosFor(nextGeometry, selection.index, 0))
    }
  }
  else if (label === 'Insert below') {
    chain.addRowAfter().run()
    const nextGeometry = geometryFromEditor(editor)
    if (nextGeometry) {
      clearTableSelectionToCell(editor, cellPosFor(nextGeometry, selection.index + 1, 0))
    }
  }
  else if (label === 'Insert left') {
    chain.addColumnBefore().run()
    const nextGeometry = geometryFromEditor(editor)
    if (nextGeometry) {
      clearTableSelectionToCell(editor, cellPosFor(nextGeometry, 0, selection.index))
    }
  }
  else if (label === 'Insert right') {
    chain.addColumnAfter().run()
    const nextGeometry = geometryFromEditor(editor)
    if (nextGeometry) {
      clearTableSelectionToCell(editor, cellPosFor(nextGeometry, 0, selection.index + 1))
    }
  }
  else if (label === 'Header row') {
    const enablingHeader = !isHeaderRow(geometry, selection.index)
    chain.toggleHeaderRow().run()
    if (enablingHeader) {
      resetHeaderCellBackgrounds(editor, Array.from(
        { length: geometry.map.width },
        (_, column) => cellPosFor(geometry, selection.index, column),
      ))
    }
  }
  else if (label === 'Fixed visible rows') {
    const tableNode = editor.state.doc.nodeAt(geometry.tablePos)
    if (!tableNode) {
      restoreEditorScroll(editor, scrollTop, scrollLeft)
      return
    }
    editor.view.dispatch(editor.state.tr.setNodeMarkup(geometry.tablePos, undefined, {
      ...tableNode.attrs,
      fixedRowsEnabled: tableNode.attrs.fixedRowsEnabled !== true,
      fixedRowCount: 5,
    }).scrollIntoView())
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const currentGeometry = geometryFromEditor(editor) ?? tableGeometriesFromEditor(editor)[0] ?? null
        syncFixedRowsViewport(editor, currentGeometry)
      })
    })
  }
  else if (label === 'Delete') {
    if (selection.axis === 'row') chain.deleteRow().run()
    else chain.deleteColumn().run()
  } else if (label === 'Clear contents') {
    deleteCellSelection(editor.state, (transaction) => editor.view.dispatch(transaction.scrollIntoView()))
    editor.view.focus()
  } else if (label === 'Duplicate') {
    if (selection.axis === 'row') duplicateRow(editor, geometry, selection.index)
    else chain.addColumnAfter().run()
  }
  restoreEditorScroll(editor, scrollTop, scrollLeft)
}

function GripVerticalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path d="M7 5.5h.01M7 10h.01M7 14.5h.01M13 5.5h.01M13 10h.01M13 14.5h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function GripHorizontalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path d="M5.5 7h.01M10 7h.01M14.5 7h.01M5.5 13h.01M10 13h.01M14.5 13h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function GripMenuContent({
  editor,
  geometry,
  selection,
  onClose,
}: {
  editor: Editor
  geometry: TableGeometry
  selection: SelectionState
  onClose: () => void
}) {
  const items = menuGroups[selection.axis]
  const [openSubmenu, setOpenSubmenu] = useState<'color' | 'align' | null>(null)
  const selectedColor = editor.state.doc.nodeAt(cellPosFor(geometry, selection.axis === 'row' ? selection.index : 0, selection.axis === 'column' ? selection.index : 0))?.attrs.backgroundColor || '#ffffff'
  const selectedAlignment = editor.state.doc.nodeAt(cellPosFor(geometry, selection.axis === 'row' ? selection.index : 0, selection.axis === 'column' ? selection.index : 0))?.attrs.align || 'left'

  return (
    <>
      {items.map((item, index) => {
        if (item[0] === 'separator') return <div key={`separator-${index}`} className="my-1 h-px bg-[var(--app-border)]" role="separator" />
        const [label, icon] = item
        const isPassive = false
        if (label === 'Header row') {
          const isActive = selection.axis === 'row' && isHeaderRow(geometry, selection.index)
          return (
            <button
              key={label}
              type="button"
              role="menuitemcheckbox"
              aria-pressed={isActive}
              onClick={() => {
                runMenuAction(editor, geometry, selection, label)
                onClose()
              }}
              className="flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm hover:bg-[var(--app-subtle)]"
            >
              <span className="flex items-center gap-2"><HugeiconsIcon icon={icon} aria-hidden="true" strokeWidth={1.8} className="size-4 shrink-0" /><span>{label}</span></span>
              <span aria-hidden="true" className={`relative h-5 w-9 rounded-full transition ${isActive ? 'bg-primary' : 'bg-muted'} after:absolute after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition ${isActive ? 'after:left-4' : 'after:left-0.5'}`} />
            </button>
          )
        }
        if (label === 'Fixed visible rows') {
          const isActive = isFixedRowsEnabled(editor, geometry)
          const count = fixedRowsCount(editor, geometry)
          return (
            <div key={label}>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-pressed={isActive}
                onClick={() => runMenuAction(editor, geometry, selection, label)}
                className="flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm hover:bg-[var(--app-subtle)]"
              >
                <span className="flex items-center gap-2"><HugeiconsIcon icon={icon} aria-hidden="true" strokeWidth={1.8} className="size-4 shrink-0" /><span>{label}</span></span>
                <span aria-hidden="true" className={`relative h-5 w-9 rounded-full transition ${isActive ? 'bg-primary' : 'bg-muted'} after:absolute after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition ${isActive ? 'after:left-4' : 'after:left-0.5'}`} />
              </button>
              {isActive ? (
                <label className="flex items-center justify-between gap-3 px-3 pb-2 pt-1 text-xs text-muted-foreground">
                  <span>Visible rows</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={count}
                    aria-label="Visible row count"
                    onChange={(event) => updateFixedRowsCount(editor, geometry, event.target.value)}
                    className="h-7 w-16 rounded-md border border-[var(--app-border)] bg-background px-2 text-right text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              ) : null}
            </div>
          )
        }
        if (label === 'Color' || label === 'Align') {
          const submenu = label === 'Color' ? 'color' : 'align'
          return (
            <div key={label} className="relative">
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={openSubmenu === submenu}
                onClick={() => setOpenSubmenu((current) => current === submenu ? null : submenu)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setOpenSubmenu(submenu)
                  }
                }}
                className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm hover:bg-[var(--app-subtle)]"
              >
                <span className="flex items-center gap-2"><HugeiconsIcon icon={icon} aria-hidden="true" strokeWidth={1.8} className="size-4 shrink-0" /><span>{label}</span></span>
                <span aria-hidden="true">›</span>
              </button>
              {openSubmenu === submenu ? (
                <div role="menu" aria-label={label === 'Color' ? 'Background color' : 'Align'} className="my-1 rounded-lg border border-[var(--app-border)] bg-popover p-1 shadow-lg sm:absolute sm:left-full sm:top-0 sm:z-50 sm:ml-1 sm:min-w-44">
                  {label === 'Color' ? tableColors.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selectedColor === color.value}
                      onClick={() => { applyCellAttribute(editor, geometry, selection, 'backgroundColor', color.value); setOpenSubmenu(null) }}
                      className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-[var(--app-subtle)] sm:min-h-8"
                    >
                      <span aria-hidden="true" className="size-4 rounded border border-[var(--app-border)]" style={{ backgroundColor: color.value }} />
                      <span>{color.name}</span>
                      {selectedColor === color.value ? <span className="ml-auto text-primary">✓</span> : null}
                    </button>
                  )) : tableAlignments.map((alignment) => (
                    <button
                      key={alignment}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selectedAlignment === alignment}
                      onClick={() => { applyCellAttribute(editor, geometry, selection, 'align', alignment); setOpenSubmenu(null) }}
                      className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm capitalize hover:bg-[var(--app-subtle)] sm:min-h-8"
                    >
                      <span>{alignment}</span>
                      {selectedAlignment === alignment ? <span className="ml-auto text-primary">✓</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        }
        return (
          <button
            key={label}
            type="button"
            role="menuitem"
            disabled={isPassive}
            onClick={() => {
              if (isPassive) return
              runMenuAction(editor, geometry, selection, label)
              onClose()
            }}
            className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm ${label === 'Delete' ? 'text-red-600 hover:bg-red-50' : 'hover:bg-[var(--app-subtle)]'} ${isPassive ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <HugeiconsIcon icon={icon} aria-hidden="true" strokeWidth={1.8} className="size-4 shrink-0" />
            <span>{label}</span>
          </button>
        )
      })}
    </>
  )
}

export function TableActionsMenu({ editor }: { editor: Editor }) {
  const { isTouch } = useDeviceMode()
  const [geometry, setGeometry] = useState<TableGeometry | null>(null)
  const [interaction, setInteraction] = useState<TableInteractionState>({ selection: null, menuOpen: false, drag: null })
  const [hoverState, setHoverState] = useState<HoverState>({ rowIndex: null, columnIndex: null })
  const [isTableHovering, setIsTableHovering] = useState(false)
  const [tableResize, setTableResize] = useState<TableResizeState | null>(null)
  const columnMenuRef = useRef<HTMLDivElement>(null)
  const rowMenuRef = useRef<HTMLDivElement>(null)
  const [columnMenuTop, setColumnMenuTop] = useState<number | null>(null)
  const [rowMenuTop, setRowMenuTop] = useState<number | null>(null)

  useEffect(() => {
    let firstFrame = 0
    let secondFrame = 0
    let thirdFrame = 0
    const update = () => {
      const nextGeometry = geometryFromEditor(editor) ?? tableGeometriesFromEditor(editor)[0] ?? null
      setGeometry(nextGeometry)
      const nextSelection = selectionFromEditor(editor, nextGeometry)
      setInteraction((current) => current.menuOpen ? current : { ...current, selection: nextSelection })
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          thirdFrame = window.requestAnimationFrame(() => {
            const measuredGeometry = geometryFromEditor(editor) ?? tableGeometriesFromEditor(editor)[0] ?? null
            syncFixedRowsViewport(editor, measuredGeometry)
            setGeometry(measuredGeometry)
          })
        })
      })
    }
    update()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    editor.on('focus', update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
      editor.off('focus', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
      window.cancelAnimationFrame(thirdFrame)
    }
  }, [editor, interaction.menuOpen])

  useEffect(() => {
    if (!geometry) return
    const wrapper = geometry.wrapper
    syncFixedRowsViewport(editor, geometry)
    const observer = new MutationObserver(() => {
      if (wrapper.dataset.fixedRows === 'true' && !wrapper.style.maxHeight) syncFixedRowsViewport(editor, geometry)
      else if (wrapper.dataset.fixedRows !== 'true' && wrapper.style.maxHeight) syncFixedRowsViewport(editor, geometry)
    })
    observer.observe(wrapper, { attributes: true, attributeFilter: ['data-fixed-rows', 'data-fixed-row-count', 'style'] })
    return () => observer.disconnect()
  }, [editor, geometry])

  useEffect(() => {
    const nextMeta = {
      selection: interaction.selection ? { axis: interaction.selection.axis, index: interaction.selection.index, tablePos: interaction.selection.tablePos } : null,
      drag: interaction.drag ? { axis: interaction.drag.axis, from: interaction.drag.from, isDragging: interaction.drag.isDragging, tablePos: interaction.drag.tablePos } : null,
    }
    const currentMeta = getTableInteractionState(editor.state)
    if (JSON.stringify(currentMeta) !== JSON.stringify(nextMeta)) {
      editor.view.dispatch(setTableInteraction(editor.state, nextMeta))
    }
  }, [editor, interaction])

  useEffect(() => {
    if (!interaction.menuOpen) return
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (target instanceof Element && target.closest('.mybook-table-row-grip, .mybook-table-column-grip, .mybook-table-manual-menu')) return
      setInteraction({ selection: null, menuOpen: false, drag: null })
    }
    document.addEventListener('pointerdown', closeOnOutsidePointerDown, true)
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setInteraction({ selection: null, menuOpen: false, drag: null })
    }
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [interaction.menuOpen])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const pointerGeometry = geometryFromPointer(editor, event)
      const nextGeometry = pointerGeometry ?? geometry
      if (!nextGeometry) {
        if (!interaction.menuOpen && !interaction.drag?.isDragging) {
          setIsTableHovering(false)
          setHoverState({ rowIndex: null, columnIndex: null })
        }
        return
      }
      if (pointerGeometry && pointerGeometry.tablePos !== geometry?.tablePos && !interaction.menuOpen && !interaction.drag?.isDragging) {
        setGeometry(pointerGeometry)
        setInteraction((current) => ({ ...current, selection: null }))
      }

      const x = event.clientX
      const y = event.clientY
      const tableHovering = x >= nextGeometry.tableRect.left - 32 &&
        x <= nextGeometry.tableRect.right + 52 &&
        y >= nextGeometry.tableRect.top - 32 &&
        y <= nextGeometry.tableRect.bottom + 52
      setIsTableHovering(tableHovering)
      if (!tableHovering) {
        if (!interaction.menuOpen && !interaction.drag?.isDragging) setHoverState({ rowIndex: null, columnIndex: null })
        return
      }
      const isInsideTable = x >= nextGeometry.tableRect.left && x <= nextGeometry.tableRect.right && y >= nextGeometry.tableRect.top && y <= nextGeometry.tableRect.bottom
      const nearRowEdge = x < nextGeometry.tableRect.left && x >= nextGeometry.tableRect.left - 36
      const nearColumnEdge = y < nextGeometry.tableRect.top && y >= nextGeometry.tableRect.top - 36
      const rowIndex = (isInsideTable || nearRowEdge)
        ? nextGeometry.rows.findIndex((rect) => y >= rect.top - 10 && y <= rect.bottom + 10)
        : -1
      const columnIndex = (isInsideTable || nearColumnEdge)
        ? nextGeometry.columns.findIndex((rect) => x >= rect.left - 10 && x <= rect.right + 10)
        : -1
      setHoverState({
        rowIndex: rowIndex >= 0 ? rowIndex : null,
        columnIndex: columnIndex >= 0 ? columnIndex : null,
      })
    }
    document.addEventListener('pointermove', handlePointerMove)
    return () => document.removeEventListener('pointermove', handlePointerMove)
  }, [editor, geometry, interaction])

  useEffect(() => {
    const dragState = interaction.drag
    if (!dragState || !geometry) return
    const handlePointerMove = (event: PointerEvent) => {
      const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY)
      const rects = dragState.axis === 'row' ? geometry.rows : geometry.columns
      const pointer = dragState.axis === 'row' ? event.clientY : event.clientX
      const dropIndex = rects.findIndex((rect) => pointer < (dragState.axis === 'row' ? rect.top + rect.height / 2 : rect.left + rect.width / 2))
      const isDragging = dragState.isDragging || distance > 4
      if (isDragging && !dragState.isDragging) {
        setInteraction((current) => ({ ...current, menuOpen: false }))
        const rows = Array.from(geometry.table.querySelectorAll('tr'))
        if (dragState.axis === 'row') rows[dragState.from]?.classList.add('mybook-table-dragging-row')
        if (dragState.axis === 'column') rows.forEach((row) => row.children[dragState.from]?.classList.add('mybook-table-dragging-column'))
      }
      setInteraction((current) => ({
        ...current,
        drag: {
          ...dragState,
          isDragging,
          dropIndex: dropIndex === -1 ? rects.length - 1 : clamp(dropIndex, 0, rects.length - 1),
          pointerX: event.clientX,
          pointerY: event.clientY,
        },
      }))
    }
    const handlePointerUp = () => {
      if (dragState.isDragging && dragState.dropIndex !== null && dragState.dropIndex !== dragState.from) {
        const command = dragState.axis === 'row'
          ? moveTableRow({ from: dragState.from, to: dragState.dropIndex, pos: geometry.tablePos + 1, select: true })
          : moveTableColumn({ from: dragState.from, to: dragState.dropIndex, pos: geometry.tablePos + 1, select: true })
        command(editor.state, (transaction) => editor.view.dispatch(transaction.scrollIntoView()))
      } else if (!dragState.isDragging) {
        const nextSelection = { axis: dragState.axis, index: dragState.from, tablePos: geometry.tablePos, rect: dragState.rect }
        setInteraction({ selection: nextSelection, menuOpen: true, drag: null })
      }
      setInteraction((current) => ({ ...current, drag: null }))
    }
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp, { once: true })
    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [editor, geometry, interaction.drag])

  useEffect(() => {
    if (!tableResize || !geometry) return
    const widthAt = (clientX: number) => clamp(tableResize.startWidth + clientX - tableResize.startX, tableResize.minWidth, tableResize.maxWidth)
    const handlePointerMove = (event: PointerEvent) => {
      const width = widthAt(event.clientX)
      geometry.table.style.width = `${width}px`
      setTableResize((current) => current ? { ...current, width } : null)
    }
    const handlePointerUp = (event: PointerEvent) => {
      updateTableWidth(editor, geometry, widthAt(event.clientX))
      setTableResize(null)
    }
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp, { once: true })
    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [editor, geometry, tableResize])

  const controls = useMemo(() => {
    if (!geometry) return null
    return {
      columnControls: geometry.columns.map((rect, index) => ({ rect, index })),
      rowControls: geometry.rows.map((rect, index) => ({ rect, index })),
    }
  }, [geometry])

  const selection = interaction.selection
  const isManualMenuOpen = interaction.menuOpen
  const dragState = interaction.drag
  const isTableActive = Boolean(geometryFromEditor(editor))
  const activeCell = useMemo(() => activeCellCoordinates(editor, geometry), [editor, geometry])

  useLayoutEffect(() => {
    if (isTouch || !geometry || !isManualMenuOpen || selection?.axis !== 'column' || !columnMenuRef.current) return
    const menuRect = columnMenuRef.current.getBoundingClientRect()
    const gripTop = geometry.tableRect.top - 9
    const gripBottom = geometry.tableRect.top + 9
    const menuHeight = menuRect.height > 0 ? menuRect.height : 340
    const top = tableMenuTop(gripTop, gripBottom, menuHeight)
    setColumnMenuTop((current) => current === top ? current : top)
  }, [geometry, isManualMenuOpen, isTouch, selection])

  useLayoutEffect(() => {
    if (isTouch || !geometry || !isManualMenuOpen || selection?.axis !== 'row' || !rowMenuRef.current) return
    const menuRect = rowMenuRef.current.getBoundingClientRect()
    const gripTop = selection.rect.top + selection.rect.height / 2 - 9
    const gripBottom = gripTop + 18
    const menuHeight = menuRect.height > 0 ? menuRect.height : 340
    const top = rowGripMenuTop(gripTop, gripBottom, menuHeight)
    setRowMenuTop((current) => current === top ? current : top)
  }, [geometry, isManualMenuOpen, isTouch, selection])

  if (!geometry || !controls) return null

  const closeSelectionMenu = () => {
    setInteraction((current) => ({ ...current, menuOpen: false, selection: null }))
  }

  const openGripMenu = (nextSelection: SelectionState) => {
    setColumnMenuTop(null)
    setRowMenuTop(null)
    setInteraction({ selection: nextSelection, menuOpen: true, drag: null })
  }

  const addRightColumn = () => {
    selectColumn(editor, geometry, geometry.map.width - 1)
    editor.chain().focus().addColumnAfter().run()
    const nextGeometry = geometryFromEditor(editor)
    if (nextGeometry) {
      clearTableSelectionToCell(editor, cellPosFor(nextGeometry, 0, nextGeometry.map.width - 1))
    }
  }

  const addBottomRow = () => {
    selectRow(editor, geometry, geometry.map.height - 1)
    editor.chain().focus().addRowAfter().run()
    const nextGeometry = geometryFromEditor(editor)
    if (nextGeometry) {
      clearTableSelectionToCell(editor, cellPosFor(nextGeometry, nextGeometry.map.height - 1, 0))
    }
  }

  const addBottomRowAndRightColumn = () => {
    selectColumn(editor, geometry, geometry.map.width - 1)
    editor.chain().focus().addColumnAfter().run()
    editor.chain().focus().addRowAfter().run()
    const nextGeometry = geometryFromEditor(editor)
    if (nextGeometry) {
      clearTableSelectionToCell(editor, cellPosFor(nextGeometry, nextGeometry.map.height - 1, nextGeometry.map.width - 1))
    }
  }

  const beginTableResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const wrapperWidth = geometry.wrapper.getBoundingClientRect().width
    setTableResize({
      startX: event.clientX,
      startWidth: geometry.tableRect.width,
      width: geometry.tableRect.width,
      minWidth: geometry.map.width * 96,
      maxWidth: Math.max(1600, wrapperWidth),
    })
  }

  const resizeTableBy = (amount: number) => {
    const wrapperWidth = geometry.wrapper.getBoundingClientRect().width
    updateTableWidth(editor, geometry, clamp(geometry.tableRect.width + amount, geometry.map.width * 96, Math.max(1600, wrapperWidth)))
  }

  const dragGhost = dragState?.isDragging ? (() => {
    const rows = Array.from(geometry.table.querySelectorAll('tr'))
    const cells = dragState.axis === 'column'
      ? rows.map((row) => row.children[dragState.from]).filter((cell): cell is HTMLElement => cell instanceof HTMLElement)
      : Array.from(rows[dragState.from]?.children ?? []).filter((cell): cell is HTMLElement => cell instanceof HTMLElement)
    if (!cells.length) return null
    const width = dragState.axis === 'column' ? dragState.rect.width : geometry.tableRect.width
    const height = dragState.axis === 'column' ? geometry.tableRect.height : dragState.rect.height
    const left = dragState.axis === 'column' ? dragState.pointerX - width / 2 : geometry.tableRect.left
    const top = dragState.axis === 'column' ? geometry.tableRect.top : dragState.pointerY - height / 2
    return { axis: dragState.axis, cells, width, height, left, top }
  })() : null
  const wrapperRect = geometry.wrapper.getBoundingClientRect()
  const activeTableWidth = tableResize?.width ?? geometry.tableRect.width
  const visibleTableLeft = Math.max(geometry.tableRect.left, wrapperRect.left)
  const visibleTableRight = Math.min(geometry.tableRect.left + activeTableWidth, wrapperRect.right)
  const visibleTableWidth = Math.max(0, visibleTableRight - visibleTableLeft)
  const tableControlsBottom = geometry.tableRect.bottom
  const isFixed = isFixedRowsEnabled(editor, geometry) || geometry.wrapper.dataset.fixedRows === 'true'
  const effectiveRowBottom = isFixed ? wrapperRect.bottom : tableControlsBottom
  const isColumnButtonVisible = isFixed
    ? (wrapperRect.bottom >= wrapperRect.top && visibleTableWidth > 0)
    : (geometry.tableRect.right <= wrapperRect.right + 4 && geometry.tableRect.right >= wrapperRect.left)
  const isRowButtonVisible = isFixed
    ? (wrapperRect.bottom >= wrapperRect.top && visibleTableWidth > 0)
    : (tableControlsBottom <= wrapperRect.bottom + 4 && tableControlsBottom >= wrapperRect.top && visibleTableWidth > 0)

  return (
    <>
      {controls.columnControls.map(({ rect, index }) => {
        if (!isColumnGripInBounds(rect, wrapperRect)) return null

        const gripCenterX = rect.left + rect.width / 2
        const gripSelection = { axis: 'column' as const, index, tablePos: geometry.tablePos, rect }
        const isActiveCell = activeCell?.column === index
        const isVisible = isTouch
          ? (isTableActive || (selection?.axis === 'column' && selection.index === index) || (isManualMenuOpen && selection?.axis === 'column' && selection.index === index))
          : (hoverState.columnIndex === index || (selection?.axis === 'column' && selection.index === index) || (isManualMenuOpen && selection?.axis === 'column' && selection.index === index))

        return (
          <button
            key={`column-${index}`}
            type="button"
            aria-label={`Column ${index + 1} actions`}
            aria-haspopup="menu"
            aria-expanded={isManualMenuOpen && selection?.axis === 'column' && selection.index === index}
            className={`mybook-table-column-grip ${isTouch ? 'is-touch' : ''} ${isVisible ? 'is-visible' : ''} ${isActiveCell ? 'is-active-cell' : ''} ${selection?.axis === 'column' && selection.index === index ? 'is-selected' : ''} ${dragState?.isDragging && dragState.axis === 'column' && dragState.from === index ? 'is-dragging' : ''}`}
            style={{ top: rect.top - 9, left: gripCenterX - 9 }}
            onPointerEnter={() => !isTouch && setHoverState((current) => ({ ...current, columnIndex: index }))}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (isTouch) {
                selectColumn(editor, geometry, index)
                openGripMenu(gripSelection)
                return
              }
              event.currentTarget.setPointerCapture(event.pointerId)
              selectColumn(editor, geometry, index)
              setInteraction({
                selection: gripSelection,
                menuOpen: true,
                drag: { axis: 'column', from: index, tablePos: geometry.tablePos, rect, startX: event.clientX, startY: event.clientY, isDragging: false, dropIndex: null, pointerX: event.clientX, pointerY: event.clientY },
              })
            }}
            onPointerUp={(event) => {
              if (isTouch) return
              if (Math.hypot(event.clientX - (event.currentTarget as HTMLElement).getBoundingClientRect().left, event.clientY - (event.currentTarget as HTMLElement).getBoundingClientRect().top) < 24) {
                openGripMenu(gripSelection)
              }
            }}
            onClick={(event) => {
              if (event.detail === 0 || isTouch) openGripMenu(gripSelection)
            }}
          >
            <GripVerticalIcon className="size-3" />
          </button>
        )
      })}

      {controls.rowControls.map(({ rect, index }) => {
        if (!isRowGripInBounds(rect, wrapperRect) || visibleTableWidth <= 0) return null

        const gripCenterY = rect.top + rect.height / 2
        const gripSelection = { axis: 'row' as const, index, tablePos: geometry.tablePos, rect }
        const isActiveCell = activeCell?.row === index
        const isVisible = isTouch
          ? (isTableActive || (selection?.axis === 'row' && selection.index === index) || (isManualMenuOpen && selection?.axis === 'row' && selection.index === index))
          : (hoverState.rowIndex === index || (selection?.axis === 'row' && selection.index === index) || (isManualMenuOpen && selection?.axis === 'row' && selection.index === index))

        return (
          <button
            key={`row-${index}`}
            type="button"
            aria-label={`Row ${index + 1} actions`}
            aria-haspopup="menu"
            aria-expanded={isManualMenuOpen && selection?.axis === 'row' && selection.index === index}
            className={`mybook-table-row-grip ${isTouch ? 'is-touch' : ''} ${isVisible ? 'is-visible' : ''} ${isActiveCell ? 'is-active-cell' : ''} ${selection?.axis === 'row' && selection.index === index ? 'is-selected' : ''} ${dragState?.isDragging && dragState.axis === 'row' && dragState.from === index ? 'is-dragging' : ''}`}
            style={{ top: gripCenterY - 9, left: visibleTableLeft - 9 }}
            onPointerEnter={() => !isTouch && setHoverState((current) => ({ ...current, rowIndex: index }))}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (isTouch) {
                selectRow(editor, geometry, index)
                openGripMenu(gripSelection)
                return
              }
              event.currentTarget.setPointerCapture(event.pointerId)
              selectRow(editor, geometry, index)
              setInteraction({
                selection: gripSelection,
                menuOpen: true,
                drag: { axis: 'row', from: index, tablePos: geometry.tablePos, rect, startX: event.clientX, startY: event.clientY, isDragging: false, dropIndex: null, pointerX: event.clientX, pointerY: event.clientY },
              })
            }}
            onPointerUp={(event) => {
              if (isTouch) return
              if (Math.hypot(event.clientX - (event.currentTarget as HTMLElement).getBoundingClientRect().left, event.clientY - (event.currentTarget as HTMLElement).getBoundingClientRect().top) < 24) {
                openGripMenu(gripSelection)
              }
            }}
            onClick={(event) => {
              if (event.detail === 0 || isTouch) openGripMenu(gripSelection)
            }}
          >
            <GripHorizontalIcon className="size-3" />
          </button>
        )
      })}

      {isColumnButtonVisible ? (
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          aria-label="Add column"
          className={`mybook-table-add-column ${isTableHovering ? 'is-visible' : ''}`}
          style={{ top: isFixed ? wrapperRect.top : geometry.tableRect.top, left: visibleTableRight + 4, height: isFixed ? wrapperRect.height : geometry.tableRect.height }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={addRightColumn}
        >
          <HugeiconsIcon icon={PlusSignIcon} aria-hidden="true" className="size-3" />
        </Button>
      ) : null}
      {isRowButtonVisible ? (
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          aria-label="Add row"
          className={`mybook-table-add-row ${isTableHovering ? 'is-visible' : ''}`}
          style={{ top: effectiveRowBottom + 8, left: visibleTableLeft, width: visibleTableWidth }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={addBottomRow}
        >
          <HugeiconsIcon icon={PlusSignIcon} aria-hidden="true" className="size-3" />
        </Button>
      ) : null}
      {isColumnButtonVisible && isRowButtonVisible ? (
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          aria-label="Add row and column"
          className={`mybook-table-add-corner ${isTableHovering ? 'is-visible' : ''}`}
          style={{ top: effectiveRowBottom + 8, left: visibleTableRight + 4 }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={addBottomRowAndRightColumn}
        >
          <HugeiconsIcon icon={PlusSignIcon} aria-hidden="true" className="size-3" />
        </Button>
      ) : null}
      <button
        type="button"
        aria-label="Resize table"
        className={`mybook-table-resize-handle ${isTableHovering || tableResize ? 'is-visible' : ''}`}
        style={{ top: geometry.tableRect.bottom - 8, left: visibleTableRight - 8 }}
        onPointerDown={beginTableResize}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); resizeTableBy(-16) }
          if (event.key === 'ArrowRight') { event.preventDefault(); resizeTableBy(16) }
        }}
      />

      {dragState?.isDragging && dragState.dropIndex !== null ? (
        <div
          className="mybook-table-drop-indicator"
          style={dragState.axis === 'row'
            ? {
                top: geometry.rows[dragState.dropIndex]?.top ?? geometry.tableRect.bottom,
                left: geometry.tableRect.left,
                width: geometry.tableRect.width,
                height: 2,
              }
            : {
                top: geometry.tableRect.top,
                left: geometry.columns[dragState.dropIndex]?.left ?? geometry.tableRect.right,
                width: 2,
                height: geometry.tableRect.height,
              }}
        />
      ) : null}

      {dragGhost ? (
        <div
          className={`mybook-table-drag-ghost mybook-table-drag-ghost-${dragGhost.axis}`}
          style={{ top: dragGhost.top, left: dragGhost.left, width: dragGhost.width, height: dragGhost.height }}
          aria-hidden="true"
        >
          {dragGhost.cells.map((cell, index) => (
            <div key={index} className="mybook-table-drag-ghost-cell" style={dragGhost.axis === 'row' ? { width: cell.getBoundingClientRect().width } : { height: cell.getBoundingClientRect().height }}>
              {cell.textContent}
            </div>
          ))}
        </div>
      ) : null}

      {isManualMenuOpen && selection ? (
        isTouch ? (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
              onClick={closeSelectionMenu}
              aria-hidden="true"
            />
            <div
              ref={selection.axis === 'column' ? columnMenuRef : rowMenuRef}
              data-table-menu="true"
              data-editor-popover="true"
              className="mybook-table-manual-menu fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[var(--app-border)] bg-popover p-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
              role="menu"
            >
              <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-muted-foreground/30" aria-hidden="true" />
              <GripMenuContent editor={editor} geometry={geometry} selection={selection} onClose={closeSelectionMenu} />
            </div>
          </>
        ) : (
          <div
            ref={selection.axis === 'column' ? columnMenuRef : rowMenuRef}
            data-table-menu="true"
            data-editor-popover="true"
            className="mybook-table-manual-menu fixed z-50 w-64 max-h-[min(24rem,calc(100dvh-5rem))] overflow-y-auto rounded-xl border border-[var(--app-border)] bg-popover p-1 text-popover-foreground shadow-lg"
            style={selection.axis === 'row'
              ? {
                  top: rowMenuTop ?? rowGripMenuTop(selection.rect.top + selection.rect.height / 2 - 9, selection.rect.top + selection.rect.height / 2 + 9, 360),
                  left: Math.max(8, Math.min(visibleTableLeft + 14, window.innerWidth - 264)),
                }
              : {
                top: columnMenuTop ?? tableMenuTop(geometry.tableRect.top - 9, geometry.tableRect.top + 9, 360),
                  left: Math.max(8, Math.min(selection.rect.left + selection.rect.width / 2 - 9, window.innerWidth - 264)),
                }}
            role="menu"
          >
            <GripMenuContent editor={editor} geometry={geometry} selection={selection} onClose={closeSelectionMenu} />
          </div>
        )
      ) : null}

    </>
  )
}
