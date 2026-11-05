// @vitest-environment jsdom
import { Editor, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

import {
  createCursorSnapshot,
  createSelectionSnapshot,
  validateAndPrepareCursorInsertion,
  validateAndPrepareSelectionInsertion,
  validateCursorSnapshot,
  validateSelectionSnapshot,
} from './staleProtection'

const editors: Editor[] = []

afterEach(() => {
  for (const editor of editors.splice(0)) {
    editor.destroy()
  }
})

function createEditor(content: JSONContent) {
  const editor = new Editor({
    extensions: [StarterKit],
    content,
  })
  editors.push(editor)
  return editor
}

describe('staleProtection - Selection Snapshot & Validation', () => {
  it('validates a valid unchanged selection', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'The quarterly sprint was completed ahead of schedule with 14 services.' },
          ],
        },
      ],
    })

    // "quarterly sprint" is at range 5 to 21
    const snapshot = createSelectionSnapshot('doc-1', editor.state.doc, { from: 5, to: 21 })
    expect(snapshot.sourceText).toBe('quarterly sprint')
    expect(snapshot.contextAnchor.prefix).toBe('The ')
    expect(snapshot.contextAnchor.suffix.startsWith(' was completed')).toBe(true)

    const result = validateSelectionSnapshot('doc-1', editor.state.doc, snapshot)
    expect(result.status).toBe('valid')
    if (result.status === 'valid') {
      expect(result.targetRange).toEqual({ from: 5, to: 21 })
      expect(result.sourceText).toBe('quarterly sprint')
    }
  })

  it('rejects when active document / file ID changed', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Important project details.' }] }],
    })

    const snapshot = createSelectionSnapshot('doc-1', editor.state.doc, { from: 1, to: 10 })
    const result = validateSelectionSnapshot('doc-2', editor.state.doc, snapshot)

    expect(result.status).toBe('stale')
    if (result.status === 'stale') {
      expect(result.reason).toBe('document-switched')
      expect(result.message).toContain('active document was changed')
    }
  })

  it('rejects an empty selection (from === to)', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Some text content.' }] }],
    })

    const snapshot = createSelectionSnapshot('doc-1', editor.state.doc, { from: 5, to: 5 })
    const result = validateSelectionSnapshot('doc-1', editor.state.doc, snapshot)

    expect(result.status).toBe('stale')
    if (result.status === 'stale') {
      expect(result.reason).toBe('empty-selection')
    }
  })

  it('rejects an invalid range (out of bounds or from > to)', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Short.' }] }],
    })

    const snapshotOut = createSelectionSnapshot('doc-1', editor.state.doc, { from: 5, to: 100 })
    const resultOut = validateSelectionSnapshot('doc-1', editor.state.doc, snapshotOut)
    expect(resultOut.status).toBe('stale')
    if (resultOut.status === 'stale') {
      expect(resultOut.reason).toBe('invalid-range')
    }

    const snapshotInverted = createSelectionSnapshot('doc-1', editor.state.doc, { from: 6, to: 2 })
    const resultInverted = validateSelectionSnapshot('doc-1', editor.state.doc, snapshotInverted)
    expect(resultInverted.status).toBe('stale')
    if (resultInverted.status === 'stale') {
      expect(resultInverted.reason).toBe('invalid-range')
    }
  })

  it('rejects when selected text itself was changed in the document', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The blue car drove fast.' }] }],
    })

    // "blue car" is at 5 to 13
    const snapshot = createSelectionSnapshot('doc-1', editor.state.doc, { from: 5, to: 13 })
    expect(snapshot.sourceText).toBe('blue car')

    // Edit the text inside the selection range
    editor.chain().focus().insertContentAt({ from: 5, to: 9 }, 'red').run()
    // Document is now: "The red car drove fast."

    const result = validateSelectionSnapshot('doc-1', editor.state.doc, snapshot)
    expect(result.status).toBe('stale')
    if (result.status === 'stale') {
      expect(result.reason).toBe('text-changed')
    }
  })

  it('rejects when text before the selection was changed', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First phase completed successfully.' }] }],
    })

    // "completed" is at 13 to 22
    const snapshot = createSelectionSnapshot('doc-1', editor.state.doc, { from: 13, to: 22 })
    expect(snapshot.sourceText).toBe('completed')
    expect(snapshot.contextAnchor.prefix).toBe('First phase ')

    // Insert text before the selection
    editor.chain().focus().insertContentAt(1, 'Initial ').run()
    // "Initial First phase completed successfully."

    const result = validateSelectionSnapshot('doc-1', editor.state.doc, snapshot)
    expect(result.status).toBe('stale')
    if (result.status === 'stale') {
      expect(['text-changed', 'context-changed', 'document-modified']).toContain(result.reason)
    }
  })

  it('rejects when text after the selection was changed', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Important heading and notes.' }] }],
    })

    // "Important heading" is at 1 to 18
    const snapshot = createSelectionSnapshot('doc-1', editor.state.doc, { from: 1, to: 18 })
    expect(snapshot.sourceText).toBe('Important heading')

    // Modify text after selection
    editor.chain().focus().insertContentAt(28, ' extra remarks').run()

    const result = validateSelectionSnapshot('doc-1', editor.state.doc, snapshot)
    expect(result.status).toBe('stale')
    if (result.status === 'stale') {
      expect(['context-changed', 'document-modified']).toContain(result.reason)
    }
  })

  it('never replaces another occurrence of identical text elsewhere in the document', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Alpha test. The quarterly sprint was good. Beta test. The quarterly sprint was good. Omega.' },
          ],
        },
      ],
    })

    const fullText = editor.getText()
    const firstIndex = fullText.indexOf('The quarterly sprint was good') + 1 // +1 for TipTap 1-indexed doc offset
    const targetLen = 'The quarterly sprint was good'.length

    // Snapshot of the FIRST occurrence
    const snapshot = createSelectionSnapshot('doc-1', editor.state.doc, {
      from: firstIndex,
      to: firstIndex + targetLen,
    })
    expect(snapshot.sourceText).toBe('The quarterly sprint was good')
    expect(snapshot.contextAnchor.prefix).toContain('Alpha test. ')

    // Delete or modify the FIRST occurrence
    editor.chain().focus().insertContentAt({ from: firstIndex, to: firstIndex + targetLen }, 'Updated').run()

    // Even though the identical string "The quarterly sprint was good" still exists at the second location,
    // validateSelectionSnapshot must NOT match or replace the second occurrence!
    const result = validateSelectionSnapshot('doc-1', editor.state.doc, snapshot)
    expect(result.status).toBe('stale')
    if (result.status === 'stale') {
      expect(result.reason).toBe('text-changed')
    }
  })

  it('rejects if document was modified elsewhere even if target text matches bytes', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Section A is ready.' }] },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'This is a sufficiently long subsequent paragraph that has plenty of characters to exceed the anchor window.',
            },
          ],
        },
      ],
    })

    // Snapshot on paragraph 1: "Section A is ready."
    const snapshot = createSelectionSnapshot('doc-1', editor.state.doc, { from: 1, to: 20 })

    // Edit at the very end of paragraph 2, far outside the 32-character anchor window
    const docEnd = editor.state.doc.content.size - 1
    editor.chain().focus().insertContentAt(docEnd, ' appended text').run()

    const result = validateSelectionSnapshot('doc-1', editor.state.doc, snapshot)
    expect(result.status).toBe('stale')
    if (result.status === 'stale') {
      expect(result.reason).toBe('document-modified')
      expect(result.message).toContain('document was edited after the request')
    }
  })
})

describe('staleProtection - Cursor Snapshot & Validation', () => {
  it('validates a valid unchanged cursor position', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world. Write continuation here.' }] },
      ],
    })

    // 1 (doc start) + 13 ('Hello world. '.length) = 14
    const cursorPos = 14 // right after "Hello world. "
    const snapshot = createCursorSnapshot('doc-1', editor.state.doc, cursorPos)

    expect(snapshot.cursorPos).toBe(14)
    expect(snapshot.surroundingContext.prefix).toBe('Hello world. ')
    expect(snapshot.surroundingContext.suffix).toBe('Write continuation here.')

    const result = validateCursorSnapshot('doc-1', editor.state.doc, cursorPos, snapshot)
    expect(result.status).toBe('valid')
    if (result.status === 'valid') {
      expect(result.targetPos).toBe(14)
    }
  })

  it('rejects when cursor moved to a different position', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Paragraph one. Paragraph two.' }] }],
    })

    const snapshot = createCursorSnapshot('doc-1', editor.state.doc, 5)
    // Current caret moved to position 20
    const result = validateCursorSnapshot('doc-1', editor.state.doc, 20, snapshot)

    expect(result.status).toBe('stale')
    if (result.status === 'stale') {
      expect(result.reason).toBe('cursor-moved')
      expect(result.snapshotPos).toBe(5)
      expect(result.currentCursorPos).toBe(20)
    }
  })

  it('rejects when cursor position is outside document boundaries', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Brief.' }] }],
    })

    const snapshot = createCursorSnapshot('doc-1', editor.state.doc, 500)
    const result = validateCursorSnapshot('doc-1', editor.state.doc, 500, snapshot)

    expect(result.status).toBe('stale')
    if (result.status === 'stale') {
      expect(result.reason).toBe('invalid-position')
    }
  })

  it('rejects when surrounding text at cursor was modified', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Start middle end.' }] }],
    })

    const cursorPos = 6 // right before "middle"
    const snapshot = createCursorSnapshot('doc-1', editor.state.doc, cursorPos)

    // Edit text before cursor
    editor.chain().focus().insertContentAt(1, 'Quick ').run()

    const result = validateCursorSnapshot('doc-1', editor.state.doc, cursorPos, snapshot)
    expect(result.status).toBe('stale')
    if (result.status === 'stale') {
      expect(['context-changed', 'document-modified']).toContain(result.reason)
    }
  })

  it('rejects when document was switched for cursor insertion', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Doc A content.' }] }],
    })

    const snapshot = createCursorSnapshot('doc-1', editor.state.doc, 5)
    const result = validateCursorSnapshot('doc-2', editor.state.doc, 5, snapshot)

    expect(result.status).toBe('stale')
    if (result.status === 'stale') {
      expect(result.reason).toBe('document-switched')
    }
  })
})

describe('staleProtection - Insertion Integration with TipTap Transactions', () => {
  it('safely applies valid selection insertion and preserves undo/redo', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'The draft was slow and boring.' }],
        },
      ],
    })

    // "slow and boring" is at range 15 to 30
    const snapshot = createSelectionSnapshot('doc-1', editor.state.doc, { from: 15, to: 30 })

    const prep = validateAndPrepareSelectionInsertion(
      editor,
      'doc-1',
      snapshot,
      'improve-writing',
      'concise and energetic',
    )

    expect(prep.valid).toBe(true)
    if (prep.valid) {
      const applied = editor.chain().focus().insertContentAt(prep.plan.target, prep.plan.content).run()
      expect(applied).toBe(true)
      expect(editor.getText()).toBe('The draft was concise and energetic.')

      // Verify ProseMirror undo
      editor.commands.undo()
      expect(editor.getText()).toBe('The draft was slow and boring.')

      // Verify ProseMirror redo
      editor.commands.redo()
      expect(editor.getText()).toBe('The draft was concise and energetic.')
    }
  })

  it('safely applies valid cursor continuation and preserves undo/redo', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Section 1 overview.' }],
        },
      ],
    })

    const cursorPos = editor.state.doc.content.size - 1
    // Set editor cursor to the end
    editor.commands.setTextSelection(cursorPos)

    const snapshot = createCursorSnapshot('doc-1', editor.state.doc, cursorPos)

    const prep = validateAndPrepareCursorInsertion(
      editor,
      'doc-1',
      snapshot,
      'continue-writing',
      'Follow-up details are documented below.',
    )

    expect(prep.valid).toBe(true)
    if (prep.valid) {
      const applied = editor.chain().focus().insertContentAt(prep.plan.target, prep.plan.content).run()
      expect(applied).toBe(true)
      expect(editor.getText()).toContain('Section 1 overview. Follow-up details are documented below.')

      // Verify undo
      editor.commands.undo()
      expect(editor.getText()).toBe('Section 1 overview.')
    }
  })

  it('blocks selection insertion when document is stale and leaves document unchanged', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original pristine content.' }] }],
    })

    const snapshot = createSelectionSnapshot('doc-1', editor.state.doc, { from: 10, to: 18 })

    // User edits the document
    editor.chain().focus().insertContentAt(1, 'Modified ').run()
    const textAfterUserEdit = editor.getText()

    const prep = validateAndPrepareSelectionInsertion(
      editor,
      'doc-1',
      snapshot,
      'improve-writing',
      'Malicious or Stale Replacement',
    )

    expect(prep.valid).toBe(false)
    if (!prep.valid) {
      expect(prep.validation.status).toBe('stale')
      // Document content must NOT have been changed by the rejected insertion attempt!
      expect(editor.getText()).toBe(textAfterUserEdit)
      expect(editor.getText()).not.toContain('Malicious or Stale Replacement')
    }
  })

  it('blocks cursor insertion when cursor has moved and leaves document unchanged', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Line A. Line B.' }] }],
    })

    const snapshot = createCursorSnapshot('doc-1', editor.state.doc, 7)

    // User moves cursor to 15
    editor.commands.setTextSelection(15)

    const prep = validateAndPrepareCursorInsertion(
      editor,
      'doc-1',
      snapshot,
      'continue-writing',
      'Unwanted text insertion',
    )

    expect(prep.valid).toBe(false)
    if (!prep.valid && prep.validation.status === 'stale') {
      expect(prep.validation.status).toBe('stale')
      expect(prep.validation.reason).toBe('cursor-moved')
      expect(editor.getText()).toBe('Line A. Line B.')
      expect(editor.getText()).not.toContain('Unwanted text insertion')
    }
  })
})

describe('staleProtection - SEC-01 ProseMirror Boundary Safety Regressions', () => {
  it('handles text deleted after the selected range near document end without ProseMirror TypeError', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Target selection text here. Suffix text that will be deleted near end.' },
          ],
        },
      ],
    })

    // "Target selection text" is at 1 to 22
    const snapshot = createSelectionSnapshot('doc-1', editor.state.doc, { from: 1, to: 22 })
    expect(snapshot.contextAnchor.suffixOffset).toBe(32)

    // Delete a large chunk of text at the end of the document
    // Original doc content size was ~72. Deleting characters 40 to 71 shrinks document size to ~41.
    // 22 (to) + 32 (suffixOffset) = 54 > 41 (currentDoc.content.size)
    const docSizeBefore = editor.state.doc.content.size
    editor.chain().focus().deleteRange({ from: 40, to: docSizeBefore }).run()
    const docSizeAfter = editor.state.doc.content.size

    expect(docSizeAfter).toBeLessThan(snapshot.range.to + snapshot.contextAnchor.suffixOffset)
    expect(snapshot.range.to).toBeLessThanOrEqual(docSizeAfter)

    // Calling validateSelectionSnapshot must NOT throw a TypeError
    let threwError = false
    try {
      const result = validateSelectionSnapshot('doc-1', editor.state.doc, snapshot)
      expect(result.status).toBe('stale')
      if (result.status === 'stale') {
        expect(['context-changed', 'document-modified']).toContain(result.reason)
      }
    } catch {
      threwError = true
    }
    expect(threwError).toBe(false)
  })

  it('handles text deleted after cursor near document end without ProseMirror TypeError', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Caret is right here. Trailing sentences that will be shortened.' },
          ],
        },
      ],
    })

    const cursorPos = 21 // right after "Caret is right here."
    const snapshot = createCursorSnapshot('doc-1', editor.state.doc, cursorPos)
    expect(snapshot.surroundingContext.suffixOffset).toBe(32)

    // Delete text after the cursor so document size shrinks below cursorPos + suffixOffset
    const docSizeBefore = editor.state.doc.content.size
    editor.chain().focus().deleteRange({ from: 35, to: docSizeBefore }).run()
    const docSizeAfter = editor.state.doc.content.size

    expect(docSizeAfter).toBeLessThan(snapshot.cursorPos + snapshot.surroundingContext.suffixOffset)
    expect(snapshot.cursorPos).toBeLessThanOrEqual(docSizeAfter)

    // Calling validateCursorSnapshot must NOT throw a TypeError
    let threwError = false
    try {
      const result = validateCursorSnapshot('doc-1', editor.state.doc, cursorPos, snapshot)
      expect(result.status).toBe('stale')
      if (result.status === 'stale') {
        expect(['context-changed', 'document-modified']).toContain(result.reason)
      }
    } catch {
      threwError = true
    }
    expect(threwError).toBe(false)
  })

  it('safely validates selection and cursor at start of document without underflowing prefix bounds', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Start of document text.' }],
        },
      ],
    })

    const selectionSnapshot = createSelectionSnapshot('doc-1', editor.state.doc, { from: 1, to: 6 })
    expect(selectionSnapshot.contextAnchor.prefixOffset).toBe(1)

    const cursorSnapshot = createCursorSnapshot('doc-1', editor.state.doc, 1)
    expect(cursorSnapshot.surroundingContext.prefixOffset).toBe(1)

    // Validation at document boundaries must be valid on unchanged document
    const selResult = validateSelectionSnapshot('doc-1', editor.state.doc, selectionSnapshot)
    expect(selResult.status).toBe('valid')

    const curResult = validateCursorSnapshot('doc-1', editor.state.doc, 1, cursorSnapshot)
    expect(curResult.status).toBe('valid')
  })
})
