// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import StarterKit from '@tiptap/starter-kit'
import { TableMap } from 'prosemirror-tables'
import { afterEach, describe, expect, it } from 'vitest'

import { FixedTable } from './extensions/FixedTable'
import { StyledTableCell, StyledTableHeader } from './extensions/TableCellStyles'
import {
  activeCellCoordinates,
  isColumnGripInBounds,
  isRowGripInBounds,
  tableElementsFromNodeDom,
} from './tableDom'

describe('tableElementsFromNodeDom', () => {
  it('uses the inner table rather than its full-width Tiptap wrapper', () => {
    const wrapper = document.createElement('div')
    wrapper.className = 'tableWrapper'
    const table = document.createElement('table')
    wrapper.append(table)

    expect(tableElementsFromNodeDom(wrapper)).toEqual({ wrapper, table })
  })
})

describe('isColumnGripInBounds', () => {
  const wrapperRect = { left: 100, right: 500 }

  it('returns true when column is well within wrapper bounds', () => {
    // Column from 200 to 300, center at 250
    expect(isColumnGripInBounds({ left: 200, right: 300, width: 100 }, wrapperRect)).toBe(true)
  })

  it('returns false when column is completely scrolled off the left edge', () => {
    // Column from 10 to 90, center at 50 < 100
    expect(isColumnGripInBounds({ left: 10, right: 90, width: 80 }, wrapperRect)).toBe(false)
  })

  it('returns false when column is completely scrolled off the right edge', () => {
    // Column from 520 to 600, center at 560 > 500
    expect(isColumnGripInBounds({ left: 520, right: 600, width: 80 }, wrapperRect)).toBe(false)
  })

  it('returns false when column is partially visible but grip center is outside on the left', () => {
    // Column from 40 to 140 (width 100), center at 90 (< 100)
    expect(isColumnGripInBounds({ left: 40, right: 140, width: 100 }, wrapperRect)).toBe(false)
  })

  it('returns true when column is partially visible and grip center is inside on the left', () => {
    // Column from 80 to 180 (width 100), center at 130 (>= 100)
    expect(isColumnGripInBounds({ left: 80, right: 180, width: 100 }, wrapperRect)).toBe(true)
  })

  it('returns false when column is partially visible but grip center is outside on the right', () => {
    // Column from 460 to 560 (width 100), center at 510 (> 500)
    expect(isColumnGripInBounds({ left: 460, right: 560, width: 100 }, wrapperRect)).toBe(false)
  })
})

describe('isRowGripInBounds', () => {
  const wrapperRect = { top: 50, bottom: 400 }

  it('returns true when row is within vertical wrapper bounds', () => {
    expect(isRowGripInBounds({ top: 100, bottom: 140, height: 40 }, wrapperRect)).toBe(true)
  })

  it('returns false when row is scrolled above wrapper top', () => {
    expect(isRowGripInBounds({ top: 0, bottom: 40, height: 40 }, wrapperRect)).toBe(false)
  })

  it('returns false when row is scrolled below wrapper bottom', () => {
    expect(isRowGripInBounds({ top: 410, bottom: 450, height: 40 }, wrapperRect)).toBe(false)
  })
})

describe('activeCellCoordinates', () => {
  let editor: Editor | null = null

  afterEach(() => {
    editor?.destroy()
    editor = null
  })

  it('returns correct row and column when caret is inside a cell', () => {
    editor = new Editor({
      extensions: [
        StarterKit,
        TableKit.configure({ table: false, tableCell: false, tableHeader: false }),
        FixedTable,
        StyledTableCell,
        StyledTableHeader,
      ],
      content: {
        type: 'doc',
        content: [{
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H1' }] }] },
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H2' }] }] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'C1' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'C2' }] }] },
              ],
            },
          ],
        }],
      },
    })

    const tableNode = editor.state.doc.firstChild!
    const geometry = {
      tableStart: 1,
      map: TableMap.get(tableNode),
    }

    // Position cursor in Row 0, Col 0 ("H1")
    editor.commands.setTextSelection(4)
    expect(activeCellCoordinates(editor, geometry)).toEqual({ row: 0, column: 0 })

    // Position cursor in Row 1, Col 1 ("C2")
    // Let's find pos of "C2" text:
    let c2Pos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'C2') c2Pos = pos + 1
    })
    editor.commands.setTextSelection(c2Pos)
    expect(activeCellCoordinates(editor, geometry)).toEqual({ row: 1, column: 1 })
  })

  it('returns null when geometry is null or selection is outside table', () => {
    editor = new Editor({
      extensions: [StarterKit],
      content: '<p>Outside paragraph</p>',
    })
    editor.commands.setTextSelection(2)
    expect(activeCellCoordinates(editor, null)).toBeNull()
  })
})
