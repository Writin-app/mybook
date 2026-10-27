// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { TextSelection } from '@tiptap/pm/state'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SelectionFormattingToolbar } from './SelectionFormattingToolbar'

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
    expect(screen.getByRole('toolbar', { name: 'Selected text formatting' })).toBeTruthy()
  })
})
