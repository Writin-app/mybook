// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'

import { CodeBlock } from './CodeBlock'
import { detectCodeLanguage } from './CodeBlockLanguage'

describe('detectCodeLanguage', () => {
  it.each([
    ['javascript', 'const value = 1\nconsole.log(value)'],
    ['python', 'def greet(name):\n    print(name)'],
    ['html', '<main><h1>Hello</h1></main>'],
    ['css', '.title {\n  color: red;\n}'],
    ['json', '{ "name": "MyBook", "enabled": true }'],
  ])('detects %s snippets', (language, code) => {
    expect(detectCodeLanguage(code)).toBe(language)
  })

  it('falls back to plain text when detection is uncertain', () => {
    expect(detectCodeLanguage('just a short note')).toBe('text')
  })
})

describe('CodeBlock keyboard shortcuts', () => {
  it('selects only the code block content on Ctrl+A/Cmd+A when cursor is inside code block', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, CodeBlock],
      content: '<p>Before</p><pre><code>const a = 1;\nconst b = 2;</code></pre><p>After</p>',
    })

    // Place cursor in the middle of code block
    // <p>Before</p> is 0..8
    // <pre><code> is 9..35
    // <p>After</p> is 36..43
    editor.commands.setTextSelection(15)

    const ext = editor.extensionManager.extensions.find((e) => e.name === 'codeBlock')
    const shortcuts = ext?.config.addKeyboardShortcuts?.bind(ext as never)?.()

    const handled = shortcuts?.['Mod-a']?.({ editor })
    expect(handled).toBe(true)
    expect(editor.state.selection.from).toBe(9)
    expect(editor.state.selection.to).toBe(34)
    expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toBe('const a = 1;\nconst b = 2;')

    // Pressing it again when already fully selected should return false to allow full document select-all
    const handledAgain = shortcuts?.['Mod-a']?.({ editor })
    expect(handledAgain).toBe(false)

    editor.destroy()
    element.remove()
  })

  it('returns false on Ctrl+A/Cmd+A when cursor is not inside code block', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, CodeBlock],
      content: '<p>Paragraph text</p><pre><code>code here</code></pre>',
    })

    editor.commands.setTextSelection(3) // Inside paragraph

    const ext = editor.extensionManager.extensions.find((e) => e.name === 'codeBlock')
    const shortcuts = ext?.config.addKeyboardShortcuts?.bind(ext as never)?.()

    const handled = shortcuts?.['Mod-a']?.({ editor })
    expect(handled).toBe(false)

    editor.destroy()
    element.remove()
  })
})


describe('CodeBlock empty block caret', () => {
  it('re-syncs the editor focus when an empty code block receives the caret', () => {
    vi.useFakeTimers()
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, CodeBlock],
      content: '<p>Hello</p><p></p>',
    })
    editor.commands.focus('end')
    vi.runAllTimers()
    const hasFocus = vi.spyOn(editor.view, 'hasFocus').mockReturnValue(true)
    const focus = vi.spyOn(editor.view, 'focus').mockImplementation(() => undefined)

    const { state, view } = editor
    view.dispatch(state.tr.setBlockType(state.selection.from, state.selection.to, state.schema.nodes.codeBlock!))
    vi.runAllTimers()

    expect(editor.state.selection.$from.parent.type.name).toBe('codeBlock')
    expect(focus).toHaveBeenCalledTimes(1)

    hasFocus.mockRestore()
    editor.destroy()
    element.remove()
    vi.useRealTimers()
  })
})
