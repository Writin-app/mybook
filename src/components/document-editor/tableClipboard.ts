import { CellSelection } from 'prosemirror-tables'
import type { Fragment, Node as ProseMirrorNode, Slice } from '@tiptap/pm/model'
import type { Selection } from '@tiptap/pm/state'

/**
 * Returns the depth of the nearest ancestor tableCell or tableHeader, or null if none.
 */
export function getCellDepth($pos: Selection['$from']): number | null {
  for (let d = $pos.depth; d > 0; d--) {
    const type = $pos.node(d).type.name
    if (type === 'tableCell' || type === 'tableHeader') return d
  }
  return null
}

/**
 * Checks whether the selection is entirely within a single table cell or header.
 */
export function isSingleTableCellSelection(selection: Selection): boolean {
  if (selection instanceof CellSelection) {
    return selection.$anchorCell.pos === selection.$headCell.pos
  }
  const fromCellDepth = getCellDepth(selection.$from)
  const toCellDepth = getCellDepth(selection.$to)
  if (fromCellDepth === null || toCellDepth === null) return false
  return selection.$from.before(fromCellDepth) === selection.$to.before(toCellDepth)
}

/**
 * Checks whether the selection is a table selection (either CellSelection or text inside a cell).
 */
export function isTableCellSelection(selection: Selection): boolean {
  if (selection instanceof CellSelection) return true
  return isSingleTableCellSelection(selection)
}

/**
 * Extracts plain text from a table slice (rows separated by newline, cells by tab).
 */
export function extractTablePlainText(slice: Slice): string {
  const rowNodes: ProseMirrorNode[] = []

  slice.content.descendants((node) => {
    if (node.type.name === 'tableRow') {
      rowNodes.push(node)
      return false
    }
    return true
  })

  if (rowNodes.length > 0) {
    const rows = rowNodes.map((rowNode) => {
      const cells: string[] = []
      rowNode.forEach((cellNode) => {
        if (cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') {
          cells.push(cellNode.textBetween(0, cellNode.content.size, ' ').trim())
        }
      })
      return cells.join('\t')
    })
    return rows.join('\n')
  }

  return slice.content.textBetween(0, slice.content.size, '\n')
}

/**
 * Unwraps table, row, and cell wrappers from a slice fragment if it represents a single cell's contents.
 */
export function unwrapTableCellFragment(slice: Slice): Fragment {
  let fragment = slice.content
  while (fragment.childCount === 1) {
    const first = fragment.firstChild!
    if (['table', 'tableRow', 'tableCell', 'tableHeader'].includes(first.type.name)) {
      fragment = first.content
    } else {
      break
    }
  }
  return fragment
}

/**
 * Returns clean plain text if the selection is from a table or table cell, or null if outside a table.
 */
export function getTableSelectionPlainText(selection: Selection, doc: ProseMirrorNode): string | null {
  if (selection instanceof CellSelection) {
    if (isSingleTableCellSelection(selection)) {
      const cellNode = selection.$anchorCell.nodeAfter
      if (cellNode) {
        return cellNode.textBetween(0, cellNode.content.size, '\n')
      }
    }
    const slice = selection.content()
    return extractTablePlainText(slice)
  }

  if (isSingleTableCellSelection(selection)) {
    return doc.textBetween(selection.from, selection.to, '\n')
  }

  return null
}
