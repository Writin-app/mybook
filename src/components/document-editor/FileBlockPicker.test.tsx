// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FileBlockPicker } from './FileBlockPicker'

afterEach(() => {
  cleanup()
})

describe('FileBlockPicker', () => {
  const defaultPosition = { left: 100, top: 200 }

  it('renders the popover with Upload and Embed link tabs', () => {
    render(
      <FileBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog', { name: 'Add a file' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Upload' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Embed link' })).toBeInTheDocument()
    expect(screen.getByText(/drag & drop a file here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /browse files/i })).toBeInTheDocument()
  })

  it('triggers file selection when Browse files is clicked', () => {
    render(
      <FileBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    const fileInput = screen.getByLabelText('Upload file') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    const browseBtn = screen.getByRole('button', { name: /browse files/i })
    fireEvent.click(browseBtn)

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('validates file size and displays error for files exceeding 50 MB', () => {
    render(
      <FileBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    const fileInput = screen.getByLabelText('Upload file')
    const oversizedFile = new File([new ArrayBuffer(51 * 1024 * 1024)], 'huge.pdf', { type: 'application/pdf' })

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } })

    expect(screen.getByRole('alert')).toHaveTextContent(/file is too large/i)
  })

  it('handles valid file upload and triggers onInsert on Add file', async () => {
    const onInsert = vi.fn()
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-file-url')
    window.URL.revokeObjectURL = vi.fn()

    render(
      <FileBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={onInsert}
      />
    )

    const fileInput = screen.getByLabelText('Upload file')
    const validFile = new File(['mock content'], 'report.pdf', { type: 'application/pdf' })

    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(screen.getByText('report.pdf')).toBeInTheDocument()
    })

    const submitBtn = screen.getByRole('button', { name: 'Add file' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onInsert).toHaveBeenCalledWith(
        expect.stringContaining('data:application/pdf;base64,'),
        'report.pdf',
        'application/pdf',
        validFile.size
      )
    })
  })

  it('handles Embed link tab, validates URL, and inserts file', async () => {
    const onInsert = vi.fn()

    render(
      <FileBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={onInsert}
      />
    )

    // Switch to Embed link tab
    const embedTab = screen.getByRole('tab', { name: 'Embed link' })
    fireEvent.click(embedTab)

    const urlInput = screen.getByLabelText('File link')
    expect(urlInput).toBeInTheDocument()

    // Enter valid URL
    fireEvent.change(urlInput, { target: { value: 'https://example.com/documents/financial-report-2024.docx' } })
    const submitBtn = screen.getByRole('button', { name: 'Attach link' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onInsert).toHaveBeenCalledWith(
        'https://example.com/documents/financial-report-2024.docx',
        'financial-report-2024.docx',
        '',
        0,
        false
      )
    })
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()

    render(
      <FileBlockPicker
        position={defaultPosition}
        onClose={onClose}
        onInsert={vi.fn()}
      />
    )

    const closeBtn = screen.getByRole('button', { name: 'Close add a file' })
    fireEvent.click(closeBtn)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()

    render(
      <FileBlockPicker
        position={defaultPosition}
        onClose={onClose}
        onInsert={vi.fn()}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('offers Embed PDF button and passes pdfPreview=true on selection', async () => {
    const onInsert = vi.fn()

    render(
      <FileBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={onInsert}
      />
    )

    const fileInput = screen.getByLabelText('Upload file')
    const pdfFile = new File(['%PDF-1.4 test'], 'handbook.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Embed PDF' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add file' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Embed PDF' }))

    await waitFor(() => {
      expect(onInsert).toHaveBeenCalledWith(
        expect.stringContaining('data:application/pdf;base64,'),
        'handbook.pdf',
        'application/pdf',
        pdfFile.size,
        true
      )
    })
  })

  it('offers Embed as table button for CSV files when onEmbedContent is provided', async () => {
    const onEmbedContent = vi.fn()

    render(
      <FileBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
        onEmbedContent={onEmbedContent}
      />
    )

    const fileInput = screen.getByLabelText('Upload file')
    const csvFile = new File(['Col1,Col2\nVal1,Val2'], 'data.csv', { type: 'text/csv' })
    fireEvent.change(fileInput, { target: { files: [csvFile] } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Embed as table' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add file' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Embed as table' }))

    await waitFor(() => {
      expect(onEmbedContent).toHaveBeenCalledWith(expect.stringContaining('<table><tbody>'))
    })
  })
})
