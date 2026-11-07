// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { TextSelection } from '@tiptap/pm/state'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SelectionFormattingToolbar } from './SelectionFormattingToolbar'
import { SELECTION_TOOLBAR_WIDTH, selectionPosition } from './selectionToolbarPosition'

describe('SelectionFormattingToolbar', () => {
  let editor: Editor | null = null

  afterEach(() => {
    cleanup()
    editor?.destroy()
    editor = null
  })

  it('closes and collapses the selection when clicking outside the editor', () => {
    editor = new Editor({ element: document.body.appendChild(document.createElement('div')), extensions: [StarterKit], content: '<p>Hello world</p>' })
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 10, right: 20, top: 100, bottom: 120 })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)

    render(<SelectionFormattingToolbar editor={editor} onInsertBlock={() => undefined} onEditLink={() => undefined} />)
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 1, 6)))
    })
    expect(screen.getByRole('toolbar', { name: 'Selected text formatting' })).toBeTruthy()

    act(() => {
      editor!.view.dom.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    })
    expect(editor.state.selection.empty).toBe(false)

    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    })
    expect(editor.state.selection.empty).toBe(true)
    expect(editor.state.selection.from).toBe(6)
    expect(screen.queryByRole('toolbar', { name: 'Selected text formatting' })).toBeNull()
  })

  it('opens the shared link editor instead of the native prompt', () => {
    editor = new Editor({ element: document.body.appendChild(document.createElement('div')), extensions: [StarterKit], content: '<p>Hello world</p>' })
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 10, right: 20, top: 100, bottom: 120 })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)
    const promptSpy = vi.spyOn(window, 'prompt')
    const onEditLink = vi.fn()

    render(<SelectionFormattingToolbar editor={editor} onInsertBlock={() => undefined} onEditLink={onEditLink} />)
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 1, 6)))
    })
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    expect(onEditLink).toHaveBeenCalledTimes(1)
    expect(promptSpy).not.toHaveBeenCalled()
  })

  it('applies hidden md:flex to stay hidden on mobile viewports', () => {
    editor = new Editor({ element: document.body.appendChild(document.createElement('div')), extensions: [StarterKit], content: '<p>Hello world</p>' })
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 10, right: 20, top: 100, bottom: 120 })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)

    render(<SelectionFormattingToolbar editor={editor} onInsertBlock={() => undefined} onEditLink={() => undefined} />)
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 1, 6)))
    })
    const toolbar = screen.getByRole('toolbar', { name: 'Selected text formatting' })
    expect(toolbar.className).toContain('hidden')
    expect(toolbar.className).toContain('md:flex')
  })

  it('opens block style and more options dropdowns downwards when there is space below', () => {
    editor = new Editor({ element: document.body.appendChild(document.createElement('div')), extensions: [StarterKit], content: '<p>Hello world</p>' })
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 10, right: 20, top: 100, bottom: 120 })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800)

    render(<SelectionFormattingToolbar editor={editor} onInsertBlock={() => undefined} onEditLink={() => undefined} />)
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 1, 6)))
    })

    // Block style dropdown
    fireEvent.click(screen.getByRole('button', { name: 'Block style' }))
    const blockMenu = screen.getByRole('menu', { name: 'Block style' })
    expect(blockMenu.className).toContain('top-full')
    expect(blockMenu.className).toContain('mt-2')
    expect(blockMenu.className).not.toContain('bottom-full')

    // Close block style and open more options
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    const moreScroller = document.querySelector('[data-command-menu-scroller="true"]')
    expect(moreScroller?.className).toContain('top-full')
    expect(moreScroller?.className).toContain('mt-2')
    expect(moreScroller?.className).not.toContain('bottom-full')
  })

  it('flips block style and more options dropdowns to open upwards when near the bottom of the screen', () => {
    editor = new Editor({ element: document.body.appendChild(document.createElement('div')), extensions: [StarterKit], content: '<p>Hello world</p>' })
    // Position selection near bottom: coords top is 720, window height is 768
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 10, right: 20, top: 720, bottom: 740 })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(768)

    render(<SelectionFormattingToolbar editor={editor} onInsertBlock={() => undefined} onEditLink={() => undefined} />)
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 1, 6)))
    })

    // Block style dropdown should flip to top
    fireEvent.click(screen.getByRole('button', { name: 'Block style' }))
    const blockMenu = screen.getByRole('menu', { name: 'Block style' })
    expect(blockMenu.className).toContain('bottom-full')
    expect(blockMenu.className).toContain('mb-2')
    expect(blockMenu.className).not.toContain('top-full')

    // More options dropdown should flip to top
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    const moreScroller = document.querySelector('[data-command-menu-scroller="true"]')
    expect(moreScroller?.className).toContain('bottom-full')
    expect(moreScroller?.className).toContain('mb-2')
    expect(moreScroller?.className).not.toContain('top-full')

    // Text color dropdown should flip to top
    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    const textColorMenu = screen.getByRole('menu', { name: 'Text color' })
    expect(textColorMenu.className).toContain('bottom-full')
    expect(textColorMenu.className).toContain('mb-2')
    expect(textColorMenu.className).not.toContain('top-full')

    // Highlight color dropdown should flip to top
    fireEvent.click(screen.getByRole('button', { name: 'Highlight' }))
    const highlightMenu = screen.getByRole('menu', { name: 'Highlight color' })
    expect(highlightMenu.className).toContain('bottom-full')
    expect(highlightMenu.className).toContain('mb-2')
    expect(highlightMenu.className).not.toContain('top-full')
  })

  it('renders a single scroll container in the more options dropdown without double scrollbars', () => {
    editor = new Editor({ element: document.body.appendChild(document.createElement('div')), extensions: [StarterKit], content: '<p>Hello world</p>' })
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 10, right: 20, top: 100, bottom: 120 })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)

    render(<SelectionFormattingToolbar editor={editor} onInsertBlock={() => undefined} onEditLink={() => undefined} />)
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 1, 6)))
    })

    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    const outerScroller = document.querySelector('[data-command-menu-scroller="true"]')
    const innerListbox = screen.getByRole('listbox', { name: 'More block options' })

    expect(outerScroller?.className).toContain('overflow-y-auto')
    expect(innerListbox.className).not.toContain('overflow-y-auto')
    expect(innerListbox.className).not.toContain('max-h-[inherit]')
  })

  it('appears when selecting text inside a table cell', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, TableKit],
      content: '<table><tbody><tr><td><p>Cell text</p></td></tr></tbody></table>',
    })
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 10, right: 20, top: 100, bottom: 120 })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)

    render(<SelectionFormattingToolbar editor={editor} onInsertBlock={() => undefined} onEditLink={() => undefined} />)
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 4, 8)))
    })

    expect(editor.isActive('table')).toBe(true)
    const toolbar = screen.getByRole('toolbar', { name: 'Selected text formatting' })
    expect(toolbar).toBeTruthy()
    expect(toolbar.className).toContain('z-50')
    expect(toolbar.getAttribute('data-selection-toolbar')).toBe('true')
    expect(toolbar.getAttribute('data-editor-popover')).toBe('true')

    // Dropdown menus should have z-50
    fireEvent.click(screen.getByRole('button', { name: 'Block style' }))
    const blockMenu = screen.getByRole('menu', { name: 'Block style' })
    expect(blockMenu.className).toContain('z-50')
  })

  it('renders an inline code action immediately to the right of checklist and toggles code formatting', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit],
      content: '<p>Formatted code snippet</p>',
    })
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 10, right: 20, top: 100, bottom: 120 })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)

    render(<SelectionFormattingToolbar editor={editor} onInsertBlock={() => undefined} onEditLink={() => undefined} />)
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 1, 10)))
    })

    const checklistButton = screen.getByRole('button', { name: 'Checklist' })
    const inlineCodeButton = screen.getByRole('button', { name: 'Inline code' })

    expect(checklistButton).toBeTruthy()
    expect(inlineCodeButton).toBeTruthy()

    // Verify DOM positioning: inline code is immediately to the right of checklist
    expect(checklistButton.nextElementSibling).toBe(inlineCodeButton)

    // Verify initial active state
    expect(inlineCodeButton.getAttribute('aria-pressed')).toBe('false')
    expect(editor.isActive('code')).toBe(false)

    // Toggle inline code
    fireEvent.click(inlineCodeButton)
    expect(editor.isActive('code')).toBe(true)

    // Toggle off
    fireEvent.click(inlineCodeButton)
    expect(editor.isActive('code')).toBe(false)
  })

  it('clamps toolbar horizontal position preventing overflow at the right window edge', () => {
    window.innerWidth = 1000
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit],
      content: '<p>Rightmost text in table cell</p>',
    })
    // Coordinates right near the right edge
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 950, right: 990, top: 200, bottom: 220 })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)

    render(<SelectionFormattingToolbar editor={editor} onInsertBlock={() => undefined} onEditLink={() => undefined} />)
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 1, 10)))
    })

    const toolbar = screen.getByRole('toolbar', { name: 'Selected text formatting' })
    expect(toolbar).toBeTruthy()
    const leftStyle = parseFloat(toolbar.style.left)
    // Clamped so toolbar (width ~490 with AI button) does not overflow the 1000px window
    expect(leftStyle).toBe(1000 - SELECTION_TOOLBAR_WIDTH - 8)
  })

  it('renders AI actions button and toggles AI popover', () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit],
      content: '<p>Sample text to analyze</p>',
    })
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 50, right: 100, top: 100, bottom: 120 })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)

    render(<SelectionFormattingToolbar editor={editor} onInsertBlock={() => undefined} onEditLink={() => undefined} />)
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 1, 10)))
    })

    const aiButton = screen.getByRole('button', { name: 'Writin Assist' })
    expect(aiButton).toBeTruthy()
    const toolbar = screen.getByRole('toolbar', { name: 'Selected text formatting' })
    const buttonLabels = Array.from(toolbar.querySelectorAll('button')).map((button) => button.getAttribute('aria-label') ?? button.textContent)
    expect(buttonLabels.indexOf('Writin Assist')).toBe(buttonLabels.indexOf('More options') - 1)
    expect(screen.queryByRole('dialog', { name: 'Writin Assist' })).toBeNull()

    // Click to open
    fireEvent.click(aiButton)
    expect(screen.getByRole('dialog', { name: 'Writin Assist' })).toBeTruthy()

    // Press Escape to close
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Writin Assist' })).toBeNull()
  })

  it('adjusts position when selecting text in the last cell of a table to avoid Add Column and Add Row buttons', () => {
    window.innerWidth = 1200
    window.innerHeight = 800
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, TableKit],
      content: '<table><tbody><tr><td><p>First cell</p></td><td><p>Last cell</p></td></tr></tbody></table>',
    })

    const table = editor.view.dom.querySelector('table') as HTMLElement
    vi.spyOn(table, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      right: 700,
      top: 150,
      bottom: 250,
      width: 600,
      height: 100,
      x: 100,
      y: 150,
      toJSON: () => {},
    })

    // Selection in the last cell: coords near right edge of table
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 620, right: 680, top: 200, bottom: 220 })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)

    let lastCellPos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'Last cell') {
        lastCellPos = pos
        return false
      }
    })

    render(<SelectionFormattingToolbar editor={editor} onInsertBlock={() => undefined} onEditLink={() => undefined} />)
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, lastCellPos, lastCellPos + 9)))
    })

    const pos = selectionPosition(editor)
    expect(pos).not.toBeNull()

    // Add Column button sits at visibleTableRight + 4 = 704
    // Toolbar right edge must not overlap Add Column button
    expect(pos!.left + SELECTION_TOOLBAR_WIDTH).toBeLessThanOrEqual(704)
    // Toolbar left must remain >= 8 within viewport
    expect(pos!.left).toBeGreaterThanOrEqual(8)
  })

  it('shifts below Add Row button if selection in table would collide with Add Row or Corner buttons', () => {
    window.innerWidth = 1200
    window.innerHeight = 800
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit, TableKit],
      content: '<table><tbody><tr><td><p>Top cell</p></td></tr></tbody></table>',
    })

    const table = editor.view.dom.querySelector('table') as HTMLElement
    vi.spyOn(table, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      right: 500,
      top: 10,
      bottom: 50,
      width: 400,
      height: 40,
      x: 100,
      y: 10,
      toJSON: () => {},
    })

    // Selection near the top of the viewport (top = 15, so top - 44 < minTop)
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 120, right: 180, top: 15, bottom: 35 })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)

    render(<SelectionFormattingToolbar editor={editor} onInsertBlock={() => undefined} onEditLink={() => undefined} />)
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 4, 8)))
    })

    const pos = selectionPosition(editor)
    expect(pos).not.toBeNull()

    // Add Row zone is effectiveRowBottom + 8 (58) to effectiveRowBottom + 44 (94)
    // Toolbar should be placed below the Add Row zone
    expect(pos!.top).toBeGreaterThanOrEqual(94)
  })

  it('hides action toolbar when sleek AI bar is active', async () => {
    editor = new Editor({
      element: document.body.appendChild(document.createElement('div')),
      extensions: [StarterKit],
      content: '<p>The meeting is on Friday.</p>',
    })
    vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 100, right: 200, top: 150, bottom: 170 })
    vi.spyOn(editor, 'isFocused', 'get').mockReturnValue(true)

    render(
      <SelectionFormattingToolbar
        editor={editor}
        onInsertBlock={() => undefined}
        onEditLink={() => undefined}
      />
    )

    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(TextSelection.create(editor!.state.doc, 1, 15)))
    })

    // Action toolbar is initially visible
    expect(screen.getByRole('toolbar', { name: 'Selected text formatting' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy()

    // Open Writin Assist
    fireEvent.click(screen.getByRole('button', { name: 'Writin Assist' }))

    // Click "Write with AI" to activate sleek prompt bar
    fireEvent.click(screen.getByRole('button', { name: /Write with AI/i }))

    // Action toolbar must now be completely hidden
    expect(screen.queryByRole('toolbar', { name: 'Selected text formatting' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bold' })).toBeNull()

    // Sleek prompt bar is present
    expect(screen.getByRole('region', { name: 'Write with Writin Assist' })).toBeTruthy()
  })
})
