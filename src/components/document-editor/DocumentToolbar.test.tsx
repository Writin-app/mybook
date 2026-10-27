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

  it('renders main toolbar by default with format toggle, block style, lists, undo, redo, add block and hide keyboard when focused', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Hello world</p>',
    })

    const { rerender } = render(<DocumentToolbar editor={editor} variant="mobile" />)

    expect(screen.getByRole('toolbar', { name: 'Document formatting' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Format text' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Block style' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bulleted list' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Checklist' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add block' })).toBeTruthy()
    // When keyboard is down and editor is not focused, hide keyboard icon is hidden
    expect(screen.queryByRole('button', { name: 'Hide keyboard' })).toBeNull()

    // When keyboard is active (keyboardOffset > 0), hide keyboard icon appears
    rerender(<DocumentToolbar editor={editor} variant="mobile" keyboardOffset={300} />)
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

  it('opens link submenu pill with input and submit button in mobile format toolbar', async () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Selected link text</p>',
    })

    render(<DocumentToolbar editor={editor} variant="mobile" />)

    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 1, 9)))
    })

    // In format toolbar, click Link button
    const linkButton = screen.getByRole('button', { name: 'Link' })
    fireEvent.click(linkButton)

    // Opens inline link submenu pill
    const input = screen.getByPlaceholderText('Paste link or URL…')
    expect(input).toBeTruthy()
    const applyButton = screen.getByRole('button', { name: 'Apply link' })
    expect(applyButton).toBeTruthy()

    // Inline code button is also present
    expect(screen.getByRole('button', { name: 'Inline code' })).toBeTruthy()

    // Enter a URL and submit
    fireEvent.change(input, { target: { value: 'https://example.com' } })
    fireEvent.click(applyButton)

    expect(editor.isActive('link')).toBe(true)
  })

  it('delegates to onEditLink on desktop toolbar when text is selected', async () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Selected link text</p>',
    })
    const onEditLink = vi.fn()

    render(<DocumentToolbar editor={editor} onEditLink={onEditLink} variant="desktop" />)

    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 1, 9)))
    })

    const linkButton = screen.getByRole('button', { name: 'Link' })
    fireEvent.click(linkButton)

    expect(onEditLink).toHaveBeenCalledTimes(1)
  })

  it('opens Add block tray below toolbar on + click and toggles/dismisses correctly', async () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Mobile toolbar test</p>',
    })
    const onInsertBlock = vi.fn()

    render(<DocumentToolbar editor={editor} onInsertBlock={onInsertBlock} variant="mobile" keyboardOffset={300} />)

    const addBlockButton = screen.getByRole('button', { name: 'Add block' })
    expect(addBlockButton).toBeTruthy()

    // 1. Click + to open tray below toolbar
    fireEvent.click(addBlockButton)
    expect(screen.getByRole('dialog', { name: 'Insert blocks' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Basic Blocks' })).toBeTruthy()

    // Search bar is present and filters
    const searchInput = screen.getByPlaceholderText('Search blocks…')
    expect(searchInput).toBeTruthy()
    fireEvent.change(searchInput, { target: { value: 'Heading' } })
    expect(screen.getByRole('button', { name: 'Heading 1' })).toBeTruthy()

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

  it('opens replace block sheet from format toolbar', async () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Existing block content</p>',
    })

    render(<DocumentToolbar editor={editor} variant="mobile" />)

    // Click Aa to enter format toolbar
    fireEvent.click(screen.getByRole('button', { name: 'Format text' }))

    const replaceButton = screen.getByRole('button', { name: 'Replace block' })
    expect(replaceButton).toBeTruthy()

    const blurSpy = vi.spyOn(HTMLElement.prototype, 'blur')
    fireEvent.click(replaceButton)
    expect(blurSpy).toHaveBeenCalled()
    blurSpy.mockRestore()
    const dialog = screen.getByRole('dialog', { name: 'Replace block' })
    expect(dialog).toBeTruthy()
    expect(dialog.className).toContain('max-h-[50vh]')
    expect(screen.getByPlaceholderText('Search replacement blocks…')).toBeTruthy()
  })

  it('allows toggling between bulleted list and checklist without either being disabled', async () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Test item</p>',
    })

    render(<DocumentToolbar editor={editor} variant="mobile" />)

    const bulletBtn = screen.getByRole('button', { name: 'Bulleted list' })
    const taskBtn = screen.getByRole('button', { name: 'Checklist' })

    expect((bulletBtn as HTMLButtonElement).disabled).toBe(false)
    expect((taskBtn as HTMLButtonElement).disabled).toBe(false)

    // Activate bullet list
    fireEvent.click(bulletBtn)
    expect(editor.isActive('bulletList')).toBe(true)

    // Checklist button is still not disabled, and clicking it converts to checklist
    expect((taskBtn as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(taskBtn)
    expect(editor.isActive('taskList')).toBe(true)
    expect(editor.isActive('bulletList')).toBe(false)
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

  it('hides the keyboard icon when editor is focused with a physical keyboard (keyboardOffset = 0)', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, Underline, TaskList, TaskItem, TableKit],
      content: '<p>Physical keyboard focus</p>',
    })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)

    render(<DocumentToolbar editor={editor} variant="mobile" keyboardOffset={0} />)

    // With physical keyboard, keyboardOffset is 0 even when focused, so hide button should NOT appear
    expect(screen.queryByRole('button', { name: 'Hide keyboard' })).toBeNull()
  })
})
