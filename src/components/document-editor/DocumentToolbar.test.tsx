// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import { TableKit } from '@tiptap/extension-table'
import { TextSelection } from '@tiptap/pm/state'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DocumentToolbar } from './DocumentToolbar'

describe('DocumentToolbar', () => {
  let editor: Editor | null = null

  afterEach(() => {
    cleanup()
    editor?.destroy()
    editor = null
    vi.restoreAllMocks()
  })

  it('renders essential formatting tools on mobile', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Hello world</p>',
    })

    render(<DocumentToolbar editor={editor} variant="mobile" />)

    expect(screen.getByRole('toolbar', { name: 'Document formatting' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Italic' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Underline' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Heading level' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bulleted list' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Numbered list' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'More formatting options' })).toBeTruthy()
  })

  it('delegates to onEditLink when text is selected', async () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Selected link text</p>',
    })
    const onEditLink = vi.fn()
    const promptSpy = vi.spyOn(window, 'prompt')

    render(<DocumentToolbar editor={editor} onEditLink={onEditLink} variant="mobile" />)

    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 1, 9)))
    })

    // Open More formatting sheet
    fireEvent.click(screen.getByRole('button', { name: 'More formatting options' }))

    // Click Link button inside the sheet
    const linkButton = await screen.findByRole('button', { name: 'Link' })
    fireEvent.click(linkButton)

    expect(onEditLink).toHaveBeenCalledTimes(1)
    expect(promptSpy).not.toHaveBeenCalled()
  })

  it('falls back to window.prompt when no text is selected and link is clicked', async () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Unselected text</p>',
    })
    const onEditLink = vi.fn()
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null)

    render(<DocumentToolbar editor={editor} onEditLink={onEditLink} variant="mobile" />)

    // Open More formatting sheet
    fireEvent.click(screen.getByRole('button', { name: 'More formatting options' }))

    // Click Link button inside the sheet without text selected
    const linkButton = await screen.findByRole('button', { name: 'Link' })
    fireEvent.click(linkButton)

    expect(onEditLink).not.toHaveBeenCalled()
    expect(promptSpy).toHaveBeenCalledWith('Link URL', 'https://')
  })
})
