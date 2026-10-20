// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

import { TableOfContentsNodeView } from './TableOfContentsNodeView'

let mockIsTouch = false

vi.mock('../../hooks/useDeviceMode', () => ({
  useDeviceMode: () => ({
    isTouch: mockIsTouch,
    isMobile: mockIsTouch,
    isTablet: false,
    isDesktop: !mockIsTouch,
  }),
}))

describe('TableOfContentsNodeView component', () => {
  let editor: Editor
  let container: HTMLDivElement

  beforeEach(() => {
    mockIsTouch = false
    container = document.createElement('div')
    document.body.appendChild(container)
    editor = new Editor({
      element: container,
      extensions: [StarterKit],
      content: '<h1>Heading 1</h1><p>Body paragraph</p><h2>Heading 2</h2>',
    })
  })

  afterEach(() => {
    cleanup()
    editor.destroy()
    container.remove()
    vi.restoreAllMocks()
  })

  it('expands and collapses when the caret toggle button is clicked', () => {
    render(<TableOfContentsNodeView editor={editor} view={editor.view} getPos={() => 0} node={null as never} decorations={[]} innerDecorations={{} as never} selected={false} extension={null as never} updateAttributes={vi.fn()} deleteNode={vi.fn()} HTMLAttributes={{}} />)

    const caretBtn = screen.getByRole('button', { name: 'Collapse table of contents' })
    expect(caretBtn).toBeInTheDocument()
    expect(caretBtn).toHaveClass('mybook-table-of-contents-caret')
    expect(caretBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Heading 1' })).toBeInTheDocument()

    // Collapse
    fireEvent.click(caretBtn)
    expect(caretBtn).toHaveAttribute('aria-expanded', 'false')
    expect(caretBtn).toHaveAttribute('aria-label', 'Expand table of contents')
    expect(screen.queryByRole('button', { name: 'Heading 1' })).not.toBeInTheDocument()

    // Expand again
    fireEvent.click(caretBtn)
    expect(caretBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Heading 1' })).toBeInTheDocument()
  })

  it('navigates and focuses editor on desktop (!isTouch)', () => {
    mockIsTouch = false
    const focusSpy = vi.spyOn(editor.view, 'focus')
    const scrollIntoViewMock = vi.fn()

    // Create target heading DOM element
    const h1 = document.createElement('h1')
    h1.scrollIntoView = scrollIntoViewMock
    vi.spyOn(editor.view, 'nodeDOM').mockReturnValue(h1)

    render(<TableOfContentsNodeView editor={editor} view={editor.view} getPos={() => 0} node={null as never} decorations={[]} innerDecorations={{} as never} selected={false} extension={null as never} updateAttributes={vi.fn()} deleteNode={vi.fn()} HTMLAttributes={{}} />)

    const heading1Btn = screen.getByRole('button', { name: 'Heading 1' })
    fireEvent.click(heading1Btn)

    // Heading was scrolled into view with smooth block: start
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    // Editor was focused for desktop editing
    expect(focusSpy).toHaveBeenCalled()
  })

  it('navigates without focusing editor or opening keyboard on touch (isTouch)', () => {
    mockIsTouch = true
    const focusSpy = vi.spyOn(editor.view, 'focus')
    const scrollIntoViewMock = vi.fn()

    // Create target heading DOM element
    const h2 = document.createElement('h2')
    h2.scrollIntoView = scrollIntoViewMock
    vi.spyOn(editor.view, 'nodeDOM').mockReturnValue(h2)

    // Setup an active input to verify blur
    const activeInput = document.createElement('input')
    document.body.appendChild(activeInput)
    activeInput.focus()
    const blurSpy = vi.spyOn(activeInput, 'blur')

    render(<TableOfContentsNodeView editor={editor} view={editor.view} getPos={() => 0} node={null as never} decorations={[]} innerDecorations={{} as never} selected={false} extension={null as never} updateAttributes={vi.fn()} deleteNode={vi.fn()} HTMLAttributes={{}} />)

    const heading2Btn = screen.getByRole('button', { name: 'Heading 2' })
    fireEvent.click(heading2Btn)

    // Any currently focused input is blurred to dismiss virtual keyboard
    expect(blurSpy).toHaveBeenCalled()
    // Target heading was scrolled into view
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    // Editor view.focus() is NOT called on touch!
    expect(focusSpy).not.toHaveBeenCalled()

    activeInput.remove()
  })
})
