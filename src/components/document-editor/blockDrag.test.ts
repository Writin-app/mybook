// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

import { movableBlockAt } from './blockDrag'
import { ToggleBlock } from './extensions/ToggleBlock'

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

  it('resolves a child block inside a toggleBlock to the child block', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, ToggleBlock],
      content: {
        type: 'doc',
        content: [
          {
            type: 'toggleBlock',
            attrs: { title: 'Heading 1', level: 1 },
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'child one' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'child two' }] },
            ],
          },
        ],
      },
    })
    const child1Pos = 1 // inside toggleBlock at pos 0
    const block1 = movableBlockAt(editor.state.doc, child1Pos + 1)
    expect(block1?.node.type.name).toBe('paragraph')
    expect(block1?.pos).toBe(child1Pos)

    const child1Size = editor.state.doc.nodeAt(child1Pos)!.nodeSize
    const child2Pos = child1Pos + child1Size
    const block2 = movableBlockAt(editor.state.doc, child2Pos + 1)
    expect(block2?.node.type.name).toBe('paragraph')
    expect(block2?.pos).toBe(child2Pos)
    editor.destroy()
  })
})
