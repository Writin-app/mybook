import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

export interface ToolbarPosition {
  left: number
  top: number
}

export const SELECTION_TOOLBAR_WIDTH = 570

export function selectionPosition(editor: Editor): ToolbarPosition | null {
  const { selection, doc } = editor.state
  if (!(selection instanceof TextSelection) || selection.empty || !editor.isFocused || editor.isActive('codeBlock')) return null
  const { from, to } = selection
  if (from < 0 || to > doc.content.size) return null
  let start: { left: number; top: number; bottom: number; right: number }
  let end: { left: number; top: number; bottom: number; right: number }
  try {
    start = editor.view.coordsAtPos(from)
    end = editor.view.coordsAtPos(to)
  } catch {
    return null
  }
  if (!Number.isFinite(start.left) || !Number.isFinite(end.right)) return null

  const viewportHeight = typeof window !== 'undefined'
    ? (window.visualViewport && window.visualViewport.height > 0
        ? window.visualViewport.offsetTop + window.visualViewport.height
        : window.innerHeight)
    : 768
  const header = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.mybook-document-editor > header') : null
  const headerBottom = header?.getBoundingClientRect().bottom ?? 0
  const minTop = Math.max(8, headerBottom + 8)
  const maxTop = Math.max(minTop, viewportHeight - 44)

  const toolbarWidth = SELECTION_TOOLBAR_WIDTH
  const maxLeft = (typeof window !== 'undefined' ? window.innerWidth : 1024) - toolbarWidth - 8

  let top = Math.min(start.top, end.top) - 44
  let left = Math.max(8, Math.min(Math.min(start.left, end.left), maxLeft))

  // Table Add buttons collision avoidance:
  let cellElement: HTMLElement | null = null
  try {
    const domNode = editor.view.domAtPos(from).node
    cellElement = (domNode instanceof Element ? domNode : domNode.parentElement)?.closest('td, th') as HTMLElement | null
  } catch {
    cellElement = null
  }

  const tableElement = cellElement?.closest('table')
  const wrapperElement = (tableElement?.closest('.tableWrapper') ?? tableElement) as HTMLElement | null

  if (tableElement && wrapperElement) {
    const tableRect = tableElement.getBoundingClientRect()
    const wrapperRect = wrapperElement.getBoundingClientRect()
    const isFixedRows = wrapperElement.getAttribute('data-fixed-rows') === 'true'
      || wrapperElement.dataset.fixedRows === 'true'
      || tableElement.getAttribute('data-fixed-rows') === 'true'
      || Boolean(wrapperElement.style.maxHeight)

    const hasWrapperRect = wrapperRect.right > wrapperRect.left
    const visibleTableRight = hasWrapperRect ? Math.min(tableRect.right, wrapperRect.right) : tableRect.right
    const visibleTableLeft = hasWrapperRect ? Math.max(tableRect.left, wrapperRect.left) : tableRect.left
    const effectiveRowBottom = isFixedRows ? (hasWrapperRect ? wrapperRect.bottom : tableRect.bottom) : tableRect.bottom

    const addColumnZoneLeft = visibleTableRight + 4
    const addColumnZoneRight = visibleTableRight + 28
    const columnZoneTop = isFixedRows && hasWrapperRect ? wrapperRect.top : tableRect.top
    const columnZoneBottom = isFixedRows && hasWrapperRect ? wrapperRect.bottom : tableRect.bottom

    const addRowZoneTop = effectiveRowBottom + 8
    const addRowZoneBottom = effectiveRowBottom + 44

    // 1. Horizontal/vertical check: does the toolbar overlap the Add Column button on the right edge?
    const overlapsColumn = left <= addColumnZoneRight &&
      left + toolbarWidth >= addColumnZoneLeft &&
      top <= columnZoneBottom &&
      top + 44 >= columnZoneTop

    if (overlapsColumn) {
      const shiftedLeft = visibleTableRight - toolbarWidth - 12
      if (shiftedLeft >= 8) {
        left = shiftedLeft
      } else if (columnZoneTop - 48 >= minTop) {
        top = columnZoneTop - 48
      } else if (addRowZoneBottom + 8 <= maxTop) {
        top = addRowZoneBottom + 8
      }
    }

    // 2. Vertical check: does the toolbar overlap the Add Row or Corner buttons?
    const overlapsRow = left <= addColumnZoneRight &&
      left + toolbarWidth >= visibleTableLeft &&
      top <= addRowZoneBottom &&
      top + 44 >= addRowZoneTop

    if (top < minTop || overlapsRow) {
      if (addRowZoneBottom + 8 <= maxTop) {
        top = addRowZoneBottom + 8
      } else if (start.top - 44 >= minTop) {
        top = start.top - 44
      } else if (columnZoneTop - 48 >= minTop) {
        top = columnZoneTop - 48
      } else {
        top = Math.max(minTop, Math.min(start.bottom + 8, maxTop))
      }
    }
  } else {
    if (top < minTop) {
      top = Math.max(start.bottom, end.bottom) + 8
    }
  }

  top = Math.max(minTop, Math.min(top, maxTop))
  left = Math.max(8, Math.min(left, maxLeft))
  return { left, top }
}
