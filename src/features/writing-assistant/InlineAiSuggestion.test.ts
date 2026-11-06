// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

import { buildInlineTextDiff, clearInlineAiSuggestion, InlineAiSuggestion, setInlineAiSuggestion } from './InlineAiSuggestion'

describe('InlineAiSuggestion', () => {
  let editor: Editor | null = null

  afterEach(() => {
    editor?.destroy()
    editor = null
  })

  it('keeps repeated words in their original place instead of matching them across a rewrite', () => {
    expect(buildInlineTextDiff(
      'The meeting is scheduled for Friday. Please do not cancel the room.',
      'The meeting has been scheduled for Friday. Please keep the room.',
    )).toEqual([
      { type: 'same', text: 'The meeting ' },
      { type: 'removed', text: 'is scheduled for Friday. Please do not cancel' },
      { type: 'added', text: 'has been scheduled for Friday. Please keep' },
      { type: 'same', text: ' the room.' },
    ])
  })

  it('shows a reversible inline proposal without changing document text', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, InlineAiSuggestion],
      content: '<p>The quick fox.</p>',
    })

    const original = editor.getText()
    setInlineAiSuggestion(editor, {
      from: 1,
      to: 14,
      sourceText: 'The quick fox',
      proposedText: 'The agile fox',
    })

    expect(editor.getText()).toBe(original)
    expect(editor.view.dom.querySelector('.mybook-ai-suggestion-removed')?.textContent).toBe('quick')
    expect(editor.view.dom.querySelector('.mybook-ai-suggestion-added')?.textContent).toBe('agile')

    clearInlineAiSuggestion(editor)

    expect(editor.getText()).toBe(original)
    expect(editor.view.dom.querySelector('.mybook-ai-suggestion-added')).toBeNull()
  })

  it('shows a loading skeleton over the selected text without changing it', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, InlineAiSuggestion],
      content: '<p>The quick fox.</p>',
    })
    const original = editor.getText()

    setInlineAiSuggestion(editor, {
      from: 1,
      to: 14,
      sourceText: 'The quick fox',
      proposedText: '',
      isLoading: true,
    })

    expect(editor.view.dom.querySelector('.mybook-ai-suggestion-loading')?.textContent).toBe('The quick fox')
    expect(editor.getText()).toBe(original)
  })

  it('clears the proposal when the document is edited', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, InlineAiSuggestion],
      content: '<p>The quick fox.</p>',
    })
    setInlineAiSuggestion(editor, {
      from: 1,
      to: 14,
      sourceText: 'The quick fox',
      proposedText: 'The agile fox',
    })

    editor.commands.insertContentAt(1, 'A ')

    expect(editor.view.dom.querySelector('.mybook-ai-suggestion-added')).toBeNull()
  })

  it('shows a readable before and after for a selection spanning paragraphs', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, InlineAiSuggestion],
      content: '<p>First line</p><p>Second line</p>',
    })
    const from = 1
    const to = editor.state.doc.content.size - 1
    const sourceText = editor.state.doc.textBetween(from, to, '\n')
    const original = editor.getText({ blockSeparator: '\n' })

    setInlineAiSuggestion(editor, { from, to, sourceText, proposedText: 'Revised first line\nRevised second line' })

    expect(editor.getText({ blockSeparator: '\n' })).toBe(original)
    expect(editor.view.dom.querySelector('.mybook-ai-suggestion-removed')?.textContent).toContain('First line')
    expect(editor.view.dom.querySelector('.mybook-ai-suggestion-added')?.textContent).toBe('Revised first line\nRevised second line')
  })
})
