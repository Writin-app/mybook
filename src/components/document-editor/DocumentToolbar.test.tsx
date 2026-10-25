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
import { InlineHighlight, InlineTextColor } from './extensions/InlineTextColor'

describe('DocumentToolbar', () => {
  let editor: Editor | null = null

  afterEach(() => {
    cleanup()
    editor?.destroy()
    editor = null
    vi.restoreAllMocks()
  })

  it('renders main toolbar by default with format toggle, block style, lists, undo, redo, add block and hide keyboard', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Hello world</p>',
    })

    render(<DocumentToolbar editor={editor} variant="mobile" />)

    expect(screen.getByRole('toolbar', { name: 'Document formatting' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Format text' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Block style' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bulleted list' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Checklist' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add block' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide keyboard' })).toBeTruthy()
  })

  it('switches to format toolbar on Aa click and switches back on back click', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Hello world</p>',
    })

    render(<DocumentToolbar editor={editor} variant="mobile" />)

    // Click Aa to open format toolbar
    fireEvent.click(screen.getByRole('button', { name: 'Format text' }))

    expect(screen.getByRole('button', { name: 'Back to main toolbar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Underline' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Italic' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Strikethrough' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Text color' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Highlight' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Link' })).toBeTruthy()

    // Click Back to return to main toolbar
    fireEvent.click(screen.getByRole('button', { name: 'Back to main toolbar' }))
    expect(screen.getByRole('button', { name: 'Format text' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Back to main toolbar' })).toBeNull()
  })

  it('toggles text block toolbar without X button and applies heading', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Hello world</p>',
    })

    render(<DocumentToolbar editor={editor} variant="mobile" />)

    const blockStyleBtn = screen.getByRole('button', { name: 'Block style' })
    expect(blockStyleBtn.textContent).toContain('Text')

    // Open block toolbar
    fireEvent.click(blockStyleBtn)

    expect(screen.getByRole('group', { name: 'Block choices' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()

    // Select Heading 1
    const h1Option = screen.getByRole('button', { name: 'Heading 1' })
    fireEvent.click(h1Option)

    expect(screen.queryByRole('group', { name: 'Block choices' })).toBeNull()
    expect(editor.isActive('heading', { level: 1 })).toBe(true)
  })

  it('delegates to onEditLink when text is selected in format toolbar', async () => {
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

    // In format toolbar, click Link button
    const linkButton = screen.getByRole('button', { name: 'Link' })
    fireEvent.click(linkButton)

    expect(onEditLink).toHaveBeenCalledTimes(1)
    expect(promptSpy).not.toHaveBeenCalled()
  })

  it('opens Add block tray below toolbar on + click and toggles/dismisses correctly', async () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Mobile toolbar test</p>',
    })
    const onInsertBlock = vi.fn()

    render(<DocumentToolbar editor={editor} onInsertBlock={onInsertBlock} variant="mobile" />)

    const addBlockButton = screen.getByRole('button', { name: 'Add block' })
    expect(addBlockButton).toBeTruthy()

    // 1. Click + to open tray below toolbar
    fireEvent.click(addBlockButton)
    expect(screen.getByRole('dialog', { name: 'Insert blocks' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Insert blocks' })).toBeTruthy()

    // 2. Click + again to toggle close
    fireEvent.click(addBlockButton)
    expect(screen.queryByRole('dialog', { name: 'Insert blocks' })).toBeNull()

    // 3. Open again and dismiss via keyboard hide button
    fireEvent.click(addBlockButton)
    expect(screen.getByRole('dialog', { name: 'Insert blocks' })).toBeTruthy()

    const hideKeyboardButton = screen.getByRole('button', { name: 'Hide keyboard' })
    fireEvent.click(hideKeyboardButton)
    expect(screen.queryByRole('dialog', { name: 'Insert blocks' })).toBeNull()
  })

  it('toggles text color and highlight palettes with close X buttons', async () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, TaskList, TaskItem, TableKit, InlineTextColor, InlineHighlight],
      content: '<p>Mobile color test</p>',
    })

    render(<DocumentToolbar editor={editor} variant="mobile" />)

    // Switch to format toolbar
    fireEvent.click(screen.getByRole('button', { name: 'Format text' }))

    // Open text color menu
    const textColorBtn = screen.getByRole('button', { name: 'Text color' })
    fireEvent.click(textColorBtn)

    expect(screen.getByRole('menu', { name: 'Text color' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close text colors' })).toBeTruthy()

    // Close text color menu via close X button
    fireEvent.click(screen.getByRole('button', { name: 'Close text colors' }))
    expect(screen.queryByRole('menu', { name: 'Text color' })).toBeNull()

    // Open highlight menu
    const highlightBtn = screen.getByRole('button', { name: 'Highlight' })
    fireEvent.click(highlightBtn)

    expect(screen.getByRole('menu', { name: 'Highlight color' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close highlight colors' })).toBeTruthy()

    // Close highlight menu
    fireEvent.click(screen.getByRole('button', { name: 'Close highlight colors' }))
    expect(screen.queryByRole('menu', { name: 'Highlight color' })).toBeNull()
  })
})
