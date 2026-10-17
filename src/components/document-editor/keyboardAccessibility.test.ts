// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'

import { EditorKeyboardShortcuts } from './extensions/EditorKeyboardShortcuts'
import { Callout } from './extensions/Callout'
import { ToggleBlock } from './extensions/ToggleBlock'
import { FixedTable } from './extensions/FixedTable'
import { StyledTableCell, StyledTableHeader } from './extensions/TableCellStyles'
import { TableInteraction } from './extensions/TableInteraction'

describe('Editor Keyboard Accessibility & Shortcuts', () => {
  const createEditor = (content: string) => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
        TaskList,
        TaskItem.configure({ nested: true }),
        TableKit.configure({ table: false, tableCell: false, tableHeader: false }),
        FixedTable,
        StyledTableCell,
        StyledTableHeader,
        TableInteraction,
        Callout,
        ToggleBlock,
        EditorKeyboardShortcuts,
      ],
      content,
    })
    return {
      editor,
      cleanup: () => {
        editor.destroy()
        element.remove()
      },
    }
  }

  it('indents (nests) bullet list item with sinkListItem', () => {
    const { editor, cleanup } = createEditor('<ul><li><p>First</p></li><li><p>Second</p></li></ul>')
    // Position inside the second list item text
    editor.commands.setTextSelection(12)

    expect(editor.can().sinkListItem('listItem')).toBe(true)
    const result = editor.commands.sinkListItem('listItem')
    expect(result).toBe(true)

    // Check that the second item is now nested inside the first
    expect(editor.getHTML()).toContain('<ul><li><p>First</p><ul><li><p>Second</p></li></ul></li></ul>')
    cleanup()
  })

  it('outdents (lifts) nested bullet list item with liftListItem', () => {
    const { editor, cleanup } = createEditor('<ul><li><p>First</p><ul><li><p>Second</p></li></ul></li></ul>')
    // Position inside the nested second list item
    editor.commands.setTextSelection(14)

    expect(editor.can().liftListItem('listItem')).toBe(true)
    const result = editor.commands.liftListItem('listItem')
    expect(result).toBe(true)

    expect(editor.getHTML()).toContain('<ul><li><p>First</p></li><li><p>Second</p></li></ul>')
    cleanup()
  })

  it('indents (nests) task list item with sinkListItem', () => {
    const { editor, cleanup } = createEditor('<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Task 1</p></li><li data-type="taskItem" data-checked="false"><p>Task 2</p></li></ul>')
    editor.commands.setTextSelection(13)

    expect(editor.can().sinkListItem('taskItem')).toBe(true)
    const result = editor.commands.sinkListItem('taskItem')
    expect(result).toBe(true)

    expect(editor.getHTML()).toContain('Task 1')
    expect(editor.getHTML()).toContain('Task 2')
    cleanup()
  })

  it('outdents (lifts) nested task list item with liftListItem', () => {
    const { editor, cleanup } = createEditor('<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Task 1</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Task 2</p></li></ul></li></ul>')
    editor.commands.setTextSelection(15)

    expect(editor.can().liftListItem('taskItem')).toBe(true)
    const result = editor.commands.liftListItem('taskItem')
    expect(result).toBe(true)
    cleanup()
  })

  it('navigates table cells with goToNextCell and goToPreviousCell', () => {
    const { editor, cleanup } = createEditor('<p>Before</p>')
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false })

    expect(editor.isActive('table')).toBe(true)
    expect(editor.commands.goToNextCell()).toBe(true)
    expect(editor.commands.goToPreviousCell()).toBe(true)
    cleanup()
  })

  it('extends selection only within the current table cell on Mod-Shift-Arrow', () => {
    const { editor, cleanup } = createEditor('<table><tr><td><p>Hello world</p></td><td><p>Next</p></td></tr></table>')
    editor.commands.setTextSelection(4)

    const shortcuts = editor.extensionManager.extensions.find((e) => e.name === 'editorKeyboardShortcuts')
    const handlers = (shortcuts as unknown as { config: { addKeyboardShortcuts: () => Record<string, () => boolean> } }).config.addKeyboardShortcuts.call({ editor })
    expect(handlers['Mod-Shift-ArrowRight']!()).toBe(true)

    const { selection } = editor.state
    expect(selection.constructor.name).toBe('TextSelection')
    expect(selection.$head.parent.textContent).toBe('Hello world')
    expect(selection.head).toBe(selection.$head.end())
    expect(selection.anchor).toBe(4)

    expect(handlers['Mod-Shift-ArrowLeft']!()).toBe(true)
    expect(editor.state.selection.head).toBe(editor.state.selection.$head.start())
    cleanup()
  })

  it('does not handle Mod-Shift-Arrow outside tables', () => {
    const { editor, cleanup } = createEditor('<p>Hello world</p>')
    editor.commands.setTextSelection(3)
    const shortcuts = editor.extensionManager.extensions.find((e) => e.name === 'editorKeyboardShortcuts')
    const handlers = (shortcuts as unknown as { config: { addKeyboardShortcuts: () => Record<string, () => boolean> } }).config.addKeyboardShortcuts.call({ editor })
    expect(handlers['Mod-Shift-ArrowRight']!()).toBe(false)
    cleanup()
  })

  it('collapses a selection inside a table cell on Arrow instead of jumping to the next cell', () => {
    const { editor, cleanup } = createEditor('<table><tr><td><p>Hello world</p></td><td><p>Next</p></td></tr></table>')
    const shortcuts = editor.extensionManager.extensions.find((e) => e.name === 'editorKeyboardShortcuts')
    const handlers = (shortcuts as unknown as { config: { addKeyboardShortcuts: () => Record<string, () => boolean> } }).config.addKeyboardShortcuts.call({ editor })

    editor.commands.setTextSelection({ from: 4, to: 15 })
    const end = editor.state.selection.to
    expect(handlers.ArrowRight!()).toBe(true)
    expect(editor.state.selection.empty).toBe(true)
    expect(editor.state.selection.from).toBe(end)
    expect(editor.state.selection.$from.parent.textContent).toBe('Hello world')

    editor.commands.setTextSelection({ from: 4, to: 15 })
    expect(handlers.ArrowLeft!()).toBe(true)
    expect(editor.state.selection.from).toBe(4)
    cleanup()
  })

  it('toggles formatting marks via Mod shortcuts', () => {
    const { editor, cleanup } = createEditor('<p>Sample Text</p>')
    editor.commands.setTextSelection({ from: 1, to: 7 })

    editor.commands.toggleBold()
    expect(editor.isActive('bold')).toBe(true)

    editor.commands.toggleItalic()
    expect(editor.isActive('italic')).toBe(true)

    editor.commands.toggleUnderline()
    expect(editor.isActive('underline')).toBe(true)

    editor.commands.toggleStrike()
    expect(editor.isActive('strike')).toBe(true)

    editor.commands.toggleCode()
    expect(editor.isActive('code')).toBe(true)

    cleanup()
  })

  it('toggles heading levels 1-4 via heading commands', () => {
    const { editor, cleanup } = createEditor('<p>Heading Title</p>')
    editor.commands.setTextSelection(3)

    editor.commands.toggleHeading({ level: 1 })
    expect(editor.isActive('heading', { level: 1 })).toBe(true)

    editor.commands.toggleHeading({ level: 2 })
    expect(editor.isActive('heading', { level: 2 })).toBe(true)

    editor.commands.toggleHeading({ level: 3 })
    expect(editor.isActive('heading', { level: 3 })).toBe(true)

    editor.commands.toggleHeading({ level: 4 })
    expect(editor.isActive('heading', { level: 4 })).toBe(true)

    editor.commands.setParagraph()
    expect(editor.isActive('paragraph')).toBe(true)

    cleanup()
  })

  it('toggles blockquote and code block via shortcut commands', () => {
    const { editor, cleanup } = createEditor('<p>Block content</p>')
    editor.commands.setTextSelection(3)

    editor.commands.toggleBlockquote()
    expect(editor.isActive('blockquote')).toBe(true)

    editor.commands.setParagraph()
    editor.commands.toggleCodeBlock()
    expect(editor.isActive('codeBlock')).toBe(true)

    cleanup()
  })

  it('steps out of inline code on ArrowRight and ArrowLeft at boundaries', () => {
    const { editor, cleanup } = createEditor('<p><code>test</code></p>')
    // Pos 1 is start of 'test', pos 5 is end of 'test'
    editor.commands.setTextSelection(5)
    expect(editor.isActive('code')).toBe(true)

    const shortcuts = EditorKeyboardShortcuts.config.addKeyboardShortcuts?.call({ editor } as never)
    const rightHandler = shortcuts?.ArrowRight as (() => boolean) | undefined
    expect(rightHandler).toBeDefined()

    // Trigger ArrowRight at trailing boundary of inline code:
    // Moves cursor out (inserts a blank space after the code block) and positions cursor at pos 6
    const steppedOut = rightHandler?.()
    expect(steppedOut).toBe(true)
    expect(editor.state.selection.from).toBe(6)
    // Stored marks should now not include 'code'
    const storedMarks = editor.state.storedMarks ?? []
    expect(storedMarks.some((m) => m.type.name === 'code')).toBe(false)

    // Leading edge test
    editor.commands.setTextSelection(1)
    const leftHandler = shortcuts?.ArrowLeft as (() => boolean) | undefined
    expect(leftHandler).toBeDefined()
    const steppedOutLeft = leftHandler?.()
    expect(steppedOutLeft).toBe(true)
    expect(editor.state.selection.from).toBe(1)

    // Double Space test: type a space inside code, then press Space again
    editor.commands.setContent('<p><code>test</code></p>')
    editor.commands.setTextSelection(5)
    editor.commands.insertContent(' ')
    expect(editor.state.selection.from).toBe(6)

    const spaceHandler = shortcuts?.Space as (() => boolean) | undefined
    expect(spaceHandler).toBeDefined()
    const steppedOutSpace = spaceHandler?.()
    expect(steppedOutSpace).toBe(true)
    // Trailing space inside code is moved outside as plain space, and cursor is at pos 6
    expect(editor.getHTML()).toBe('<p><code>test</code> </p>')
    const spaceStoredMarks = editor.state.storedMarks ?? []
    expect(spaceStoredMarks.some((m) => m.type.name === 'code')).toBe(false)

    cleanup()
  })
})
