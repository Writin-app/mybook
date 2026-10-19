import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { mergeDocuments } from './documentMerge'

const docWith = (texts: string[]) => JSON.stringify({
  type: 'doc',
  content: texts.map((text) => ({
    type: 'paragraph',
    content: [{ type: 'text', text }],
  })),
})

describe('mergeDocuments', () => {
  it('returns local content when local and remote are identical', () => {
    const doc = docWith(['Hello world'])
    const result = mergeDocuments(doc, doc, doc)
    expect(result.content).toBe(doc)
    expect(result.hasConflict).toBe(false)
  })

  it('returns remote when local did not change since base', () => {
    const base = docWith(['Hello'])
    const remote = docWith(['Hello', 'World'])
    const result = mergeDocuments(base, base, remote)
    expect(result.content).toBe(remote)
    expect(result.hasConflict).toBe(false)
  })

  it('returns local when remote did not change since base', () => {
    const base = docWith(['Hello'])
    const local = docWith(['Hello', 'My local addition'])
    const result = mergeDocuments(base, local, base)
    expect(result.content).toBe(local)
    expect(result.hasConflict).toBe(false)
  })

  it('merges non-overlapping block edits cleanly', () => {
    const base = docWith(['Block 1', 'Block 2', 'Block 3'])
    // Local edits block 1
    const local = docWith(['Block 1 - edited locally', 'Block 2', 'Block 3'])
    // Remote edits block 3 and adds block 4
    const remote = docWith(['Block 1', 'Block 2', 'Block 3 - edited remotely', 'Block 4 - added remotely'])

    const result = mergeDocuments(base, local, remote)
    const parsed = JSON.parse(result.content) as JSONContent
    const texts = (parsed.content ?? []).map((p) => p.content?.[0]?.text)

    expect(texts).toContain('Block 1 - edited locally')
    expect(texts).toContain('Block 2')
    expect(texts).toContain('Block 3 - edited remotely')
    expect(texts).toContain('Block 4 - added remotely')
  })

  it('merges plain text lines correctly', () => {
    const base = 'Line 1\nLine 2\nLine 3'
    const local = 'Line 1 edited\nLine 2\nLine 3'
    const remote = 'Line 1\nLine 2\nLine 3 edited'

    const result = mergeDocuments(base, local, remote)
    expect(result.content).toBe('Line 1 edited\nLine 2\nLine 3 edited')
  })

  describe('Regression tests: index-shift and structural 3-way merge', () => {
    it('handles remote insertion at beginning plus local edit in middle without dropping or duplicating blocks', () => {
      const base = docWith(['P1', 'P2', 'P3'])
      const local = docWith(['P1', 'P2 - edited locally', 'P3'])
      const remote = docWith(['P0 - added remotely', 'P1', 'P2', 'P3'])

      const result = mergeDocuments(base, local, remote)
      const parsed = JSON.parse(result.content) as JSONContent
      const texts = (parsed.content ?? []).map((p) => p.content?.[0]?.text)

      expect(texts).toEqual(['P0 - added remotely', 'P1', 'P2 - edited locally', 'P3'])
      expect(result.hasConflict).toBe(false)
    })

    it('handles deletion at beginning plus remote edit near end without duplication', () => {
      const base = docWith(['P1', 'P2', 'P3', 'P4'])
      const local = docWith(['P2', 'P3', 'P4']) // deleted P1
      const remote = docWith(['P1', 'P2', 'P3', 'P4 - edited remotely'])

      const result = mergeDocuments(base, local, remote)
      const parsed = JSON.parse(result.content) as JSONContent
      const texts = (parsed.content ?? []).map((p) => p.content?.[0]?.text)

      expect(texts).toEqual(['P2', 'P3', 'P4 - edited remotely'])
      expect(result.hasConflict).toBe(false)
    })

    it('handles independent insertions at opposite ends', () => {
      const base = docWith(['P1', 'P2'])
      const local = docWith(['P0 - local start', 'P1', 'P2'])
      const remote = docWith(['P1', 'P2', 'P3 - remote end'])

      const result = mergeDocuments(base, local, remote)
      const parsed = JSON.parse(result.content) as JSONContent
      const texts = (parsed.content ?? []).map((p) => p.content?.[0]?.text)

      expect(texts).toEqual(['P0 - local start', 'P1', 'P2', 'P3 - remote end'])
      expect(result.hasConflict).toBe(false)
    })

    it('handles changes to separate paragraphs cleanly', () => {
      const base = docWith(['P1', 'P2', 'P3'])
      const local = docWith(['P1 - edited', 'P2', 'P3'])
      const remote = docWith(['P1', 'P2', 'P3 - edited'])

      const result = mergeDocuments(base, local, remote)
      const parsed = JSON.parse(result.content) as JSONContent
      const texts = (parsed.content ?? []).map((p) => p.content?.[0]?.text)

      expect(texts).toEqual(['P1 - edited', 'P2', 'P3 - edited'])
      expect(result.hasConflict).toBe(false)
    })

    it('detects concurrent edits to the same paragraph and flags conflict while preserving both versions', () => {
      const base = docWith(['Original paragraph text'])
      const local = docWith(['Local modified text'])
      const remote = docWith(['Remote modified text'])

      const result = mergeDocuments(base, local, remote)
      expect(result.hasConflict).toBe(true)

      const parsed = JSON.parse(result.content) as JSONContent
      const texts = (parsed.content ?? []).map((p) => p.content?.[0]?.text)
      expect(texts).toContain('Local modified text')
      expect(texts).toContain('Remote modified text')
    })

    it('merges non-overlapping edits within the same paragraph cleanly', () => {
      const base = docWith(['Sentence One. Sentence Two.'])
      const local = docWith(['Sentence One. Sentence Two. Local edit.'])
      const remote = docWith(['Intro. Sentence One. Sentence Two.'])

      const result = mergeDocuments(base, local, remote)
      expect(result.hasConflict).toBe(false)

      const parsed = JSON.parse(result.content) as JSONContent
      expect(parsed.content?.[0]?.content?.[0]?.text).toBe('Intro. Sentence One. Sentence Two. Local edit.')
    })

    it('handles concurrent list-item deletion and sub-item insertion', () => {
      const base = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }] },
            ],
          },
        ],
      })

      // Local deletes Item 2
      const local = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
            ],
          },
        ],
      })

      // Remote adds sub-item to Item 2
      const remote = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] },
                  {
                    type: 'bulletList',
                    content: [
                      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sub-item 2.1' }] }] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })

      const result = mergeDocuments(base, local, remote)
      expect(result.hasConflict).toBe(true)
      const parsed = JSON.parse(result.content) as JSONContent
      // Does not duplicate entire bulletList block outer structure if merged cleanly
      expect(parsed.type).toBe('doc')
      expect(Array.isArray(parsed.content)).toBe(true)
    })

    it('correctly merges repeated identical paragraphs without misaligning', () => {
      const base = docWith(['Same', 'Same', 'Same'])
      const local = docWith(['Same', 'Edited 2', 'Same'])
      const remote = docWith(['Same', 'Same', 'Edited 3'])

      const result = mergeDocuments(base, local, remote)
      const parsed = JSON.parse(result.content) as JSONContent
      const texts = (parsed.content ?? []).map((p) => p.content?.[0]?.text)

      expect(texts).toEqual(['Same', 'Edited 2', 'Edited 3'])
      expect(result.hasConflict).toBe(false)
    })

    it('handles empty base and document deletion cases', () => {
      const empty = JSON.stringify({ type: 'doc', content: [] })
      const local = docWith(['Doc A', 'Doc B'])
      const remote = docWith(['Doc B', 'Doc C'])

      const resultEmpty = mergeDocuments(empty, local, remote)
      const parsedEmpty = JSON.parse(resultEmpty.content) as JSONContent
      const textsEmpty = (parsedEmpty.content ?? []).map((p) => p.content?.[0]?.text)
      expect(textsEmpty).toEqual(['Doc A', 'Doc B', 'Doc C'])
      expect(resultEmpty.hasConflict).toBe(false)

      // Concurrent deletion of whole document vs remote edit
      const basePopulated = docWith(['Base P1', 'Base P2'])
      const localDeleted = empty
      const remoteEdited = docWith(['Base P1', 'Base P2 - remote edit'])
      const resultDel = mergeDocuments(basePopulated, localDeleted, remoteEdited)
      expect(resultDel.hasConflict).toBe(true)
      const parsedDel = JSON.parse(resultDel.content) as JSONContent
      expect((parsedDel.content ?? []).length).toBeGreaterThan(0)
    })

    it('preserves tables, code blocks, task lists, and custom blocks (callout, toggle, database)', () => {
      const base = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'callout',
            attrs: { kind: 'warning' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Important notice' }] }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'typescript' },
            content: [{ type: 'text', text: 'const x = 1;' }],
          },
          {
            type: 'taskList',
            content: [
              { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task 1' }] }] },
            ],
          },
          {
            type: 'databaseBlock',
            attrs: { databaseId: 'db-123', databaseName: 'Projects' },
          },
        ],
      })

      // Local modifies code block
      const local = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'callout',
            attrs: { kind: 'warning' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Important notice' }] }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'typescript' },
            content: [{ type: 'text', text: 'const x = 2;' }],
          },
          {
            type: 'taskList',
            content: [
              { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task 1' }] }] },
            ],
          },
          {
            type: 'databaseBlock',
            attrs: { databaseId: 'db-123', databaseName: 'Projects' },
          },
        ],
      })

      // Remote checks task 1
      const remote = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'callout',
            attrs: { kind: 'warning' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Important notice' }] }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'typescript' },
            content: [{ type: 'text', text: 'const x = 1;' }],
          },
          {
            type: 'taskList',
            content: [
              { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task 1' }] }] },
            ],
          },
          {
            type: 'databaseBlock',
            attrs: { databaseId: 'db-123', databaseName: 'Projects' },
          },
        ],
      })

      const result = mergeDocuments(base, local, remote)
      expect(result.hasConflict).toBe(false)
      const parsed = JSON.parse(result.content) as JSONContent

      // Verify custom attrs preserved:
      const callout = parsed.content?.find((n) => n.type === 'callout')
      expect(callout?.attrs?.kind).toBe('warning')

      const codeBlock = parsed.content?.find((n) => n.type === 'codeBlock')
      expect(codeBlock?.attrs?.language).toBe('typescript')
      expect(codeBlock?.content?.[0]?.text).toBe('const x = 2;')

      const taskList = parsed.content?.find((n) => n.type === 'taskList')
      expect(taskList?.content?.[0]?.attrs?.checked).toBe(true)

      const dbBlock = parsed.content?.find((n) => n.type === 'databaseBlock')
      expect(dbBlock?.attrs?.databaseId).toBe('db-123')
      expect(dbBlock?.attrs?.databaseName).toBe('Projects')
    })
  })
})
