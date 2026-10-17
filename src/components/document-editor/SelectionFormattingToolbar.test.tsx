// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TextSelection } from '@tiptap/pm/state'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SelectionFormattingToolbar } from './SelectionFormattingToolbar'

describe('SelectionFormattingToolbar', () => {
  let editor: Editor | null = null

  afterEach(() => {
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
})
