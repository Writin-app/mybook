// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'

import { getTogglePlaceholder, ToggleBlock, toggleBlockNode } from './ToggleBlock'
import { runSlashCommand } from '../slashCommands'

describe('ToggleBlock', () => {
  it('returns appropriate placeholders for normal toggle and heading levels 1 to 4', () => {
    expect(getTogglePlaceholder(null)).toBe('Toggle')
    expect(getTogglePlaceholder(undefined)).toBe('Toggle')
    expect(getTogglePlaceholder(1)).toBe('Heading 1')
    expect(getTogglePlaceholder(2)).toBe('Heading 2')
    expect(getTogglePlaceholder(3)).toBe('Heading 3')
    expect(getTogglePlaceholder(4)).toBe('Heading 4')
  })

  it('creates toggleBlockNode with null level by default or specified level', () => {
    const defaultNode = toggleBlockNode()
    expect(defaultNode.attrs.level).toBeNull()
    expect(defaultNode.attrs.title).toBe('')

    const h2Node = toggleBlockNode('Custom', 2)
    expect(h2Node.attrs.level).toBe(2)
    expect(h2Node.attrs.title).toBe('Custom')
  })

  it('renders and parses level attribute correctly', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, ToggleBlock],
      content: {
        type: 'doc',
        content: [
          toggleBlockNode('H1 section', 1),
          toggleBlockNode('Normal section', null),
        ],
      },
    })

    const firstNode = editor.state.doc.firstChild
    const secondNode = editor.state.doc.lastChild
    expect(firstNode?.attrs.level).toBe(1)
    expect(secondNode?.attrs.level).toBeNull()

    const detailsElements = element.querySelectorAll('details.mybook-toggle')
    expect(detailsElements.length).toBe(2)
    expect(detailsElements[0]?.getAttribute('data-level')).toBe('1')
    expect(detailsElements[1]?.getAttribute('data-level')).toBeNull()

    const titleInputs = element.querySelectorAll<HTMLInputElement>('input.mybook-toggle-title')
    expect(titleInputs[0]?.placeholder).toBe('Heading 1')
    expect(titleInputs[1]?.placeholder).toBe('Toggle')

    editor.destroy()
    element.remove()
  })

  it('supports changing level via updateAttributes', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, ToggleBlock],
      content: {
        type: 'doc',
        content: [toggleBlockNode('Section', 2)],
      },
    })

    expect(editor.state.doc.firstChild?.attrs.level).toBe(2)

    // Change to level 3
    editor.commands.updateAttributes('toggleBlock', { level: 3 })
    expect(editor.state.doc.firstChild?.attrs.level).toBe(3)

    // Change back to normal toggle (null)
    editor.commands.updateAttributes('toggleBlock', { level: null })
    expect(editor.state.doc.firstChild?.attrs.level).toBeNull()

    editor.destroy()
    element.remove()
  })

  it('inserts toggle with corresponding levels via slash commands', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, ToggleBlock],
      content: '<p></p>',
    })

    // Test toggle-h1
    runSlashCommand(editor, 'toggle-h1', { from: 0, to: 0 })
    expect(editor.state.doc.firstChild?.type.name).toBe('toggleBlock')
    expect(editor.state.doc.firstChild?.attrs.level).toBe(1)

    // Clear and test toggle-h3
    editor.commands.setContent('<p></p>')
    runSlashCommand(editor, 'toggle-h3', { from: 0, to: 0 })
    expect(editor.state.doc.firstChild?.type.name).toBe('toggleBlock')
    expect(editor.state.doc.firstChild?.attrs.level).toBe(3)

    // Clear and test normal toggle
    editor.commands.setContent('<p></p>')
    runSlashCommand(editor, 'toggle', { from: 0, to: 0 })
    expect(editor.state.doc.firstChild?.type.name).toBe('toggleBlock')
    expect(editor.state.doc.firstChild?.attrs.level).toBeNull()

    editor.destroy()
    element.remove()
  })

  it('updates level and removes prefix when typing markdown shortcuts in title input', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, ToggleBlock],
      content: {
        type: 'doc',
        content: [toggleBlockNode('', null)],
      },
    })

    const titleInput = element.querySelector<HTMLInputElement>('input.mybook-toggle-title')
    expect(titleInput).not.toBeNull()
    if (!titleInput) return

    // Type "## " in title input
    titleInput.value = '## My Section'
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))

    expect(editor.state.doc.firstChild?.attrs.level).toBe(2)
    expect(editor.state.doc.firstChild?.attrs.title).toBe('My Section')
    expect(titleInput.value).toBe('My Section')
    expect(titleInput.placeholder).toBe('Heading 2')

    // Type "# " in title input to change to H1
    titleInput.value = '# New Title'
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))

    expect(editor.state.doc.firstChild?.attrs.level).toBe(1)
    expect(editor.state.doc.firstChild?.attrs.title).toBe('New Title')
    expect(titleInput.value).toBe('New Title')
    expect(titleInput.placeholder).toBe('Heading 1')

    editor.destroy()
    element.remove()
  })

  it('preserves toggle block and exits to paragraph on Enter when child is empty', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, ToggleBlock],
      content: {
        type: 'doc',
        content: [toggleBlockNode('My Toggle', null)],
      },
    })

    // Place selection inside the empty child paragraph inside the toggleBlock
    editor.commands.setTextSelection(2)
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    expect(editor.state.selection.$from.parent.content.size).toBe(0)

    // Execute the Enter shortcut defined in ToggleBlock
    const shortcuts = ToggleBlock.config.addKeyboardShortcuts?.call({ editor } as never)
    const handled = shortcuts?.Enter?.({ editor } as never)
    expect(handled).toBe(true)

    // Verify toggleBlock still exists and a new paragraph was inserted after it
    expect(editor.state.doc.childCount).toBe(2)
    expect(editor.state.doc.child(0).type.name).toBe('toggleBlock')
    expect(editor.state.doc.child(0).attrs.title).toBe('My Toggle')
    expect(editor.state.doc.child(1).type.name).toBe('paragraph')

    editor.destroy()
    element.remove()
  })

  it('exits the toggle on Enter when an empty child is between other blocks', () => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [Document, Paragraph, Text, ToggleBlock],
      content: {
        type: 'doc',
        content: [{
          type: 'toggleBlock',
          attrs: { title: 'T', open: true, level: null },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
            { type: 'paragraph' },
            { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
          ],
        }],
      },
    })

    // toggle(0) > p"one"(1..6) > empty p starts at 6, cursor at 7
    editor.commands.setTextSelection(7)
    expect(editor.state.selection.$from.parent.content.size).toBe(0)

    const shortcuts = ToggleBlock.config.addKeyboardShortcuts?.call({ editor } as never)
    expect(shortcuts?.Enter?.({ editor } as never)).toBe(true)

    expect(editor.state.doc.childCount).toBe(2)
    expect(editor.state.doc.child(0).type.name).toBe('toggleBlock')
    expect(editor.state.doc.child(0).childCount).toBe(2)
    expect(editor.state.doc.child(1).type.name).toBe('paragraph')
    expect(editor.state.selection.$from.parent).toBe(editor.state.doc.child(1))

    editor.destroy()
    element.remove()
  })
})
