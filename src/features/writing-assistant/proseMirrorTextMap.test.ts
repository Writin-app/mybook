// @vitest-environment jsdom
import { Editor, Node as TiptapNode, type Extensions, type JSONContent } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

import { Callout } from '../../components/document-editor/extensions/Callout'
import { Column, Columns } from '../../components/document-editor/extensions/Columns'
import { ToggleBlock } from '../../components/document-editor/extensions/ToggleBlock'
import { buildProseMirrorTextMap, mapDocumentRangeToText, mapTextRangeToDocument } from './proseMirrorTextMap'

const editors: Editor[] = []

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy()
})

function createEditor(content: JSONContent, extensions: Extensions = [StarterKit]) {
  const editor = new Editor({ extensions, content })
  editors.push(editor)
  return editor
}

function mapTarget(map: ReturnType<typeof buildProseMirrorTextMap>, text: string) {
  const start = map.text.indexOf(text)
  if (start < 0) throw new Error(`Target text was not serialized: ${text}`)
  return mapTextRangeToDocument(map, start, start + text.length)
}

describe('ProseMirror text offset mapping', () => {
  it('maps text through paragraphs, headings, lists, tables, toggles, callouts, and columns', () => {
    const extensions = [StarterKit, TableKit, ToggleBlock, Callout, Columns, Column]
    const editor = createEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Heading target' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'List target' }] }] }] },
        { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell target' }] }] }] }] },
        { type: 'toggleBlock', attrs: { title: 'Toggle title' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Toggle body' }] }] },
        { type: 'callout', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Callout body' }] }] },
        { type: 'columns', content: [
          { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Left column' }] }] },
          { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Right column' }] }] },
        ] },
      ],
    }, extensions)

    const map = buildProseMirrorTextMap(editor.state.doc)
    expect(map.text).toBe(editor.getText())

    for (const target of ['First paragraph', 'Heading target', 'List target', 'Cell target', 'Toggle body', 'Callout body', 'Left column', 'Right column']) {
      const range = mapTarget(map, target)
      expect(range).not.toBeNull()
      expect(editor.state.doc.textBetween(range!.from, range!.to)).toBe(target)
    }
  })

  it('maps UTF-16 offsets after emoji and hard breaks and rejects a range crossing the break', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [
        { type: 'text', text: '😀 before ' },
        { type: 'hardBreak' },
        { type: 'text', text: 'target after break' },
      ] }],
    })
    const map = buildProseMirrorTextMap(editor.state.doc)
    expect(map.text).toBe(editor.getText())

    const target = mapTarget(map, 'target')
    expect(target).not.toBeNull()
    expect(editor.state.doc.textBetween(target!.from, target!.to)).toBe('target')

    const beforeStart = map.text.indexOf('before')
    const afterEnd = map.text.indexOf('target') + 'target'.length
    expect(mapTextRangeToDocument(map, beforeStart, afterEnd)).toBeNull()
  })

  it('rejects paragraph separators while mapping text on each side independently', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Alpha' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Beta' }] },
      ],
    })
    const map = buildProseMirrorTextMap(editor.state.doc)
    expect(map.text).toBe('Alpha\n\nBeta')
    expect(mapTarget(map, 'Alpha')).not.toBeNull()
    expect(mapTarget(map, 'Beta')).not.toBeNull()
    expect(mapTextRangeToDocument(map, 3, 8)).toBeNull()
  })

  it('rejects custom serialized node output but maps adjacent ordinary text', () => {
    const SerializedInlineNode = TiptapNode.create({
      name: 'serializedInlineNode',
      group: 'inline',
      inline: true,
      atom: true,
      renderText: () => 'custom display text',
      renderHTML: () => ['span', { 'data-test-node': 'serialized' }, 'custom display text'],
    })
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'before ' },
        { type: 'serializedInlineNode' },
        { type: 'text', text: ' after' },
      ] }],
    }, [StarterKit, SerializedInlineNode])
    const map = buildProseMirrorTextMap(editor.state.doc)
    expect(map.text).toBe(editor.getText())

    expect(mapTarget(map, 'custom display')).toBeNull()
    const after = mapTarget(map, 'after')
    expect(after).not.toBeNull()
    expect(editor.state.doc.textBetween(after!.from, after!.to)).toBe('after')
  })

  it('returns null for invalid or out-of-bounds UTF-16 ranges', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'target' }] }],
    })
    const map = buildProseMirrorTextMap(editor.state.doc)

    expect(mapTextRangeToDocument(map, -1, 2)).toBeNull()
    expect(mapTextRangeToDocument(map, 1.5, 3)).toBeNull()
    expect(mapTextRangeToDocument(map, 2, 2)).toBeNull()
    expect(mapTextRangeToDocument(map, 0, map.text.length + 1)).toBeNull()
  })

  it('maps a selected ProseMirror range back to UTF-16 source offsets after Unicode text', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '😀 नमस्ते cafe\u0301 target' }] }],
    })
    const map = buildProseMirrorTextMap(editor.state.doc)
    const start = map.text.indexOf('target')
    const documentRange = mapTextRangeToDocument(map, start, start + 'target'.length)!

    expect(mapDocumentRangeToText(map, documentRange.from, documentRange.to)).toEqual({ start, end: start + 6 })
    expect(map.text.slice(start, start + 6)).toBe('target')
  })

  it('maps selected text endpoints across paragraphs while keeping separators in the source snapshot', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'first selected' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'text last' }] },
      ],
    })
    const map = buildProseMirrorTextMap(editor.state.doc)
    const first = map.text.indexOf('selected')
    const last = map.text.indexOf('last') + 4
    const from = mapTextRangeToDocument(map, first, first + 1)!.from
    const to = mapTextRangeToDocument(map, last - 1, last)!.to

    expect(mapDocumentRangeToText(map, from, to)).toEqual({ start: first, end: last })
    expect(map.text.slice(first, last)).toBe('selected\n\ntext last')
  })

  it('rejects selection endpoints inside unmappable serialized node output', () => {
    const SerializedInlineNode = TiptapNode.create({
      name: 'serializedInlineNode',
      group: 'inline',
      inline: true,
      atom: true,
      renderText: () => 'custom display text',
      renderHTML: () => ['span', {}, 'custom display text'],
    })
    const editor = createEditor({ type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'before ' }, { type: 'serializedInlineNode' }, { type: 'text', text: ' after' },
    ] }] }, [StarterKit, SerializedInlineNode])
    const map = buildProseMirrorTextMap(editor.state.doc)
    const customStart = map.text.indexOf('custom')
    const customRange = mapTextRangeToDocument(map, customStart, customStart + 1)

    expect(customRange).toBeNull()
  })
})
