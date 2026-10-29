// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FindReplaceDialog } from './FindReplaceDialog'
import * as findReplaceScroll from './findReplaceScroll'

let editor: Editor | undefined

afterEach(() => {
  cleanup()
  editor?.destroy()
  editor = undefined
})

describe('FindReplaceDialog', () => {
  it('opens as an overlay without pushing content and keeps replace-all behavior', () => {
    const editorElement = document.body.appendChild(document.createElement('div'))
    editor = new Editor({ element: editorElement, extensions: [StarterKit], content: '<p>cat cat</p>' })
    render(<FindReplaceDialog editor={editor} open onOpenChange={() => undefined} />)

    const region = screen.getByRole('region', { name: 'Find and replace' })
    expect(region).toBeInTheDocument()
    expect(region).toHaveAttribute('data-find-replace', 'true')
    expect(region).toHaveAttribute('data-editor-popover', 'true')
    expect(region.className).toContain('z-50')
    expect(screen.getByText('0/0')).toBeInTheDocument()
    expect(screen.queryByLabelText('Replace with')).not.toBeInTheDocument()

    // Arrows are disabled initially
    expect(screen.getByRole('button', { name: 'Previous match' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next match' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'cat' } })
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous match' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next match' })).not.toBeDisabled()

    // Toggle replace view
    fireEvent.click(screen.getByRole('button', { name: /toggle replace/i }))
    expect(screen.getByLabelText('Replace with')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Replace with'), { target: { value: 'dog' } })
    fireEvent.click(screen.getByRole('button', { name: 'Replace all' }))

    expect(editor.getText()).toBe('dog dog')
  })

  it('decorates search matches in page and supports keyboard navigation', () => {
    const editorElement = document.body.appendChild(document.createElement('div'))
    editor = new Editor({ element: editorElement, extensions: [StarterKit], content: '<p>apple banana apple cherry apple</p>' })
    const onOpenChange = vi.fn()

    render(<FindReplaceDialog editor={editor} open onOpenChange={onOpenChange} />)

    const findInput = screen.getByLabelText('Find')
    fireEvent.change(findInput, { target: { value: 'apple' } })

    // Check matches count
    expect(screen.getByText('1/3')).toBeInTheDocument()

    // Check in-page decorations
    const allMatches = editorElement.querySelectorAll('.mybook-search-match')
    expect(allMatches.length).toBe(3)
    const activeMatch = editorElement.querySelector('.mybook-search-match-active')
    expect(activeMatch).toBeInTheDocument()
    expect(activeMatch?.getAttribute('data-match-index')).toBe('0')

    // Navigate next via Enter
    fireEvent.keyDown(findInput, { key: 'Enter' })
    expect(screen.getByText('2/3')).toBeInTheDocument()
    expect(editorElement.querySelector('.mybook-search-match-active')?.getAttribute('data-match-index')).toBe('1')

    // Navigate previous via Shift+Enter
    fireEvent.keyDown(findInput, { key: 'Enter', shiftKey: true })
    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(editorElement.querySelector('.mybook-search-match-active')?.getAttribute('data-match-index')).toBe('0')

    // Close via Escape
    fireEvent.keyDown(findInput, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('replaces single match sequentially and supports Enter in replace field', () => {
    const editorElement = document.body.appendChild(document.createElement('div'))
    editor = new Editor({ element: editorElement, extensions: [StarterKit], content: '<p>cat cat cat</p>' })
    render(<FindReplaceDialog editor={editor} open onOpenChange={() => undefined} />)

    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'cat' } })
    fireEvent.click(screen.getByRole('button', { name: /toggle replace/i }))

    const replaceInput = screen.getByLabelText('Replace with')
    fireEvent.change(replaceInput, { target: { value: 'dog' } })

    // Clicking Replace replaces first match
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }))
    expect(editor.getText()).toBe('dog cat cat')

    // Pressing Enter in replace input replaces next match
    fireEvent.keyDown(replaceInput, { key: 'Enter' })
    expect(editor.getText()).toBe('dog dog cat')
  })

  it('renders responsive replace controls and calls viewport-aware scrolling on navigation', async () => {
    const scrollSpy = vi.spyOn(findReplaceScroll, 'scrollActiveMatchIntoView').mockReturnValue(true)

    const editorElement = document.body.appendChild(document.createElement('div'))
    editor = new Editor({ element: editorElement, extensions: [StarterKit], content: '<p>alpha beta alpha gamma alpha</p>' })
    render(<FindReplaceDialog editor={editor} open onOpenChange={() => undefined} />)

    // Verify Row 1 find input styling for narrow screens
    const findInput = screen.getByLabelText('Find')
    expect(findInput).toHaveClass('pl-7')

    // Toggle replace view
    fireEvent.click(screen.getByRole('button', { name: /toggle replace/i }))
    const replaceInput = screen.getByLabelText('Replace with')
    expect(replaceInput).toBeInTheDocument()

    // Verify replace buttons have responsive flex-1 for touch reachability on narrow viewports
    const replaceButton = screen.getByRole('button', { name: 'Replace' })
    const replaceAllButton = screen.getByRole('button', { name: 'Replace all' })
    expect(replaceButton).toHaveClass('flex-1')
    expect(replaceAllButton).toHaveClass('flex-1')

    // Enter query to find matches
    fireEvent.change(findInput, { target: { value: 'alpha' } })
    expect(screen.getByText('1/3')).toBeInTheDocument()

    // Navigate to next match via button click
    const nextButton = screen.getByRole('button', { name: 'Next match' })
    fireEvent.click(nextButton)
    expect(screen.getByText('2/3')).toBeInTheDocument()

    // Wait for requestAnimationFrame to fire scroll
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(scrollSpy).toHaveBeenCalled()
    const lastCall = scrollSpy.mock.calls[scrollSpy.mock.calls.length - 1]
    expect(lastCall?.[0]).toHaveClass('mybook-search-match-active')
    expect(lastCall?.[0].getAttribute('data-match-index')).toBe('1')
    expect(lastCall?.[1]).toHaveAttribute('role', 'region')
    expect(lastCall?.[1]).toHaveAttribute('aria-label', 'Find and replace')

    scrollSpy.mockRestore()
  })
})
