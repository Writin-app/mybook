// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it, afterEach } from 'vitest'
import {
  BlockAutoCapitalize,
  capitalizeFirstLetter,
  capitalizeFirstLetterInTextblock,
} from './BlockAutoCapitalize'

describe('BlockAutoCapitalize', () => {
  let editor: Editor | null = null

  afterEach(() => {
    editor?.destroy()
    editor = null
  })

  describe('capitalizeFirstLetter', () => {
    it('capitalizes a simple lowercase word', () => {
      expect(capitalizeFirstLetter('hello')).toBe('Hello')
    })

    it('leaves already capitalized text unchanged', () => {
      expect(capitalizeFirstLetter('Hello world')).toBe('Hello world')
    })

    it('capitalizes first letter when leading whitespace is present', () => {
      expect(capitalizeFirstLetter('   hello')).toBe('   Hello')
    })

    it('capitalizes first letter when leading punctuation or symbols are present', () => {
      expect(capitalizeFirstLetter('(hello)')).toBe('(Hello)')
      expect(capitalizeFirstLetter('"quoted"')).toBe('"Quoted"')
      expect(capitalizeFirstLetter('123 hello')).toBe('123 Hello')
      expect(capitalizeFirstLetter('# heading')).toBe('# Heading')
    })

    it('returns original string when no letters are present', () => {
      expect(capitalizeFirstLetter('')).toBe('')
      expect(capitalizeFirstLetter('12345')).toBe('12345')
      expect(capitalizeFirstLetter('---')).toBe('---')
    })

    it('handles unicode and accented letters correctly', () => {
      expect(capitalizeFirstLetter('café')).toBe('Café')
      expect(capitalizeFirstLetter('über')).toBe('Über')
      expect(capitalizeFirstLetter('привет')).toBe('Привет')
    })
  })

  describe('Editor typing auto-capitalization', () => {
    const createTestEditor = (content = '<p></p>') => {
      const container = document.body.appendChild(document.createElement('div'))
      return new Editor({
        element: container,
        extensions: [
          StarterKit,
          BlockAutoCapitalize,
        ],
        content,
      })
    }

    const triggerTextInput = (ed: Editor, from: number, to: number, text: string) => {
      return ed.view.someProp('handleTextInput', (fn) =>
        fn(ed.view, from, to, text, () => ed.state.tr.insertText(text, from, to))
      )
    }

    it('capitalizes the first letter typed in an empty paragraph', () => {
      editor = createTestEditor('<p></p>')
      editor.commands.setTextSelection(1)

      const handled = triggerTextInput(editor, 1, 1, 'h')

      expect(handled).toBe(true)
      expect(editor.getText()).toBe('H')
    })

    it('does not capitalize subsequent letters in the same block', () => {
      editor = createTestEditor('<p></p>')
      editor.commands.setTextSelection(1)

      // Type 'h'
      triggerTextInput(editor, 1, 1, 'h')
      expect(editor.getText()).toBe('H')

      // Type 'e' at position 2
      editor.commands.setTextSelection(2)
      const handled = triggerTextInput(editor, 2, 2, 'e')
      // 'handleTextInput' returns false for subsequent letters because a letter already precedes
      expect(Boolean(handled)).toBe(false)
    })

    it('capitalizes the first letter typed in an empty heading', () => {
      editor = createTestEditor('<h1></h1><p>Next</p>')
      editor.commands.setTextSelection(1)

      const handled = triggerTextInput(editor, 1, 1, 'm')
      expect(handled).toBe(true)
      expect(editor.state.doc.child(0).textContent).toBe('M')
    })

    it('does NOT capitalize inside a code block', () => {
      editor = createTestEditor('<pre><code>test</code></pre><p>Next</p>')
      editor.commands.setTextSelection(2)

      const handled = triggerTextInput(editor, 2, 2, 'c')
      expect(Boolean(handled)).toBe(false)
    })

    it('capitalizes the first letter when leading spaces precede it in the block', () => {
      editor = createTestEditor('<p></p>')
      editor.commands.insertContent('   ')
      const pos = editor.state.doc.content.size - 1

      const handled = triggerTextInput(editor, pos, pos, 'w')
      expect(handled).toBe(true)
      expect(editor.getText()).toBe('   W')
    })

    it('allows manual lowercase override if the user backspaces and re-types', () => {
      editor = createTestEditor('<p></p>')
      editor.commands.setTextSelection(1)

      // 1. User types 'i' -> auto-capitalizes to 'I'
      const handled1 = triggerTextInput(editor, 1, 1, 'i')
      expect(handled1).toBe(true)
      expect(editor.getText()).toBe('I')

      // 2. User presses Backspace to delete 'I'
      editor.view.someProp('handleKeyDown', (fn) => fn(editor!.view, new KeyboardEvent('keydown', { key: 'Backspace' })))
      editor.commands.deleteRange({ from: 1, to: 2 })
      expect(editor.getText()).toBe('')

      // 3. User types 'i' again at pos 1 -> should allow lowercase
      const handled2 = triggerTextInput(editor, 1, 1, 'i')
      expect(Boolean(handled2)).toBe(false) // Returned false so ProseMirror default inserts lowercase 'i'
    })
  })

  describe('Pasting auto-capitalization', () => {
    it('capitalizes textblock nodes using capitalizeFirstLetterInTextblock', () => {
      editor = new Editor({
        extensions: [StarterKit],
        content: '<p>lowercase start</p>',
      })

      const node = editor.state.doc.child(0)
      const capitalized = capitalizeFirstLetterInTextblock(node, editor.schema)
      expect(capitalized.textContent).toBe('Lowercase start')
    })

    it('does not modify codeBlock nodes in capitalizeFirstLetterInTextblock', () => {
      editor = new Editor({
        extensions: [StarterKit],
        content: '<pre><code>const x = 1</code></pre>',
      })

      const node = editor.state.doc.child(0)
      const result = capitalizeFirstLetterInTextblock(node, editor.schema)
      expect(result.textContent).toBe('const x = 1')
    })
  })
})
