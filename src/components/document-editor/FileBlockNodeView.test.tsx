// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NodeViewProps } from '@tiptap/react'

import { FileBlockNodeView } from './FileBlockNodeView'

describe('FileBlockNodeView', () => {
  let mockEditor: unknown
  let mockNode: {
    attrs: {
      src: string
      name: string
      mimeType: string
      size: number
      pdfPreview?: boolean
    }
    nodeSize: number
    toJSON: () => unknown
  }
  let updateAttributes: (attributes: Record<string, unknown>) => void
  let deleteNode: () => void
  let getPos: () => number | undefined

  beforeEach(() => {
    updateAttributes = vi.fn() as unknown as (attributes: Record<string, unknown>) => void
    deleteNode = vi.fn() as unknown as () => void
    getPos = vi.fn(() => 10) as unknown as () => number | undefined

    mockEditor = {
      view: { focus: vi.fn() },
      commands: {
        setNodeSelection: vi.fn(),
      },
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          insertContentAt: vi.fn(() => ({
            run: vi.fn(),
          })),
          deleteRange: vi.fn(() => ({
            run: vi.fn(),
          })),
          setNodeSelection: vi.fn(() => ({
            run: vi.fn(),
          })),
        })),
      })),
    }

    mockNode = {
      attrs: {
        src: 'https://example.com/files/spec.pdf',
        name: 'spec.pdf',
        mimeType: 'application/pdf',
        size: 2450000,
      },
      nodeSize: 1,
      toJSON: () => ({
        type: 'fileAttachment',
        attrs: mockNode.attrs,
      }),
    }

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  function createProps(customNode = mockNode, selected = false): NodeViewProps {
    return {
      editor: mockEditor,
      node: customNode,
      updateAttributes,
      deleteNode,
      getPos,
      selected,
      decorations: [],
      extension: {} as unknown,
      HTMLAttributes: {},
      view: (mockEditor as { view: unknown }).view,
      innerDecorations: [] as unknown,
    } as unknown as NodeViewProps
  }

  it('renders file card with file name, metadata, and top-right actions', () => {
    render(<FileBlockNodeView {...createProps()} />)

    expect(screen.getByText('spec')).toBeInTheDocument()
    expect(screen.getByText(/PDF · 2\.3 MB/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace file' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy block' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More file options' })).toBeInTheDocument()
  })

  it('renders appropriate metadata for URL-based link without size', () => {
    const urlNode = {
      ...mockNode,
      attrs: {
        src: 'https://example.com/spreadsheet.xlsx',
        name: 'spreadsheet.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 0,
      },
    }

    render(<FileBlockNodeView {...createProps(urlNode)} />)

    expect(screen.getByText('spreadsheet')).toBeInTheDocument()
    expect(screen.getByText(/XLSX · (example\.com|Link)/i)).toBeInTheDocument()
  })

  it('duplicates the file block when Duplicate action is triggered', () => {
    render(<FileBlockNodeView {...createProps()} />)

    const duplicateBtn = screen.getByRole('button', { name: 'Duplicate' })
    fireEvent.click(duplicateBtn)

    expect((mockEditor as { chain: unknown }).chain).toHaveBeenCalled()
  })

  it('deletes the file block when Delete action is triggered from More menu', async () => {
    render(<FileBlockNodeView {...createProps()} />)

    const moreBtn = screen.getByRole('button', { name: 'More file options' })
    fireEvent.click(moreBtn)

    const deleteMenuItem = screen.getByRole('menuitem', { name: 'Delete' })
    fireEvent.click(deleteMenuItem)

    expect(deleteNode).toHaveBeenCalledTimes(1)
  })

  it('copies file URL to clipboard when Copy link is clicked for URL files', async () => {
    render(<FileBlockNodeView {...createProps()} />)

    const moreBtn = screen.getByRole('button', { name: 'More file options' })
    fireEvent.click(moreBtn)

    const copyLinkItem = screen.getByRole('menuitem', { name: 'Copy link' })
    fireEvent.click(copyLinkItem)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/files/spec.pdf')
    })
  })

  it('offers inline preview only for uploaded PDFs and keeps the original download action', () => {
    const uploadedPdfNode: typeof mockNode = {
      ...mockNode,
      attrs: {
        src: 'data:application/pdf;base64,JVBERi0xLjQ=',
        name: 'report.pdf',
        mimeType: 'application/pdf',
        size: 100,
      },
    }
    render(<FileBlockNodeView {...createProps(uploadedPdfNode)} />)

    fireEvent.click(screen.getByRole('button', { name: 'More file options' }))

    expect(screen.getByRole('menuitem', { name: 'Embed PDF' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Download' })).toBeInTheDocument()
  })

  it('switches an uploaded PDF to inline preview and can switch back to its file card', () => {
    const uploadedPdfNode: typeof mockNode = {
      ...mockNode,
      attrs: {
        src: 'data:application/pdf;base64,JVBERi0xLjQ=',
        name: 'report.pdf',
        mimeType: 'application/pdf',
        size: 100,
      },
    }
    const props = createProps(uploadedPdfNode)
    const { rerender } = render(<FileBlockNodeView {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'More file options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Embed PDF' }))
    expect(updateAttributes).toHaveBeenCalledWith({ pdfPreview: true })

    uploadedPdfNode.attrs = { ...uploadedPdfNode.attrs, pdfPreview: true }
    rerender(<FileBlockNodeView {...props} />)
    expect(screen.getByTitle('PDF preview: report.pdf').getAttribute('src')).toMatch(/^blob:/)
    expect(screen.getByRole('button', { name: 'Replace file' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy block' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More file options' })).toBeInTheDocument()
    expect(screen.queryByText(/If the preview does not load/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'More file options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Show as file card' }))
    expect(updateAttributes).toHaveBeenLastCalledWith({ pdfPreview: false })
  })

  it('does not offer inline PDF preview for external PDF URLs', () => {
    render(<FileBlockNodeView {...createProps()} />)

    fireEvent.click(screen.getByRole('button', { name: 'More file options' }))

    expect(screen.queryByRole('menuitem', { name: 'Embed PDF' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument()
  })

  it('opens Replace file popover when Replace action is clicked', () => {
    render(<FileBlockNodeView {...createProps()} />)

    const replaceBtn = screen.getByRole('button', { name: 'Replace file' })
    fireEvent.click(replaceBtn)

    expect(screen.getByRole('dialog', { name: 'Replace file' })).toBeInTheDocument()
  })

  it('opens Edit link popover and updates attributes when new URL is saved', () => {
    render(<FileBlockNodeView {...createProps()} />)

    const moreBtn = screen.getByRole('button', { name: 'More file options' })
    fireEvent.click(moreBtn)

    const editLinkMenuItem = screen.getByRole('menuitem', { name: 'Edit link' })
    fireEvent.click(editLinkMenuItem)

    const dialog = screen.getByRole('dialog', { name: 'Edit file link' })
    expect(dialog).toBeInTheDocument()

    const input = screen.getByLabelText('File URL')
    fireEvent.change(input, { target: { value: 'https://example.com/downloads/new-document.docx' } })

    const saveBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveBtn)

    expect(updateAttributes).toHaveBeenCalledWith({
      src: 'https://example.com/downloads/new-document.docx',
      name: 'new-document.docx',
      size: 0,
      mimeType: '',
    })
  })

  it('does not download or open the file when clicking an unlinked uploaded file, selecting the node instead', () => {
    const uploadedFileNode = {
      ...mockNode,
      attrs: {
        src: 'data:application/pdf;base64,JVBERi0xLjQ=',
        name: 'document.pdf',
        mimeType: 'application/pdf',
        size: 500,
        href: null,
      },
    }
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<FileBlockNodeView {...createProps(uploadedFileNode)} />)

    const cardButton = screen.getByRole('button', { name: 'document' })
    fireEvent.click(cardButton)

    // Node is selected, no window.open and no download anchor clicked
    expect((mockEditor as { commands: { setNodeSelection: unknown } }).commands.setNodeSelection).toHaveBeenCalledWith(10)
    expect((mockEditor as { view: { focus: unknown } }).view.focus).toHaveBeenCalled()
    expect(windowOpenSpy).not.toHaveBeenCalled()
    windowOpenSpy.mockRestore()
  })

  it('opens the linked destination correctly when a user clicks a file block with an attached link', () => {
    const linkedFileNode = {
      ...mockNode,
      attrs: {
        src: 'data:application/pdf;base64,JVBERi0xLjQ=',
        name: 'document.pdf',
        mimeType: 'application/pdf',
        size: 500,
        href: 'https://writin.app/guide',
      },
    }
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<FileBlockNodeView {...createProps(linkedFileNode)} />)

    const cardButton = screen.getByRole('button', { name: /open linked destination for document/i })
    fireEvent.click(cardButton)

    expect(windowOpenSpy).toHaveBeenCalledWith('https://writin.app/guide', '_blank', 'noopener,noreferrer')
    windowOpenSpy.mockRestore()
  })

  it('allows adding, editing, and removing attached link on an uploaded file block', () => {
    const uploadedFileNode = {
      ...mockNode,
      attrs: {
        src: 'data:application/pdf;base64,JVBERi0xLjQ=',
        name: 'contract.pdf',
        mimeType: 'application/pdf',
        size: 800,
        href: null,
      },
    }
    const { rerender } = render(<FileBlockNodeView {...createProps(uploadedFileNode)} />)

    // More menu should offer Add link
    fireEvent.click(screen.getByRole('button', { name: 'More file options' }))
    const addLinkItem = screen.getByRole('menuitem', { name: 'Add link' })
    expect(addLinkItem).toBeInTheDocument()
    fireEvent.click(addLinkItem)

    // Should open Add link popover
    expect(screen.getByRole('dialog', { name: 'Add link' })).toBeInTheDocument()

    // Now render with href attached
    const withHrefNode = {
      ...uploadedFileNode,
      attrs: {
        ...uploadedFileNode.attrs,
        href: 'https://example.com/target',
      },
    }
    rerender(<FileBlockNodeView {...createProps(withHrefNode)} />)

    fireEvent.click(screen.getByRole('button', { name: 'More file options' }))
    expect(screen.getByRole('menuitem', { name: 'Edit link' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Remove link' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument()

    // Remove link
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove link' }))
    expect(updateAttributes).toHaveBeenCalledWith({ href: null })
  })

  it('offers Embed as table in More menu for uploaded CSV files and converts into editor table', async () => {
    const csvDataUrl = 'data:text/csv;base64,' + btoa('Col1,Col2\nVal1,Val2')
    const uploadedCsvNode = {
      ...mockNode,
      attrs: {
        src: csvDataUrl,
        name: 'spreadsheet.csv',
        mimeType: 'text/csv',
        size: 150,
        href: null,
      },
    }

    render(<FileBlockNodeView {...createProps(uploadedCsvNode)} />)

    fireEvent.click(screen.getByRole('button', { name: 'More file options' }))
    const embedTableItem = screen.getByRole('menuitem', { name: 'Embed as table' })
    expect(embedTableItem).toBeInTheDocument()

    fireEvent.click(embedTableItem)

    await waitFor(() => {
      expect((mockEditor as { chain: unknown }).chain).toHaveBeenCalled()
    })
  })

  it('offers Embed in document in More menu for uploaded HTML files and converts into content blocks', async () => {
    const htmlDataUrl = 'data:text/html;base64,' + btoa('<p>Hello <strong>World</strong></p>')
    const uploadedHtmlNode = {
      ...mockNode,
      attrs: {
        src: htmlDataUrl,
        name: 'page.html',
        mimeType: 'text/html',
        size: 200,
        href: null,
      },
    }

    render(<FileBlockNodeView {...createProps(uploadedHtmlNode)} />)

    fireEvent.click(screen.getByRole('button', { name: 'More file options' }))
    const embedDocItem = screen.getByRole('menuitem', { name: 'Embed in document' })
    expect(embedDocItem).toBeInTheDocument()

    fireEvent.click(embedDocItem)

    await waitFor(() => {
      expect((mockEditor as { chain: unknown }).chain).toHaveBeenCalled()
    })
  })
})
