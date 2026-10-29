// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import StarterKit from '@tiptap/starter-kit'
import { CellSelection } from 'prosemirror-tables'
import { TextSelection } from '@tiptap/pm/state'
import { DOMSerializer } from '@tiptap/pm/model'
import { FixedTable } from './extensions/FixedTable'
import { StyledTableCell, StyledTableHeader } from './extensions/TableCellStyles'
import {
  getTableSelectionPlainText,
  isSingleTableCellSelection,
  isTableCellSelection,
  unwrapTableCellFragment,
} from './tableClipboard'

describe('tableClipboard', () => {
  let editor: Editor

  afterEach(() => {
    editor?.destroy()
  })

  function createEditorWithTable() {
    return new Editor({
      extensions: [
        StarterKit,
        TableKit.configure({ table: false, tableCell: false, tableHeader: false }),
        FixedTable,
        StyledTableCell,
        StyledTableHeader,
      ],
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Document introduction before table' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Header 1' }],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Header 2' }],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          { type: 'text', text: 'Normal ' },
                          { type: 'text', marks: [{ type: 'bold' }], text: 'bold formatted' },
                          { type: 'text', text: ' text' },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Second cell' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Paragraph after table' }],
          },
        ],
      },
    })
  }

  it('returns clean plain text without Markdown syntax when copying formatted text inside a cell', () => {
    editor = createEditorWithTable()
    let boldTextPos = 0

    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'bold formatted') {
        boldTextPos = pos
      }
    })

    // Select "bold formatted" inside the cell
    const selection = TextSelection.create(editor.state.doc, boldTextPos, boldTextPos + 14)
    editor.view.dispatch(editor.state.tr.setSelection(selection))

    expect(isSingleTableCellSelection(editor.state.selection)).toBe(true)
    expect(isTableCellSelection(editor.state.selection)).toBe(true)

    const plainText = getTableSelectionPlainText(editor.state.selection, editor.state.doc)
    expect(plainText).toBe('bold formatted')
    expect(plainText).not.toContain('**')
    expect(plainText).not.toContain(':::table')

    // Verify unwrapped fragment for HTML does not contain <table> or <td> wrapper
    const slice = editor.state.selection.content()
    const unwrapped = unwrapTableCellFragment(slice)
    const div = document.createElement('div')
    div.appendChild(DOMSerializer.fromSchema(editor.state.schema).serializeFragment(unwrapped))

    expect(div.querySelector('table')).toBeNull()
    expect(div.querySelector('td')).toBeNull()
    expect(div.innerHTML).toContain('<strong>bold formatted</strong>')
  })

  it('returns plain text without :::table block when entire cell is selected via CellSelection', () => {
    editor = createEditorWithTable()
    let cellPos = 0

    editor.state.doc.descendants((node, pos) => {
      if (!cellPos && node.type.name === 'tableCell') {
        cellPos = pos
      }
    })

    const cellSelection = CellSelection.create(editor.state.doc, cellPos)
    editor.view.dispatch(editor.state.tr.setSelection(cellSelection))

    expect(isSingleTableCellSelection(editor.state.selection)).toBe(true)
    expect(isTableCellSelection(editor.state.selection)).toBe(true)

    const plainText = getTableSelectionPlainText(editor.state.selection, editor.state.doc)
    expect(plainText).toBe('Normal bold formatted text')
    expect(plainText).not.toContain(':::table')
    expect(plainText).not.toContain('**')
  })

  it('formats multiple selected cells with tabs and newlines for spreadsheet/external paste', () => {
    editor = createEditorWithTable()
    const cellPositions: number[] = []

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        cellPositions.push(pos)
      }
    })

    // Select from first header cell to second header cell (two cells horizontally)
    const multiCellSelection = new CellSelection(
      editor.state.doc.resolve(cellPositions[0]!),
      editor.state.doc.resolve(cellPositions[1]!),
    )
    editor.view.dispatch(editor.state.tr.setSelection(multiCellSelection))

    expect(isSingleTableCellSelection(editor.state.selection)).toBe(false)
    expect(isTableCellSelection(editor.state.selection)).toBe(true)

    const plainText = getTableSelectionPlainText(editor.state.selection, editor.state.doc)
    expect(plainText).toBe('Header 1\tHeader 2')
    expect(plainText).not.toContain(':::table')
    expect(plainText).not.toContain('**')
  })

  it('formats a 2x2 multi-cell selection with tabs across columns and newlines across rows', () => {
    editor = createEditorWithTable()
    const cellPositions: number[] = []

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        cellPositions.push(pos)
      }
    })

    // Select from first header cell (top-left) to last table cell (bottom-right)
    const multiCellSelection = new CellSelection(
      editor.state.doc.resolve(cellPositions[0]!),
      editor.state.doc.resolve(cellPositions[3]!),
    )
    editor.view.dispatch(editor.state.tr.setSelection(multiCellSelection))

    const plainText = getTableSelectionPlainText(editor.state.selection, editor.state.doc)
    expect(plainText).toBe('Header 1\tHeader 2\nNormal bold formatted text\tSecond cell')
    expect(plainText).not.toContain(':::table')
    expect(plainText).not.toContain('**')
  })

  it('returns null for selections outside table, allowing normal document markdown copy', () => {
    editor = createEditorWithTable()
    // Select "Document introduction" in the paragraph before table
    const selection = TextSelection.create(editor.state.doc, 1, 22)
    editor.view.dispatch(editor.state.tr.setSelection(selection))

    expect(isSingleTableCellSelection(editor.state.selection)).toBe(false)
    expect(isTableCellSelection(editor.state.selection)).toBe(false)
    expect(getTableSelectionPlainText(editor.state.selection, editor.state.doc)).toBeNull()
  })

  it('populates clipboardData with clean plain text and unwrapped html on copy event', () => {
    editor = createEditorWithTable()
    let boldTextPos = 0

    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'bold formatted') {
        boldTextPos = pos
      }
    })

    const selection = TextSelection.create(editor.state.doc, boldTextPos, boldTextPos + 14)
    editor.view.dispatch(editor.state.tr.setSelection(selection))

    const clipboardStore: Record<string, string> = {}
    const mockClipboardData = {
      setData: (type: string, value: string) => {
        clipboardStore[type] = value
      },
    }

    const tableText = getTableSelectionPlainText(editor.state.selection, editor.state.doc)
    expect(tableText).toBe('bold formatted')

    if (tableText !== null) {
      const slice = editor.state.selection.content()
      const fragment = isSingleTableCellSelection(editor.state.selection)
        ? unwrapTableCellFragment(slice)
        : slice.content
      const div = document.createElement('div')
      const dom = DOMSerializer.fromSchema(editor.state.schema).serializeFragment(fragment)
      div.appendChild(dom)
      mockClipboardData.setData('text/html', div.innerHTML)
      mockClipboardData.setData('text/plain', tableText)
    }

    expect(clipboardStore['text/plain']).toBe('bold formatted')
    expect(clipboardStore['text/plain']).not.toContain('**')
    expect(clipboardStore['text/plain']).not.toContain(':::table')
    expect(clipboardStore['text/html']).toContain('<strong>bold formatted</strong>')
    expect(clipboardStore['text/html']).not.toContain('<table>')
  })
})
