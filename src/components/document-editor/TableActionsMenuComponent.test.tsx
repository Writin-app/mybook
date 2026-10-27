// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import StarterKit from '@tiptap/starter-kit'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let isTouchMock = false
vi.mock('../../hooks/useDeviceMode', () => ({
  useDeviceMode: () => ({
    isTouch: isTouchMock,
    isMobile: isTouchMock,
    isTablet: false,
    isDesktop: !isTouchMock,
  }),
}))

import { FixedTable } from './extensions/FixedTable'
import { StyledTableCell, StyledTableHeader } from './extensions/TableCellStyles'
import { TableActionsMenu } from './TableActionsMenu'

describe('TableActionsMenu touch controls & boundaries', () => {
  let editor: Editor | null = null

  beforeEach(() => {
    isTouchMock = false
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.classList.contains('tableWrapper')) {
        return { left: 100, right: 500, top: 100, bottom: 300, width: 400, height: 200, x: 100, y: 100, toJSON: () => {} }
      }
      if (this.tagName.toLowerCase() === 'table') {
        return { left: 100, right: 500, top: 100, bottom: 300, width: 400, height: 200, x: 100, y: 100, toJSON: () => {} }
      }
      if (this.tagName.toLowerCase() === 'th') {
        const isSecond = this.textContent === 'Status'
        const left = isSecond ? 300 : 100
        const right = isSecond ? 500 : 300
        return { left, right, top: 100, bottom: 150, width: 200, height: 50, x: left, y: 100, toJSON: () => {} }
      }
      if (this.tagName.toLowerCase() === 'tr') {
        return { left: 100, right: 500, top: 100, bottom: 150, width: 400, height: 50, x: 100, y: 100, toJSON: () => {} }
      }
      return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {} }
    })
  })

  afterEach(() => {
    cleanup()
    editor?.destroy()
    editor = null
    vi.restoreAllMocks()
  })

  const createTableEditor = () => {
    const container = document.body.appendChild(document.createElement('div'))
    return new Editor({
      element: container,
      extensions: [
        StarterKit,
        TableKit.configure({ table: false, tableCell: false, tableHeader: false }),
        FixedTable,
        StyledTableCell,
        StyledTableHeader,
      ],
      content: {
        type: 'doc',
        content: [{
          type: 'table',
          content: [{
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Status' }] }] },
            ],
          }],
        }],
      },
    })
  }

  it('keeps grips hidden by default on desktop without hover', () => {
    isTouchMock = false
    editor = createTableEditor()
    editor.commands.setTextSelection(4)

    render(<TableActionsMenu editor={editor} />)

    const col1 = screen.getByRole('button', { name: 'Column 1 actions' })
    expect(col1.classList.contains('is-visible')).toBe(false)
    expect(col1.classList.contains('is-touch')).toBe(false)
  })

  it('makes grips visible and marks active cell on touch devices', () => {
    isTouchMock = true
    editor = createTableEditor()
    // Select inside cell 1 ("Name", col 0, row 0)
    editor.commands.setTextSelection(4)

    render(<TableActionsMenu editor={editor} />)

    const col1 = screen.getByRole('button', { name: 'Column 1 actions' })
    const col2 = screen.getByRole('button', { name: 'Column 2 actions' })
    const row1 = screen.getByRole('button', { name: 'Row 1 actions' })

    // On touch devices, all in-bounds grips for active table are discoverable
    expect(col1.classList.contains('is-visible')).toBe(true)
    expect(col1.classList.contains('is-touch')).toBe(true)
    expect(col1.classList.contains('is-active-cell')).toBe(true)

    expect(col2.classList.contains('is-visible')).toBe(true)
    expect(col2.classList.contains('is-touch')).toBe(true)
    expect(col2.classList.contains('is-active-cell')).toBe(false)

    expect(row1.classList.contains('is-visible')).toBe(true)
    expect(row1.classList.contains('is-touch')).toBe(true)
    expect(row1.classList.contains('is-active-cell')).toBe(true)
  })

  it('opens bottom sheet menu directly when touching a grip', () => {
    isTouchMock = true
    editor = createTableEditor()
    editor.commands.setTextSelection(4)

    render(<TableActionsMenu editor={editor} />)

    const col1 = screen.getByRole('button', { name: 'Column 1 actions' })

    act(() => {
      fireEvent.pointerDown(col1, { pointerType: 'touch' })
    })

    // Menu should open immediately
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Insert left' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Insert right' })).toBeTruthy()
  })

  it('does not render column grip when column is outside horizontal wrapper bounds', () => {
    isTouchMock = true
    editor = createTableEditor()
    editor.commands.setTextSelection(4)

    // Mock getBoundingClientRect so Column 2 is scrolled outside right edge
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.classList.contains('tableWrapper')) {
        return { left: 100, right: 300, top: 100, bottom: 300, width: 200, height: 200, x: 100, y: 100, toJSON: () => {} }
      }
      if (this.tagName.toLowerCase() === 'table') {
        return { left: 100, right: 600, top: 100, bottom: 300, width: 500, height: 200, x: 100, y: 100, toJSON: () => {} }
      }
      if (this.tagName.toLowerCase() === 'th') {
        const isSecond = this.textContent === 'Status'
        // Column 1 is 100..250 (inside 100..300)
        // Column 2 is 350..500 (completely outside 100..300)
        const left = isSecond ? 350 : 100
        const right = isSecond ? 500 : 250
        return { left, right, top: 100, bottom: 150, width: right - left, height: 50, x: left, y: 100, toJSON: () => {} }
      }
      if (this.tagName.toLowerCase() === 'tr') {
        return { left: 100, right: 500, top: 100, bottom: 150, width: 400, height: 50, x: 100, y: 100, toJSON: () => {} }
      }
      return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {} }
    })

    render(<TableActionsMenu editor={editor} />)

    // Column 1 is in bounds
    expect(screen.queryByRole('button', { name: 'Column 1 actions' })).toBeTruthy()
    // Column 2 is outside wrapperRect (left 350 > right 300) -> not rendered
    expect(screen.queryByRole('button', { name: 'Column 2 actions' })).toBeNull()
  })

  it('keeps add-row and add-column buttons outside the scrolling area for fixed tables', () => {
    isTouchMock = false
    editor = createTableEditor()
    editor.commands.setTextSelection(4)

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.classList.contains('tableWrapper')) {
        return { left: 100, right: 500, top: 100, bottom: 250, width: 400, height: 150, x: 100, y: 100, toJSON: () => {} }
      }
      if (this.tagName.toLowerCase() === 'table') {
        return { left: 100, right: 500, top: 100, bottom: 700, width: 400, height: 600, x: 100, y: 100, toJSON: () => {} }
      }
      if (this.tagName.toLowerCase() === 'th') {
        return { left: 100, right: 300, top: 100, bottom: 150, width: 200, height: 50, x: 100, y: 100, toJSON: () => {} }
      }
      if (this.tagName.toLowerCase() === 'tr') {
        return { left: 100, right: 500, top: 100, bottom: 150, width: 400, height: 50, x: 100, y: 100, toJSON: () => {} }
      }
      return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {} }
    })

    const wrapper = editor.view.dom.querySelector('.tableWrapper') as HTMLElement
    wrapper?.setAttribute('data-fixed-rows', 'true')

    render(<TableActionsMenu editor={editor} />)

    const addRow = screen.getByRole('button', { name: 'Add row' })
    const addCol = screen.getByRole('button', { name: 'Add column' })

    expect(addRow).toBeTruthy()
    expect(addRow.style.top).toBe('258px')

    expect(addCol).toBeTruthy()
    expect(addCol.style.height).toBe('150px')
    expect(addCol.style.top).toBe('100px')
  })
})
