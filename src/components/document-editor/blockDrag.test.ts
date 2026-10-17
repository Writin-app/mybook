// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

import { movableBlockAt } from './blockDrag'

const createEditor = (content: string) => new Editor({ element: document.createElement('div'), extensions: [StarterKit], content })

describe('movableBlockAt', () => {
  it('resolves a paragraph inside a list item to the whole list', () => {
    const editor = createEditor('<p>Intro</p><ul><li><p>one</p></li><li><p>two</p></li></ul>')
    const listPos = editor.state.doc.child(0).nodeSize
    const innerParagraphPos = listPos + 2

    const block = movableBlockAt(editor.state.doc, innerParagraphPos)
    expect(block?.node.type.name).toBe('bulletList')
    expect(block?.pos).toBe(listPos)
    editor.destroy()
  })

  it('resolves a paragraph inside a blockquote to the blockquote', () => {
    const editor = createEditor('<blockquote><p>quoted</p></blockquote><p>after</p>')
    const block = movableBlockAt(editor.state.doc, 1)
    expect(block?.node.type.name).toBe('blockquote')
    expect(block?.pos).toBe(0)
    editor.destroy()
  })

  it('returns null for a block already at the top level', () => {
    const editor = createEditor('<p>first</p><h2>second</h2>')
    const headingPos = editor.state.doc.child(0).nodeSize
    const block = movableBlockAt(editor.state.doc, headingPos)
    expect(block).toBeNull()
    editor.destroy()
  })
})
