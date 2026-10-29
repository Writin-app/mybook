// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { EditorKeyboardShortcuts } from './EditorKeyboardShortcuts'

function getEnterShortcut(editor: Editor) {
  const shortcuts = EditorKeyboardShortcuts.config.addKeyboardShortcuts?.call({ editor } as never)
  return () => (shortcuts?.Enter ? shortcuts.Enter({ editor } as never) : false)
}

describe('EditorKeyboardShortcuts Enter behavior', () => {
  it('exits inline code formatting when pressing Enter twice from inline code text', () => {
    const editor = new Editor({
      extensions: [StarterKit, EditorKeyboardShortcuts],
      content: '<p><code>const a = 1</code></p>',
    })
    const pressEnter = getEnterShortcut(editor)

    // Position at end of inline code text (pos 12)
    editor.commands.setTextSelection(12)
    expect(editor.isActive('code')).toBe(true)

    // First Enter: paragraph has content, so shortcut returns false and standard splitBlock runs
    const handledFirst = pressEnter()
    expect(handledFirst).toBe(false)
    editor.commands.splitBlock()

    // Cursor is now on empty row 2
    expect(editor.state.doc.childCount).toBe(2)
    expect(editor.state.doc.child(1).content.size).toBe(0)
    expect(editor.isActive('code')).toBe(true)

    // Second Enter: paragraph is empty with active code, shortcut handles it
    const handledSecond = pressEnter()
    expect(handledSecond).toBe(true)

    // Cursor moves to row 3 and inline code formatting is deactivated
    expect(editor.state.doc.childCount).toBe(3)
    expect(editor.isActive('code')).toBe(false)
    expect(editor.state.storedMarks?.some((m) => m.type.name === 'code')).toBeFalsy()

    // Typing on row 3 inserts normal text outside inline code
    editor.commands.insertContent('normal text')
    const thirdPara = editor.state.doc.child(2)
    expect(thirdPara.textContent).toBe('normal text')
    expect(thirdPara.firstChild?.marks.some((m) => m.type.name === 'code')).toBe(false)

    editor.destroy()
  })

  it('exits inline code formatting when activating inline code on an empty paragraph and pressing Enter twice', () => {
    const editor = new Editor({
      extensions: [StarterKit, EditorKeyboardShortcuts],
      content: '<p></p>',
    })
    const pressEnter = getEnterShortcut(editor)

    // Activate inline code
    editor.commands.toggleCode()
    expect(editor.isActive('code')).toBe(true)

    // Press Enter once (moves to row 2 and unsets code if already empty)
    const handled = pressEnter()
    expect(handled).toBe(true)
    expect(editor.state.doc.childCount).toBe(2)
    expect(editor.isActive('code')).toBe(false)

    // Typing on the new row produces plain text
    editor.commands.insertContent('hello')
    const secondPara = editor.state.doc.child(1)
    expect(secondPara.textContent).toBe('hello')
    expect(secondPara.firstChild?.marks.some((m) => m.type.name === 'code')).toBe(false)

    editor.destroy()
  })

  it('returns false for normal paragraphs without inline code', () => {
    const editor = new Editor({
      extensions: [StarterKit, EditorKeyboardShortcuts],
      content: '<p>Normal text</p>',
    })
    const pressEnter = getEnterShortcut(editor)

    editor.commands.setTextSelection(12)
    expect(pressEnter()).toBe(false)

    // On an empty normal paragraph without code
    editor.commands.setContent('<p></p>')
    expect(pressEnter()).toBe(false)

    editor.destroy()
  })

  it('returns false when inside a list item or task item', () => {
    const editor = new Editor({
      extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }), EditorKeyboardShortcuts],
      content: '<ul><li><p>List item</p></li></ul>',
    })
    const pressEnter = getEnterShortcut(editor)

    editor.commands.setTextSelection(10)
    expect(pressEnter()).toBe(false)

    // Even if code mark was somehow active in list item
    editor.commands.toggleCode()
    expect(pressEnter()).toBe(false)

    editor.destroy()
  })

  it('safely handles ProseMirror undo exceptions without crashing', () => {
    const editor = new Editor({
      extensions: [StarterKit, EditorKeyboardShortcuts],
      content: '<p>Some content</p>',
    })

    // Mock undo throwing an out-of-range error
    vi.spyOn(editor.commands, 'undo').mockImplementation(() => {
      throw new RangeError('Position 137 out of range')
    })

    const keyboardShortcutsExt = editor.extensionManager.extensions.find(
      (ext) => ext.name === 'editorKeyboardShortcuts',
    )
    const shortcuts = keyboardShortcutsExt?.config.addKeyboardShortcuts?.call({
      editor,
      options: {},
      name: 'editorKeyboardShortcuts',
      storage: {},
      type: null as never,
      parent: undefined,
    })

    const handleModZ = shortcuts?.['Mod-z']
    expect(handleModZ).toBeTypeOf('function')
    // Should catch the RangeError safely without rethrowing
    expect(() => handleModZ?.({ editor } as never)).not.toThrow()
    expect(handleModZ?.({ editor } as never)).toBe(false)

    editor.destroy()
  })
})
