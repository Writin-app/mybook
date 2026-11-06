// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { act, cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'

import { DocumentTextCounts } from './DocumentTextCounts'

describe('DocumentTextCounts', () => {
  let editor: Editor | null = null

  afterEach(() => {
    cleanup()
    editor?.destroy()
    editor = null
  })

  it('shows language-independent word and character counts and updates with the document', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit],
      content: '<p>Hello, world!</p><p>नमस्ते 🌍</p>',
    })

    render(<DocumentTextCounts editor={editor} />)

    expect(screen.getByRole('status')).toHaveTextContent('3 words')
    expect(screen.getByRole('status')).toHaveTextContent('19 characters')

    act(() => {
      editor!.commands.setContent('<p>One more line.</p>')
    })

    expect(screen.getByRole('status')).toHaveTextContent('3 words')
    expect(screen.getByRole('status')).toHaveTextContent('14 characters')
  })

  it('shows zero counts for an empty document', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit],
      content: '<p></p>',
    })

    render(<DocumentTextCounts editor={editor} />)

    expect(screen.getByRole('status')).toHaveTextContent('0 words')
    expect(screen.getByRole('status')).toHaveTextContent('0 characters')
  })
})
