// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

import { FixedTable } from './extensions/FixedTable'
import { StyledTableCell, StyledTableHeader } from './extensions/TableCellStyles'
import { resetHeaderCellBackgrounds } from './tableHeaderBackground'

describe('resetHeaderCellBackgrounds', () => {
  let editor: Editor

  afterEach(() => editor.destroy())

  it('restores header cells to their default background after a header toggle cycle', () => {
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
          content: [{
            type: 'tableRow',
            content: [
              { type: 'tableHeader', attrs: { backgroundColor: '#fce7f3' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name' }] }] },
              { type: 'tableHeader', attrs: { backgroundColor: '#fce7f3' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Status' }] }] },
            ],
          }],
        }],
      },
    })

    editor.commands.setTextSelection(4)
    editor.commands.toggleHeaderRow()
    editor.commands.toggleHeaderRow()

    const headerCellPositions: number[] = []
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'tableHeader') headerCellPositions.push(position)
    })
    resetHeaderCellBackgrounds(editor, headerCellPositions)

    editor.state.doc.descendants((node) => {
      if (node.type.name === 'tableHeader') expect(node.attrs.backgroundColor).toBeNull()
    })
  })
})
