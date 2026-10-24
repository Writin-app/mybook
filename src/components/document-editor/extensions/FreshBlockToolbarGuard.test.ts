// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'

import { FRESH_BLOCK_CLASS, FreshBlockToolbarGuard } from './FreshBlockToolbarGuard'
import { ImageBlock, imageBlockNode } from './ImageBlock'

function createEditor() {
  const element = document.body.appendChild(document.createElement('div'))
  const editor = new Editor({
    element,
    extensions: [Document, Paragraph, Text, ImageBlock, FreshBlockToolbarGuard],
    content: '<p>hello</p>',
  })
  return { editor, element }
}

describe('FreshBlockToolbarGuard', () => {
  it('suppresses block toolbars after inserting media until the pointer really moves', () => {
    const { editor, element } = createEditor()
    expect(editor.view.dom.classList.contains(FRESH_BLOCK_CLASS)).toBe(false)

    editor.chain().focus().insertContent([imageBlockNode('https://example.com/a.png', 'a'), { type: 'paragraph' }]).run()
    expect(editor.view.dom.classList.contains(FRESH_BLOCK_CLASS)).toBe(true)

    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }))
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 12, clientY: 11 }))
    expect(editor.view.dom.classList.contains(FRESH_BLOCK_CLASS)).toBe(true)

    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 60, clientY: 60 }))
    expect(editor.view.dom.classList.contains(FRESH_BLOCK_CLASS)).toBe(false)

    editor.destroy()
    element.remove()
  })

  it('is released by a key press and ignores plain text edits', () => {
    const { editor, element } = createEditor()
    editor.chain().focus().insertContent('more text').run()
    expect(editor.view.dom.classList.contains(FRESH_BLOCK_CLASS)).toBe(false)

    editor.chain().focus().insertContent([imageBlockNode('https://example.com/a.png', 'a'), { type: 'paragraph' }]).run()
    expect(editor.view.dom.classList.contains(FRESH_BLOCK_CLASS)).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(editor.view.dom.classList.contains(FRESH_BLOCK_CLASS)).toBe(false)

    editor.destroy()
    element.remove()
  })
})
