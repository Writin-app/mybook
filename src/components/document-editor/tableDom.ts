import type { Editor } from '@tiptap/react'
import { CellSelection, selectedRect, type TableMap } from 'prosemirror-tables'

export function tableElementsFromNodeDom(nodeDom: Node | null) {
  if (!(nodeDom instanceof HTMLElement)) return null
  const table = nodeDom instanceof HTMLTableElement ? nodeDom : nodeDom.querySelector(':scope > table')
  if (!(table instanceof HTMLTableElement)) return null
  return { wrapper: nodeDom instanceof HTMLTableElement ? nodeDom.parentElement ?? nodeDom : nodeDom, table }
}

/**
 * Finds the row and column coordinates of the currently active/focused table cell.
 */
export function activeCellCoordinates(
  editor: Editor,
  geometry: { tableStart: number; map: TableMap } | null,
): { row: number; column: number } | null {
  if (!geometry) return null
  const { selection } = editor.state
  if (selection instanceof CellSelection) {
    const rect = selectedRect(editor.state)
    return { row: rect.top, column: rect.left }
  }
  const $from = selection.$from
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      const cellPos = $from.before(d)
      const relPos = cellPos - geometry.tableStart
      try {
        const rect = geometry.map.findCell(relPos)
        return { row: rect.top, column: rect.left }
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * Checks whether a column grip is within the visible horizontal bounds of the table wrapper.
 */
export function isColumnGripInBounds(
  columnRect: { left: number; right: number; width: number },
  wrapperRect: { left: number; right: number },
): boolean {
  const isPartiallyVisible = columnRect.right > wrapperRect.left && columnRect.left < wrapperRect.right
  const gripCenterX = columnRect.left + columnRect.width / 2
  return isPartiallyVisible && gripCenterX >= wrapperRect.left && gripCenterX <= wrapperRect.right
}

/**
 * Checks whether a row grip is within the visible vertical bounds of the table wrapper.
 */
export function isRowGripInBounds(
  rowRect: { top: number; bottom: number; height: number },
  wrapperRect: { top: number; bottom: number },
): boolean {
  const isPartiallyVisible = rowRect.bottom > wrapperRect.top && rowRect.top < wrapperRect.bottom
  const gripCenterY = rowRect.top + rowRect.height / 2
  return isPartiallyVisible && gripCenterY >= wrapperRect.top && gripCenterY <= wrapperRect.bottom
}
