// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { ToggleBlock } from './extensions/ToggleBlock'
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
        extensions: [StarterKit, ToggleBlock],
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

    it('allows opening insert menu when clicking Add block with mouse and sets z-50 and data attributes', () => {
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

      const insertMenu = screen.getByRole('listbox', { name: 'Insert block options' })
      expect(insertMenu).toBeTruthy()
      const insertContainer = insertMenu.closest('[data-block-insert-menu="true"]')
      expect(insertContainer).not.toBeNull()
      expect(insertContainer?.getAttribute('data-editor-popover')).toBe('true')
      expect(insertContainer?.className).toContain('z-50')

      const controls = document.querySelector('.mybook-editor-block-controls')
      expect(controls?.className).toContain('z-50')
    })

    it('sets z-50 and data attributes when opening block actions menu', () => {
      isMobileMock = false
      editor = createTestEditor()

      render(<EditorBlockControls editor={editor} onInsertBlock={vi.fn()} />)

      const gutter = document.querySelector('.mybook-editor-block-gutter')
      act(() => {
        fireEvent.pointerEnter(gutter!, { pointerType: 'mouse' })
      })

      const actionsBtn = screen.getByRole('button', { name: 'Open block actions' })
      fireEvent.click(actionsBtn)

      const actionsMenu = screen.getByRole('menu', { name: 'Block actions' })
      expect(actionsMenu).toBeTruthy()
      expect(actionsMenu.getAttribute('data-block-actions-menu')).toBe('true')
      expect(actionsMenu.getAttribute('data-editor-popover')).toBe('true')
      expect(actionsMenu.className).toContain('z-50')

      const controls = document.querySelector('.mybook-editor-block-controls')
      expect(controls?.className).toContain('z-50')
    })

    it('dynamically adjusts position and max-height when opening block actions near viewport bottom', () => {
      isMobileMock = false
      editor = createTestEditor()
      // Mock coordsAtPos to place the block near the bottom of a 768px viewport
      vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({
        left: 100,
        right: 500,
        top: 720,
        bottom: 750,
      })
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 })

      render(<EditorBlockControls editor={editor} onInsertBlock={vi.fn()} />)

      const gutter = document.querySelector('.mybook-editor-block-gutter')
      act(() => {
        fireEvent.pointerEnter(gutter!, { pointerType: 'mouse' })
      })

      const actionsBtn = screen.getByRole('button', { name: 'Open block actions' })
      fireEvent.click(actionsBtn)

      const actionsMenu = screen.getByRole('menu', { name: 'Block actions' })
      expect(actionsMenu).toBeTruthy()

      // The menu should flip above the controls instead of rendering below the viewport
      const topStyle = parseFloat(actionsMenu.style.top)
      // Since controls are at ~720-732px and menu height is ~144px, it must flip above 700px
      expect(topStyle).toBeLessThan(700)
      expect(actionsMenu.className).toContain('overflow-y-auto')
      expect(actionsMenu.style.maxHeight).toBeDefined()
    })

    it('accurately positions drop indicator when dragging over a heading without cutting through text', () => {
      isMobileMock = false
      editor = createTestEditor('<p>First paragraph</p><h1>Main Title</h1>')

      const h1Element = editor.view.dom.querySelector('h1')!
      vi.spyOn(h1Element, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        right: 600,
        top: 100,
        bottom: 180,
        width: 500,
        height: 80,
        x: 100,
        y: 100,
        toJSON: () => {},
      })
      const h1Pos = editor.state.doc.child(0).nodeSize
      vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({
        pos: h1Pos + 1, // inside h1
        inside: h1Pos + 1,
      })

      render(<EditorBlockControls editor={editor} onInsertBlock={vi.fn()} />)

      const gutters = document.querySelectorAll('.mybook-editor-block-gutter')
      // Target first paragraph (source block)
      act(() => {
        fireEvent.pointerEnter(gutters[0]!, { pointerType: 'mouse' })
      })

      const gripButton = screen.getByRole('button', { name: 'Open block actions' })
      act(() => {
        fireEvent.pointerDown(gripButton, { clientX: 20, clientY: 20, pointerType: 'mouse' })
      })

      // Move over the bottom half of the heading (e.g. clientY = 160, where top=100, height=80, midpoint=140)
      act(() => {
        const moveEvent = new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 200,
          clientY: 160,
          pointerType: 'mouse',
        })
        document.dispatchEvent(moveEvent)
      })

      const indicator = document.querySelector('[data-drop-indicator="true"]') as HTMLElement
      expect(indicator).not.toBeNull()
      // Bottom of heading is 180, so drop indicator is placed after the heading (top = 180), NOT cutting through the middle
      expect(indicator.style.top).toBe('180px')
      expect(parseFloat(indicator.style.width)).toBeGreaterThanOrEqual(400)
    })

    it('supports dragging blocks into an open toggle block', () => {
      isMobileMock = false
      editor = createTestEditor('<p>Draggable paragraph</p><details data-type="toggle"><summary>Toggle</summary><div class="mybook-toggle-content"><p>Inner content</p></div></details>')

      const toggleContent = editor.view.dom.querySelector('.mybook-toggle-content')!
      vi.spyOn(toggleContent, 'getBoundingClientRect').mockReturnValue({
        left: 120,
        right: 600,
        top: 200,
        bottom: 280,
        width: 480,
        height: 80,
        x: 120,
        y: 200,
        toJSON: () => {},
      })
      const togglePos = editor.state.doc.child(0).nodeSize
      const childParagraphPos = togglePos + 1
      vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({
        pos: childParagraphPos + 1,
        inside: childParagraphPos + 1,
      })

      render(<EditorBlockControls editor={editor} onInsertBlock={vi.fn()} />)

      const gutters = document.querySelectorAll('.mybook-editor-block-gutter')
      act(() => {
        fireEvent.pointerEnter(gutters[0]!, { pointerType: 'mouse' })
      })

      const gripButton = screen.getByRole('button', { name: 'Open block actions' })
      act(() => {
        fireEvent.pointerDown(gripButton, { clientX: 20, clientY: 20, pointerType: 'mouse' })
      })

      act(() => {
        const moveEvent = new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 200,
          clientY: 220,
          pointerType: 'mouse',
        })
        document.dispatchEvent(moveEvent)
      })

      // Drop
      act(() => {
        const upEvent = new PointerEvent('pointerup', { bubbles: true })
        document.dispatchEvent(upEvent)
      })

      // Paragraph was moved inside the toggle block!
      const toggle = editor.state.doc.child(0)
      expect(toggle.type.name).toBe('toggleBlock')
      expect(toggle.textContent).toContain('Draggable paragraph')
    })

    it('supports dragging a block before a heading and reordering doc', () => {
      isMobileMock = false
      editor = createTestEditor('<p>First paragraph</p><h1>Main Title</h1>')

      const h1Element = editor.view.dom.querySelector('h1')!
      vi.spyOn(h1Element, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        right: 600,
        top: 100,
        bottom: 180,
        width: 500,
        height: 80,
        x: 100,
        y: 100,
        toJSON: () => {},
      })
      const h1Pos = editor.state.doc.child(0).nodeSize
      vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({
        pos: h1Pos + 1, // inside h1
        inside: h1Pos + 1,
      })

      render(<EditorBlockControls editor={editor} onInsertBlock={vi.fn()} />)

      const gutters = document.querySelectorAll('.mybook-editor-block-gutter')
      // Target h1
      act(() => {
        fireEvent.pointerEnter(gutters[1]!, { pointerType: 'mouse' })
      })

      const gripButton = screen.getByRole('button', { name: 'Open block actions' })
      act(() => {
        fireEvent.pointerDown(gripButton, { clientX: 20, clientY: 100, pointerType: 'mouse' })
      })

      // Move over first paragraph (pos 0)
      vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({
        pos: 1, // inside first paragraph
        inside: 1,
      })
      act(() => {
        const moveEvent = new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 200,
          clientY: 110, // top half of first paragraph -> before it
          pointerType: 'mouse',
        })
        document.dispatchEvent(moveEvent)
      })

      const indicator = document.querySelector('[data-drop-indicator="true"]') as HTMLElement
      expect(indicator).not.toBeNull()

      // Drop before paragraph
      act(() => {
        const upEvent = new PointerEvent('pointerup', { bubbles: true })
        document.dispatchEvent(upEvent)
      })

      // Heading is now first in the document!
      const firstChild = editor.state.doc.child(0)
      expect(firstChild.type.name).toBe('heading')
    })

    it('preserves empty toggle safety when moving the only block out of a toggle block', () => {
      isMobileMock = false
      editor = createTestEditor('<details data-type="toggle"><summary>Toggle</summary><div class="mybook-toggle-content"><p>Only child</p></div></details><p>Outside paragraph</p>')

      const outsidePos = editor.state.doc.child(0).nodeSize
      vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({
        pos: outsidePos + 1,
        inside: outsidePos + 1,
      })

      render(<EditorBlockControls editor={editor} onInsertBlock={vi.fn()} />)

      const gutters = document.querySelectorAll('.mybook-editor-block-gutter')
      // Target the only child inside toggle (gutters[0] is toggleBlock, gutters[1] is its child)
      act(() => {
        fireEvent.pointerEnter(gutters[1]!, { pointerType: 'mouse' })
      })

      const gripButton = screen.getByRole('button', { name: 'Open block actions' })
      act(() => {
        fireEvent.pointerDown(gripButton, { clientX: 20, clientY: 20, pointerType: 'mouse' })
      })

      // Move over outside paragraph
      act(() => {
        const moveEvent = new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 200,
          clientY: 220,
          pointerType: 'mouse',
        })
        document.dispatchEvent(moveEvent)
      })

      // Drop
      act(() => {
        const upEvent = new PointerEvent('pointerup', { bubbles: true })
        document.dispatchEvent(upEvent)
      })

      // The toggle still has a child paragraph (empty safety)!
      const toggle = editor.state.doc.child(0)
      expect(toggle.type.name).toBe('toggleBlock')
      expect(toggle.childCount).toBe(1)
      expect(toggle.child(0).type.name).toBe('paragraph')
    })
  })
})
