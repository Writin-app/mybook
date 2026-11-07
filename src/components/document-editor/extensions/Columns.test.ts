// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Heading from '@tiptap/extension-heading'
import Text from '@tiptap/extension-text'

import { Columns, Column, columnsNode, normalizeColumnCount, deleteColumnAt } from './Columns'
import { Callout, calloutNode } from './Callout'
import { getColumnContext, gutterBoundsForTarget, insertBlockCommands, type BlockTarget } from '../columnControls'

describe('Columns and Column extensions', () => {
  it('normalizes column count correctly', () => {
    expect(normalizeColumnCount(2)).toBe(2)
    expect(normalizeColumnCount(3)).toBe(3)
    expect(normalizeColumnCount(4)).toBe(4)
    expect(normalizeColumnCount(5)).toBe(5)
    expect(normalizeColumnCount(1)).toBe(2)
    expect(normalizeColumnCount(6)).toBe(2)
    expect(normalizeColumnCount('3')).toBe(3)
    expect(normalizeColumnCount(undefined)).toBe(2)
  })

  it('creates columnsNode with 2, 3, 4, and 5 columns', () => {
    const col2 = columnsNode(2)
    expect(col2.type).toBe('columns')
    expect(col2.attrs.count).toBe(2)
    expect(col2.content.length).toBe(2)
    expect(col2.content[0]?.type).toBe('column')
    expect(col2.content[1]?.type).toBe('column')

    const col3 = columnsNode(3)
    expect(col3.attrs.count).toBe(3)
    expect(col3.content.length).toBe(3)

    const col4 = columnsNode(4)
    expect(col4.attrs.count).toBe(4)
    expect(col4.content.length).toBe(4)

    const col5 = columnsNode(5)
    expect(col5.attrs.count).toBe(5)
    expect(col5.content.length).toBe(5)
  })

  it('renders and parses columns in the DOM', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [columnsNode(3)],
      },
    })

    const columnsEl = element.querySelector('.mybook-columns')
    expect(columnsEl).not.toBeNull()
    expect(columnsEl?.getAttribute('data-columns')).toBe('3')

    const columnEls = element.querySelectorAll('.mybook-column')
    expect(columnEls.length).toBe(3)

    editor.destroy()
    element.remove()
  })

  it('supports independent editing inside columns', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [columnsNode(2)],
      },
    })

    // Insert text into column 1
    const firstColPos = 3 // inside first paragraph of first column
    editor.chain().setTextSelection(firstColPos).insertContent('Left text').run()

    // Find position in column 2 and insert text
    const secondColPos = editor.state.doc.resolve(editor.state.doc.content.size - 3).pos
    editor.chain().setTextSelection(secondColPos).insertContent('Right text').run()

    const columnsNodeInDoc = editor.state.doc.firstChild!
    expect(columnsNodeInDoc.type.name).toBe('columns')
    expect(columnsNodeInDoc.child(0).textContent).toBe('Left text')
    expect(columnsNodeInDoc.child(1).textContent).toBe('Right text')

    editor.destroy()
    element.remove()
  })

  it('supports nested blocks like headings and callouts inside columns', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Heading, Text, Columns, Column, Callout],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 2 },
            content: [
              {
                type: 'column',
                content: [
                  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Column Heading' }] },
                  calloutNode('info'),
                ],
              },
              {
                type: 'column',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Second col' }] },
                ],
              },
            ],
          },
        ],
      },
    })

    const columnsNodeInDoc = editor.state.doc.firstChild!
    const firstCol = columnsNodeInDoc.child(0)
    expect(firstCol.child(0).type.name).toBe('heading')
    expect(firstCol.child(1).type.name).toBe('callout')

    editor.destroy()
    element.remove()
  })

  it('keeps cursor inside column when pressing Enter at the end of a block', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 2 },
            content: [
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'End of column 1' }] }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Column 2' }] }],
              },
            ],
          },
        ],
      },
    })

    // Place selection at the end of the paragraph in column 1
    const firstColParagraphEnd = 18 // "End of column 1"
    editor.chain().setTextSelection(firstColParagraphEnd).run()

    // Execute splitBlock (Enter)
    editor.commands.splitBlock()

    const columnsNodeInDoc = editor.state.doc.firstChild!
    const firstCol = columnsNodeInDoc.child(0)
    // Column 1 should now have 2 paragraphs
    expect(firstCol.childCount).toBe(2)
    expect(firstCol.child(0).textContent).toBe('End of column 1')
    expect(firstCol.child(1).textContent).toBe('')

    // Selection should be inside column 1
    const { $from } = editor.state.selection
    let insideColumn = false
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name === 'column') insideColumn = true
    }
    expect(insideColumn).toBe(true)

    editor.destroy()
    element.remove()
  })

  it('preserves column isolation and does not merge column 2 into column 1 on backspace', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 2 },
            content: [
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 1' }] }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 2' }] }],
              },
            ],
          },
        ],
      },
    })

    const columnsNodeInDoc = editor.state.doc.firstChild!
    const col2Pos = 1 + columnsNodeInDoc.child(0).nodeSize + 2 // start of text in col 2
    editor.chain().setTextSelection(col2Pos).run()

    // Simulate backspace at start of column 2 paragraph
    editor.commands.deleteCurrentNode()

    // Col 2 remains a separate column
    const updatedColumns = editor.state.doc.firstChild!
    expect(updatedColumns.childCount).toBe(2)
    expect(updatedColumns.child(0).type.name).toBe('column')
    expect(updatedColumns.child(1).type.name).toBe('column')

    editor.destroy()
    element.remove()
  })

  it('exits columns container when pressing Enter on an empty paragraph at the end of the last column', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 2 },
            content: [
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Left text' }] }],
              },
              {
                type: 'column',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Right text' }] },
                  { type: 'paragraph' }, // empty paragraph at end
                ],
              },
            ],
          },
        ],
      },
    })

    // Find the empty paragraph at the end of the last column
    let emptyParagraphPos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.isTextblock && node.content.size === 0) {
        emptyParagraphPos = pos
      }
    })

    editor.chain().setTextSelection(emptyParagraphPos + 1).run()

    // Trigger Enter key shortcut directly
    const shortcuts = Columns.config.addKeyboardShortcuts?.call({ editor } as never)
    const handled = shortcuts?.['Enter']?.({ editor, state: editor.state, dispatch: editor.view.dispatch } as never)
    expect(handled).toBe(true)

    // Verify document now has a root-level paragraph after columns
    expect(editor.state.doc.childCount).toBe(2)
    expect(editor.state.doc.child(0).type.name).toBe('columns')
    expect(editor.state.doc.child(1).type.name).toBe('paragraph')

    // Verify the empty paragraph was removed from the last column
    const updatedCol2 = editor.state.doc.child(0).child(1)
    expect(updatedCol2.childCount).toBe(1)
    expect(updatedCol2.child(0).textContent).toBe('Right text')

    // Selection should be in the root-level paragraph after columns
    const { $from } = editor.state.selection
    expect($from.depth).toBe(1)
    expect($from.parent.type.name).toBe('paragraph')

    editor.destroy()
    element.remove()
  })

  it('advances to next column when pressing Enter in an empty non-last column', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 2 },
            content: [
              {
                type: 'column',
                content: [{ type: 'paragraph' }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 2 text' }] }],
              },
            ],
          },
        ],
      },
    })

    editor.chain().setTextSelection(3).run()

    const shortcuts = Columns.config.addKeyboardShortcuts?.call({ editor } as never)
    const handled = shortcuts?.['Enter']?.({ editor, state: editor.state, dispatch: editor.view.dispatch } as never)
    expect(handled).toBe(true)

    const col1 = editor.state.doc.child(0).child(0)
    expect(col1.childCount).toBe(1)

    const { $from } = editor.state.selection
    let colIndex = -1
    for (let d = $from.depth; d > 0; d -= 1) {
      if ($from.node(d).type.name === 'column') {
        colIndex = $from.index(d - 1)
        break
      }
    }
    expect(colIndex).toBe(1)

    editor.destroy()
    element.remove()
  })

  it('removes trailing empty paragraph and advances to next column when pressing Enter in a non-last column', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 2 },
            content: [
              {
                type: 'column',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Left text' }] },
                  { type: 'paragraph' },
                ],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Right text' }] }],
              },
            ],
          },
        ],
      },
    })

    let emptyParagraphPos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.isTextblock && node.content.size === 0 && emptyParagraphPos === 0) {
        emptyParagraphPos = pos
      }
    })
    editor.chain().setTextSelection(emptyParagraphPos + 1).run()

    const shortcuts = Columns.config.addKeyboardShortcuts?.call({ editor } as never)
    const handled = shortcuts?.['Enter']?.({ editor, state: editor.state, dispatch: editor.view.dispatch } as never)
    expect(handled).toBe(true)

    const col1 = editor.state.doc.child(0).child(0)
    expect(col1.childCount).toBe(1)
    expect(col1.child(0).textContent).toBe('Left text')

    const { $from } = editor.state.selection
    let colIndex = -1
    for (let d = $from.depth; d > 0; d -= 1) {
      if ($from.node(d).type.name === 'column') {
        colIndex = $from.index(d - 1)
        break
      }
    }
    expect(colIndex).toBe(1)

    editor.destroy()
    element.remove()
  })

  it('exits columns container when pressing ArrowDown at the end of the last column when Columns is the last block', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 2 },
            content: [
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Left' }] }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Right' }] }],
              },
            ],
          },
        ],
      },
    })

    // Put cursor at the end of Right in column 2
    let rightTextEnd = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Right') {
        rightTextEnd = pos + node.nodeSize
      }
    })
    editor.chain().setTextSelection(rightTextEnd).run()

    const shortcuts = Columns.config.addKeyboardShortcuts?.call({ editor } as never)
    const handled = shortcuts?.['ArrowDown']?.({ editor, state: editor.state, dispatch: editor.view.dispatch } as never)
    expect(handled).toBe(true)

    // Document now has root-level paragraph after columns
    expect(editor.state.doc.childCount).toBe(2)
    expect(editor.state.doc.child(1).type.name).toBe('paragraph')

    const { $from } = editor.state.selection
    expect($from.depth).toBe(1)
    expect($from.parent.type.name).toBe('paragraph')

    editor.destroy()
    element.remove()
  })

  it('correctly resolves column context for blocks in multi-column layout', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 3 },
            content: [
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 1' }] }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 2' }] }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 3' }] }],
              },
            ],
          },
        ],
      },
    })

    let p1Pos = 0
    let p2Pos = 0
    let p3Pos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Col 1') p1Pos = pos - 1
      if (node.isText && node.text === 'Col 2') p2Pos = pos - 1
      if (node.isText && node.text === 'Col 3') p3Pos = pos - 1
    })

    const ctx1 = getColumnContext(editor, p1Pos)
    expect(ctx1).not.toBeNull()
    expect(ctx1?.isInsideColumn).toBe(true)
    expect(ctx1?.columnIndex).toBe(0)
    expect(ctx1?.isFirstColumn).toBe(true)

    const ctx2 = getColumnContext(editor, p2Pos)
    expect(ctx2).not.toBeNull()
    expect(ctx2?.isInsideColumn).toBe(true)
    expect(ctx2?.columnIndex).toBe(1)
    expect(ctx2?.isFirstColumn).toBe(false)

    const ctx3 = getColumnContext(editor, p3Pos)
    expect(ctx3).not.toBeNull()
    expect(ctx3?.isInsideColumn).toBe(true)
    expect(ctx3?.columnIndex).toBe(2)
    expect(ctx3?.isFirstColumn).toBe(false)

    editor.destroy()
    element.remove()
  })

  it('gutter bounds for non-first column stay local and do not use far-left document gutter', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 2 },
            content: [
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Left' }] }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Right' }] }],
              },
            ],
          },
        ],
      },
    })

    let p2Pos = 0
    let p2Node = editor.state.doc.child(0).child(1).child(0)
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Right') {
        p2Pos = pos - 1
        p2Node = editor.state.doc.nodeAt(pos - 1)!
      }
    })

    const dummyTarget: BlockTarget = {
      node: p2Node,
      pos: p2Pos,
      rect: new DOMRect(400, 100, 200, 30),
      controlRect: new DOMRect(400, 100, 200, 30),
    }

    const bounds = gutterBoundsForTarget(editor, dummyTarget)
    // Non-first column gutter should start near the column (400 - 68 = 332) rather than document edge (400 - 96 = 304)
    expect(bounds.left).toBeGreaterThanOrEqual(332)
    expect(bounds.left + bounds.width).toBe(404)

    editor.destroy()
    element.remove()
  })

  it('excludes Columns 2-5 from the + block replacement/insertion dropdown commands', () => {
    const columnsInInsertMenu = insertBlockCommands.filter((cmd) => cmd.id.startsWith('columns-'))
    expect(columnsInInsertMenu).toHaveLength(0)
    // Common blocks should still be present in the + menu
    expect(insertBlockCommands.some((cmd) => cmd.id === 'h1')).toBe(true)
    expect(insertBlockCommands.some((cmd) => cmd.id === 'bullet')).toBe(true)
    expect(insertBlockCommands.some((cmd) => cmd.id === 'callout')).toBe(true)
  })

  it('supports replacing an empty paragraph inside a column with a supported block', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Heading, Text, Columns, Column, Callout],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 2 },
            content: [
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Left' }] }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph' }],
              },
            ],
          },
        ],
      },
    })

    // Find the empty paragraph in column 2
    let emptyCol2Pos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.content.size === 0) {
        emptyCol2Pos = pos
      }
    })

    // Replace empty paragraph in column 2 with Heading 2
    editor.chain().focus().setTextSelection(emptyCol2Pos + 1).setHeading({ level: 2 }).run()

    const col2 = editor.state.doc.child(0).child(1)
    expect(col2.childCount).toBe(1)
    expect(col2.child(0).type.name).toBe('heading')
    expect(col2.child(0).attrs.level).toBe(2)

    editor.destroy()
    element.remove()
  })

  it('navigates from column 1 to column 2 on Tab', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 3 },
            content: [
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 1 text' }] }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 2 text' }] }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 3 text' }] }],
              },
            ],
          },
        ],
      },
    })

    // Focus inside column 1
    editor.chain().setTextSelection(3).run()

    const shortcuts = Columns.config.addKeyboardShortcuts?.call({ editor } as never)
    const handledTab = shortcuts?.['Tab']?.({ editor, state: editor.state, dispatch: editor.view.dispatch } as never)
    expect(handledTab).toBe(true)

    // Selection should now be inside column 2
    let insideColIndex = -1
    const { $from } = editor.state.selection
    for (let d = $from.depth; d > 0; d -= 1) {
      if ($from.node(d).type.name === 'column') {
        const colPos = $from.before(d)
        const $col = editor.state.doc.resolve(colPos)
        if ($col.parent.type.name === 'columns') {
          insideColIndex = $col.index()
        }
      }
    }
    expect(insideColIndex).toBe(1) // Column 2 (0-indexed: 1)

    // Press Tab again -> moves to Column 3
    const handledTab2 = shortcuts?.['Tab']?.({ editor, state: editor.state, dispatch: editor.view.dispatch } as never)
    expect(handledTab2).toBe(true)

    let insideColIndex2 = -1
    const from2 = editor.state.selection.$from
    for (let d = from2.depth; d > 0; d -= 1) {
      if (from2.node(d).type.name === 'column') {
        const colPos = from2.before(d)
        const $col = editor.state.doc.resolve(colPos)
        if ($col.parent.type.name === 'columns') {
          insideColIndex2 = $col.index()
        }
      }
    }
    expect(insideColIndex2).toBe(2) // Column 3 (0-indexed: 2)

    // Press Shift-Tab -> moves back to Column 2
    const handledShiftTab = shortcuts?.['Shift-Tab']?.({ editor, state: editor.state, dispatch: editor.view.dispatch } as never)
    expect(handledShiftTab).toBe(true)

    let insideColIndex3 = -1
    const from3 = editor.state.selection.$from
    for (let d = from3.depth; d > 0; d -= 1) {
      if (from3.node(d).type.name === 'column') {
        const colPos = from3.before(d)
        const $col = editor.state.doc.resolve(colPos)
        if ($col.parent.type.name === 'columns') {
          insideColIndex3 = $col.index()
        }
      }
    }
    expect(insideColIndex3).toBe(1) // Column 2

    editor.destroy()
    element.remove()
  })

  it('exits to a block below columns when pressing Tab in the last column', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 2 },
            content: [
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 1' }] }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 2' }] }],
              },
            ],
          },
        ],
      },
    })

    // Find position inside column 2
    let col2TextPos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Col 2') {
        col2TextPos = pos
      }
    })
    editor.chain().setTextSelection(col2TextPos + 1).run()

    // Press Tab in last column
    const shortcuts = Columns.config.addKeyboardShortcuts?.call({ editor } as never)
    const handled = shortcuts?.['Tab']?.({ editor, state: editor.state, dispatch: editor.view.dispatch } as never)
    expect(handled).toBe(true)

    // Document should now have a paragraph after columns and caret should be in it
    expect(editor.state.doc.childCount).toBe(2)
    expect(editor.state.doc.child(1).type.name).toBe('paragraph')
    expect(editor.state.selection.$from.depth).toBe(1)
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')

    editor.destroy()
    element.remove()
  })

  it('deletes a column from a 3-column layout, reducing to 2 columns with count: 2', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 3 },
            content: [
              { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 1' }] }] },
              { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 2' }] }] },
              { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 3' }] }] },
            ],
          },
        ],
      },
    })

    // Find position inside column 2
    let col2Pos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Col 2') {
        col2Pos = pos
      }
    })

    const deleted = deleteColumnAt(editor, col2Pos)
    expect(deleted).toBe(true)

    // Columns node should now have count 2 and 2 children (Col 1 and Col 3)
    const columnsNode = editor.state.doc.child(0)
    expect(columnsNode.type.name).toBe('columns')
    expect(columnsNode.attrs.count).toBe(2)
    expect(columnsNode.childCount).toBe(2)
    expect(editor.state.doc.textContent).toContain('Col 1')
    expect(editor.state.doc.textContent).toContain('Col 3')
    expect(editor.state.doc.textContent).not.toContain('Col 2')

    editor.destroy()
    element.remove()
  })

  it('deletes a column from a 2-column layout, unwrapping remaining column into full-width document', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, Columns, Column],
      content: {
        type: 'doc',
        content: [
          {
            type: 'columns',
            attrs: { count: 2 },
            content: [
              { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 1' }] }] },
              { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 2' }] }] },
            ],
          },
        ],
      },
    })

    // Find position inside column 1
    let col1Pos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Col 1') {
        col1Pos = pos
      }
    })

    const deleted = deleteColumnAt(editor, col1Pos)
    expect(deleted).toBe(true)

    // Columns container should be gone completely; doc should contain direct paragraph 'Col 2'
    expect(editor.state.doc.child(0).type.name).toBe('paragraph')
    expect(editor.state.doc.textContent).toBe('Col 2')

    editor.destroy()
    element.remove()
  })
})
