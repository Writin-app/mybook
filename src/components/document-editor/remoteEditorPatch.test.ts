// @vitest-environment jsdom
import { Editor, type Content, type JSONContent } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'

import { Callout } from './extensions/Callout'
import { DatabaseBlock } from './extensions/DatabaseBlock'
import { applyRemoteDocumentPatch } from './remoteEditorPatch'

describe('remoteEditorPatch: Non-destructive remote editor updates', () => {
  const createTestEditor = (content: Content) =>
    new Editor({
      extensions: [StarterKit, TableKit, Callout, DatabaseBlock],
      content,
    })

  it('preserves caret position when remote edit occurs before the selection', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph One' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph Two' }] },
      ],
    })

    // Place caret in Paragraph Two at offset 5 ("Parag|raph Two")
    // P1 starts at 0, size 15 (<p>Paragraph One</p>). P2 starts at 15.
    // Inside P2 text: pos 16 + 5 = 21.
    editor.commands.setTextSelection(21)
    const caretBefore = editor.state.selection.from
    expect(editor.state.doc.textBetween(caretBefore - 5, caretBefore)).toBe('Parag')

    // Remote edit prepends "HEADER: " to Paragraph One (grows by 8 characters)
    const remoteContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'HEADER: Paragraph One' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph Two' }] },
      ],
    }

    const result = applyRemoteDocumentPatch(editor, remoteContent)
    expect(result.applied).toBe(true)
    expect(result.changed).toBe(true)

    // Caret must shift by exactly +8 characters
    const caretAfter = editor.state.selection.from
    expect(caretAfter).toBe(caretBefore + 8)

    // Text immediately preceding caret must still be "Parag"
    expect(editor.state.doc.textBetween(caretAfter - 5, caretAfter)).toBe('Parag')

    editor.destroy()
  })

  it('preserves caret position when remote edit occurs after the selection', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph One' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph Two' }] },
      ],
    })

    // Place caret in Paragraph One at offset 5 ("Parag|raph One")
    editor.commands.setTextSelection(6)
    const caretBefore = editor.state.selection.from
    expect(editor.state.doc.textBetween(caretBefore - 5, caretBefore)).toBe('Parag')

    // Remote edit appends "FOOTER" to Paragraph Two
    const remoteContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph One' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph Two - FOOTER' }] },
      ],
    }

    const result = applyRemoteDocumentPatch(editor, remoteContent)
    expect(result.applied).toBe(true)
    expect(result.changed).toBe(true)

    // Caret must not move at all
    expect(editor.state.selection.from).toBe(caretBefore)
    expect(editor.state.doc.textBetween(editor.state.selection.from - 5, editor.state.selection.from)).toBe('Parag')

    editor.destroy()
  })

  it('preserves local typing and undo/redo history without pollution', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph One' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph Two' }] },
      ],
    })

    // User types in Paragraph Two
    editor.commands.setTextSelection(21)
    editor.commands.insertContent('LOCAL ')
    expect(editor.can().undo()).toBe(true)
    expect(editor.getText()).toContain('LOCAL')

    // Merged incoming content: P1 has remote edit, P2 has local typing
    const mergedContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'REMOTE P1' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'ParagLOCAL raph Two' }] },
      ],
    }

    const result = applyRemoteDocumentPatch(editor, mergedContent)
    expect(result.applied).toBe(true)

    // Verify both remote change and local typing are present
    expect(editor.getText()).toContain('REMOTE P1')
    expect(editor.getText()).toContain('LOCAL')

    // Undo should undo ONLY local typing ('LOCAL '), not the remote edit!
    expect(editor.can().undo()).toBe(true)
    editor.commands.undo()
    expect(editor.getText()).toContain('REMOTE P1')
    expect(editor.getText()).not.toContain('LOCAL')

    // Redo should restore local typing ('LOCAL ')
    expect(editor.can().redo()).toBe(true)
    editor.commands.redo()
    expect(editor.getText()).toContain('REMOTE P1')
    expect(editor.getText()).toContain('LOCAL')

    editor.destroy()
  })

  it('preserves selection across inline marks (bold, italic)', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph One' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Normal ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'BOLD_TEXT' },
            { type: 'text', text: ' End' },
          ],
        },
      ],
    })

    // Select "BOLD" inside "BOLD_TEXT"
    // P1: 15. P2 starts at 15. "Normal " has 7 chars (16..23).
    // "BOLD_TEXT" starts at 23. Select from 23 to 27 ("BOLD").
    editor.commands.setTextSelection({ from: 23, to: 27 })
    expect(editor.state.doc.textBetween(23, 27)).toBe('BOLD')

    // Remote update adds a new paragraph at start
    const remoteContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Top Paragraph' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph One' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Normal ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'BOLD_TEXT' },
            { type: 'text', text: ' End' },
          ],
        },
      ],
    }

    const result = applyRemoteDocumentPatch(editor, remoteContent)
    expect(result.applied).toBe(true)

    // Selection must track the bold text in its new position
    const { from, to } = editor.state.selection
    expect(editor.state.doc.textBetween(from, to)).toBe('BOLD')

    editor.destroy()
  })

  it('preserves custom blocks and attributes with 100% fidelity', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        {
          type: 'callout',
          attrs: { kind: 'warning' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Warning message' }] }],
        },
        {
          type: 'databaseBlock',
          attrs: { id: 'db-456', title: 'Clients' },
        },
      ],
    })

    // Remote edit modifies callout text and appends a paragraph
    const remoteContent = {
      type: 'doc',
      content: [
        {
          type: 'callout',
          attrs: { kind: 'warning' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Warning message - UPDATED' }] }],
        },
        {
          type: 'databaseBlock',
          attrs: { id: 'db-456', title: 'Clients' },
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'New footer' }],
        },
      ],
    }

    const result = applyRemoteDocumentPatch(editor, remoteContent)
    expect(result.applied).toBe(true)

    const json = editor.getJSON()
    const callout = json.content?.find((n) => n.type === 'callout')
    expect(callout?.attrs?.kind).toBe('warning')

    const db = json.content?.find((n) => n.type === 'databaseBlock')
    expect(db?.attrs?.id).toBe('db-456')
    expect(db?.attrs?.title).toBe('Clients')

    editor.destroy()
  })

  it('handles rapid sequential remote updates without state desynchronization', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Initial' }] }],
    })

    for (let i = 1; i <= 5; i += 1) {
      const res = applyRemoteDocumentPatch(editor, {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: `Step ${i}` }] },
          { type: 'paragraph', content: [{ type: 'text', text: `Extra ${i}` }] },
        ],
      })
      expect(res.applied).toBe(true)
      expect(editor.getText()).toContain(`Step ${i}`)
      expect(editor.getText()).toContain(`Extra ${i}`)
    }

    editor.destroy()
  })

  it('safely rejects incompatible or invalid document schemas with error result', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Safe content' }] }],
    })

    // Invalid content node with nonexistent type
    const invalidContent = {
      type: 'doc',
      content: [{ type: 'nonExistentNodeTypeXYZ', content: [] }],
    }

    const result = applyRemoteDocumentPatch(editor, invalidContent as unknown as JSONContent)
    expect(result.applied).toBe(false)
    expect(result.error).toBeDefined()
    // Document should be completely unchanged
    expect(editor.getText()).toBe('Safe content')

    editor.destroy()
  })

  it('preserves table structure and cell content when patch arrives', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Top note' }] },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell A1' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell B1' }] }] },
              ],
            },
          ],
        },
      ],
    })

    // Place selection inside Cell B1
    editor.commands.setTextSelection(18)

    // Remote patch prepends a paragraph at the top
    const remoteContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Added title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Top note' }] },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell A1' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell B1' }] }] },
              ],
            },
          ],
        },
      ],
    }

    const result = applyRemoteDocumentPatch(editor, remoteContent)
    expect(result.applied).toBe(true)

    const json = editor.getJSON()
    const table = json.content?.find((n) => n.type === 'table') as JSONContent | undefined
    expect(table).toBeDefined()
    expect(table?.content?.length).toBe(1)
    const row = table?.content?.[0] as JSONContent | undefined
    const cell = row?.content?.[0] as JSONContent | undefined
    const p = cell?.content?.[0] as JSONContent | undefined
    expect(p?.content?.[0]?.text).toBe('Cell A1')

    editor.destroy()
  })

  it('allows active local typing to continue seamlessly across incoming remote patches', () => {
    const editor = createTestEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Section A' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Section B' }] },
      ],
    })

    // User types in Section B
    editor.commands.setTextSelection(18)
    editor.commands.insertContent('Hello ')

    // Remote patch arrives for Section A
    const merged = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Section A - Remote Edit' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Section BHello ' }] },
      ],
    }
    const result = applyRemoteDocumentPatch(editor, merged)
    expect(result.applied).toBe(true)

    // User continues typing immediately after remote patch
    editor.commands.insertContent('World!')
    expect(editor.getText()).toContain('Section BHello World!')
    expect(editor.getText()).toContain('Section A - Remote Edit')

    editor.destroy()
  })

  describe('same-paragraph update safety and preservation', () => {
    it('preserves caret position when remote insertion occurs before caret in the same paragraph', () => {
      const editor = createTestEditor({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Sentence One. Sentence Two.' }] },
        ],
      })

      // Caret placed at start of "Sentence Two" (pos 15: "<p>Sentence One. |Sentence Two.</p>")
      editor.commands.setTextSelection(15)
      const caretBefore = editor.state.selection.from
      expect(editor.state.doc.textBetween(caretBefore, caretBefore + 8)).toBe('Sentence')

      // Remote update inserts "Intro. " (7 chars) at the start of that same paragraph
      const remote = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Intro. Sentence One. Sentence Two.' }] },
        ],
      }

      const res = applyRemoteDocumentPatch(editor, remote)
      expect(res.applied).toBe(true)
      expect(res.changed).toBe(true)

      const caretAfter = editor.state.selection.from
      // Intended caret: 15 + 7 = 22 (immediately before "Sentence Two")
      expect(caretAfter).toBe(22)
      expect(editor.state.doc.textBetween(caretAfter, caretAfter + 8)).toBe('Sentence')

      editor.destroy()
    })

    it('preserves caret position when remote deletion occurs before caret in the same paragraph', () => {
      const editor = createTestEditor({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Intro. Sentence One. Sentence Two.' }] },
        ],
      })

      // Caret placed at start of "Sentence Two"
      // "Intro. Sentence One. " is 7 + 14 = 21 chars. Inside paragraph: pos 1 + 21 = 22.
      editor.commands.setTextSelection(22)
      expect(editor.state.doc.textBetween(22, 30)).toBe('Sentence')

      // Remote update deletes "Intro. " (7 chars)
      const remote = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Sentence One. Sentence Two.' }] },
        ],
      }

      const res = applyRemoteDocumentPatch(editor, remote)
      expect(res.applied).toBe(true)
      expect(res.changed).toBe(true)

      const caretAfter = editor.state.selection.from
      // Intended caret: 22 - 7 = 15 (immediately before "Sentence Two")
      expect(caretAfter).toBe(15)
      expect(editor.state.doc.textBetween(caretAfter, caretAfter + 8)).toBe('Sentence')

      editor.destroy()
    })

    it('preserves selection range across same-paragraph update', () => {
      const editor = createTestEditor({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Sentence One. Sentence Two.' }] },
        ],
      })

      // User selects "Sentence Two" (from pos 15 to 27)
      editor.commands.setTextSelection({ from: 15, to: 27 })
      expect(editor.state.doc.textBetween(15, 27)).toBe('Sentence Two')

      // Remote update changes Sentence One
      const remote = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Changed One. Sentence Two.' }] },
        ],
      }

      const res = applyRemoteDocumentPatch(editor, remote)
      expect(res.applied).toBe(true)

      const selAfter = editor.state.selection
      // Selection must not collapse to an empty cursor
      expect(selAfter.empty).toBe(false)
      expect(editor.state.doc.textBetween(selAfter.from, selAfter.to)).toBe('Sentence Two')

      editor.destroy()
    })

    it('preserves local typing and undo history when remote edits start of paragraph via clean merge', () => {
      const editor = createTestEditor({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Sentence One. Sentence Two.' }] },
        ],
      })

      // User types at the end of Sentence Two
      editor.commands.setTextSelection(28)
      editor.commands.insertContent(' Local edit.')
      expect(editor.getText()).toBe('Sentence One. Sentence Two. Local edit.')

      // Clean 3-way merge incorporates both: Sentence One -> Remote One, end has Local edit.
      const merged = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Remote One. Sentence Two. Local edit.' }] },
        ],
      }

      const res = applyRemoteDocumentPatch(editor, merged)
      expect(res.applied).toBe(true)
      expect(editor.getText()).toBe('Remote One. Sentence Two. Local edit.')

      // User presses undo: only local keystrokes are undone!
      editor.commands.undo()
      expect(editor.getText()).toBe('Remote One. Sentence Two.')

      editor.destroy()
    })

    it('safely rejects ambiguous overlapping updates in focused editor to protect draft', () => {
      const editor = createTestEditor({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Sentence One. Sentence Two.' }] },
        ],
      })

      // User has focused selection over "Sentence One" (pos 1 to 13)
      editor.commands.setTextSelection({ from: 1, to: 13 })
      editor.view.focus()

      // Remote update modifies the exact text under the user's active selection
      const remote = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Conflicting Text. Sentence Two.' }] },
        ],
      }

      const res = applyRemoteDocumentPatch(editor, remote)
      expect(res.applied).toBe(false)
      expect(res.error).toContain('conflicts with active selection')
      // Original text remains safe
      expect(editor.getText()).toBe('Sentence One. Sentence Two.')

      editor.destroy()
    })

    it('preserves inline formatting marks inside a paragraph during a remote prefix insertion', () => {
      const editor = createTestEditor({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Important: ' },
              { type: 'text', marks: [{ type: 'bold' }], text: 'Bold Note' },
            ],
          },
        ],
      })

      // Caret inside Bold Note at pos 16
      editor.commands.setTextSelection(16)

      // Remote update prepends "Prefix - "
      const remote = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Prefix - Important: ' },
              { type: 'text', marks: [{ type: 'bold' }], text: 'Bold Note' },
            ],
          },
        ],
      }

      const res = applyRemoteDocumentPatch(editor, remote)
      expect(res.applied).toBe(true)

      const json = editor.getJSON()
      const p = json.content?.[0] as JSONContent
      const boldNode = p.content?.find((c) => c.marks?.some((m) => m.type === 'bold'))
      expect(boldNode?.text).toBe('Bold Note')

      editor.destroy()
    })

    it('records clear diagnostic information on patch failure and leaves editor draft untouched', () => {
      const editor = createTestEditor({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'My pristine local draft' }] },
        ],
      })

      // Completely invalid schema payload
      const invalidPayload = {
        type: 'doc',
        content: [{ type: 'unrecognizedCustomBlockType404', attrs: {} }],
      }

      const res = applyRemoteDocumentPatch(editor, invalidPayload as unknown as JSONContent)
      expect(res.applied).toBe(false)
      expect(res.changed).toBe(false)
      expect(res.error).toBeDefined()
      expect(res.error).toContain('Failed to construct ProseMirror node')

      // Editor document is completely untouched
      expect(editor.getText()).toBe('My pristine local draft')

      editor.destroy()
    })
  })
})

