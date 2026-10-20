// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let isMobileMock = false
vi.mock('../../hooks/use-mobile', () => ({
  useIsMobile: () => isMobileMock,
}))

import { EditorBlockControls } from './EditorBlockControls'
import { useHoverBlockControlsAvailable } from '../../hooks/useHoverBlockControls'

function HookTester({ onResult }: { onResult: (val: boolean) => void }) {
  const result = useHoverBlockControlsAvailable()
  onResult(result)
  return null
}

describe('EditorBlockControls', () => {
  let editor: Editor | null = null

  beforeEach(() => {
    isMobileMock = false
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
  })

  afterEach(() => {
    cleanup()
    editor?.destroy()
    editor = null
    vi.restoreAllMocks()
  })

  describe('useHoverBlockControlsAvailable', () => {
    it('returns false when on mobile layout (isMobile = true)', () => {
      isMobileMock = true
      let result = true
      render(<HookTester onResult={(val) => { result = val }} />)
      expect(result).toBe(false)
    })

    it('returns false when device is touch-only without hover pointer', () => {
      isMobileMock = false
      vi.stubGlobal('matchMedia', vi.fn((query: string) => {
        if (query.includes('hover: none') && query.includes('pointer: coarse')) {
          return {
            matches: true,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }
        }
        return {
          matches: false,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }
      }))

      let result = true
      render(<HookTester onResult={(val) => { result = val }} />)
      expect(result).toBe(false)
    })

    it('returns true on desktop layout with fine hover pointer', () => {
      isMobileMock = false
      let result = false
      render(<HookTester onResult={(val) => { result = val }} />)
      expect(result).toBe(true)
    })
  })

  describe('Component rendering & suppression', () => {
    const createTestEditor = (content = '<p>First line of text</p><p>Second line</p>') => {
      const container = document.body.appendChild(document.createElement('div'))
      const ed = new Editor({
        element: container,
        extensions: [StarterKit],
        content,
      })
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        right: 500,
        top: 100,
        bottom: 140,
        width: 400,
        height: 40,
        x: 100,
        y: 100,
        toJSON: () => {},
      })
      vi.spyOn(ed.view, 'coordsAtPos').mockReturnValue({
        left: 100,
        right: 500,
        top: 100,
        bottom: 140,
      })
      return ed
    }

    it('renders null and does not mount gutter targets on mobile', () => {
      isMobileMock = true
      editor = createTestEditor()

      const { container } = render(
        <EditorBlockControls editor={editor} onInsertBlock={vi.fn()} />
      )

      expect(container.innerHTML).toBe('')
      expect(document.querySelector('.mybook-editor-block-controls')).toBeNull()
      expect(document.querySelector('.mybook-editor-block-gutter')).toBeNull()
    })

    it('renders null on coarse touch tablet without hover', () => {
      isMobileMock = false
      vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
        matches: query.includes('hover: none') && query.includes('pointer: coarse'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })))
      editor = createTestEditor()

      const { container } = render(
        <EditorBlockControls editor={editor} onInsertBlock={vi.fn()} />
      )

      expect(container.innerHTML).toBe('')
      expect(document.querySelector('.mybook-editor-block-controls')).toBeNull()
    })

    it('renders gutter targets on desktop with mouse support', () => {
      isMobileMock = false
      editor = createTestEditor()

      render(<EditorBlockControls editor={editor} onInsertBlock={vi.fn()} />)

      const gutters = document.querySelectorAll('.mybook-editor-block-gutter')
      expect(gutters.length).toBeGreaterThan(0)
    })

    it('ignores pointermove events with pointerType touch', () => {
      isMobileMock = false
      editor = createTestEditor()

      render(<EditorBlockControls editor={editor} onInsertBlock={vi.fn()} />)

      // Simulate a touch tap / swipe on the document
      act(() => {
        const touchEvent = new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 50,
          clientY: 50,
          pointerType: 'touch',
        })
        document.dispatchEvent(touchEvent)
      })

      // Block controls must not be rendered because touch pointer was ignored
      expect(screen.queryByRole('button', { name: 'Add block' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Open block actions' })).toBeNull()
    })

    it('ignores pointerenter on gutter targets with pointerType touch', () => {
      isMobileMock = false
      editor = createTestEditor()

      render(<EditorBlockControls editor={editor} onInsertBlock={vi.fn()} />)

      const gutter = document.querySelector('.mybook-editor-block-gutter')
      expect(gutter).not.toBeNull()

      act(() => {
        fireEvent.pointerEnter(gutter!, { pointerType: 'touch' })
      })

      expect(screen.queryByRole('button', { name: 'Add block' })).toBeNull()
    })

    it('responds to pointerenter on gutter targets with pointerType mouse', () => {
      isMobileMock = false
      editor = createTestEditor()

      render(<EditorBlockControls editor={editor} onInsertBlock={vi.fn()} />)

      const gutter = document.querySelector('.mybook-editor-block-gutter')
      expect(gutter).not.toBeNull()

      act(() => {
        fireEvent.pointerEnter(gutter!, { pointerType: 'mouse' })
      })

      // Controls appear
      expect(screen.getByRole('button', { name: 'Add block' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Open block actions' })).toBeTruthy()
    })

    it('ignores touch pointerdown on grip handle and prevents drag state', () => {
      isMobileMock = false
      editor = createTestEditor()

      render(<EditorBlockControls editor={editor} onInsertBlock={vi.fn()} />)

      const gutter = document.querySelector('.mybook-editor-block-gutter')
      act(() => {
        fireEvent.pointerEnter(gutter!, { pointerType: 'mouse' })
      })

      const gripButton = screen.getByRole('button', { name: 'Open block actions' })
      expect(gripButton).toBeTruthy()

      // Dispatch touch pointerdown
      act(() => {
        fireEvent.pointerDown(gripButton, {
          clientX: 20,
          clientY: 20,
          pointerType: 'touch',
        })
      })

      // The block controls container should not have opacity-70 (isDragging class)
      const controls = document.querySelector('.mybook-editor-block-controls')
      expect(controls?.classList.contains('opacity-70')).toBe(false)
    })

    it('allows opening insert menu when clicking Add block with mouse', () => {
      isMobileMock = false
      editor = createTestEditor()
      const onInsertBlock = vi.fn()

      render(<EditorBlockControls editor={editor} onInsertBlock={onInsertBlock} />)

      const gutter = document.querySelector('.mybook-editor-block-gutter')
      act(() => {
        fireEvent.pointerEnter(gutter!, { pointerType: 'mouse' })
      })

      const addBtn = screen.getByRole('button', { name: 'Add block' })
      fireEvent.click(addBtn)

      expect(screen.getByRole('listbox', { name: 'Insert block options' })).toBeTruthy()
    })
  })
})
