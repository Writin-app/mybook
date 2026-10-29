// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ImageBlockPicker } from './ImageBlockPicker'

afterEach(() => {
  cleanup()
})

describe('ImageBlockPicker', () => {
  const defaultPosition = { left: 100, top: 200 }

  it('renders the popover with Upload and Embed link tabs', () => {
    render(
      <ImageBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog', { name: 'Add an image' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Upload' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Embed link' })).toBeInTheDocument()
    expect(screen.getByText(/drag & drop an image here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /browse files/i })).toBeInTheDocument()
  })

  it('triggers file selection when Browse files is clicked without opening automatically', () => {
    render(
      <ImageBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    const fileInput = screen.getByLabelText('Upload image file') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    const browseBtn = screen.getByRole('button', { name: /browse files/i })
    fireEvent.click(browseBtn)

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('validates file type and displays error for non-image files', () => {
    render(
      <ImageBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    const fileInput = screen.getByLabelText('Upload image file')
    const invalidFile = new File(['text content'], 'notes.txt', { type: 'text/plain' })

    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    expect(screen.getByRole('alert')).toHaveTextContent(/please choose an image file/i)
  })

  it('validates file size and displays error for files exceeding 5 MB', () => {
    render(
      <ImageBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    const fileInput = screen.getByLabelText('Upload image file')
    // Create a 6MB dummy file
    const oversizedFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'huge.png', { type: 'image/png' })

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } })

    expect(screen.getByRole('alert')).toHaveTextContent(/image is too large/i)
  })

  it('handles valid file upload, drag-and-drop, and triggers onInsert on Add', async () => {
    const onInsert = vi.fn()
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url')
    window.URL.revokeObjectURL = vi.fn()

    render(
      <ImageBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={onInsert}
      />
    )

    const fileInput = screen.getByLabelText('Upload image file')
    const validFile = new File(['mock image data'], 'sunset.png', { type: 'image/png' })

    fireEvent.change(fileInput, { target: { files: [validFile] } })

    expect(screen.getByText('sunset.png')).toBeInTheDocument()
    const addBtn = screen.getByRole('button', { name: /add image/i })
    expect(addBtn).toBeInTheDocument()

    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(onInsert).toHaveBeenCalledWith(
        expect.stringMatching(/^data:image\/(?:png|webp);base64,/),
        'sunset'
      )
    })
  })

  it('switches to Embed link tab and validates URL before inserting', () => {
    const onInsert = vi.fn()
    render(
      <ImageBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={onInsert}
      />
    )

    const embedTab = screen.getByRole('tab', { name: 'Embed link' })
    fireEvent.click(embedTab)

    const input = screen.getByPlaceholderText(/paste image link/i)
    expect(input).toBeInTheDocument()

    // Test invalid URL
    fireEvent.change(input, { target: { value: 'not-a-valid-url' } })
    const submitBtn = screen.getByRole('button', { name: /add image/i })
    fireEvent.click(submitBtn)

    expect(screen.getByRole('alert')).toHaveTextContent(/please enter a valid image url/i)
    expect(onInsert).not.toHaveBeenCalled()

    // Test valid URL
    fireEvent.change(input, { target: { value: 'https://images.unsplash.com/photo-123.jpg' } })
    fireEvent.click(submitBtn)

    expect(onInsert).toHaveBeenCalledWith('https://images.unsplash.com/photo-123.jpg', 'photo-123')
  })

  it('auto-normalizes image URLs without protocol with https://', () => {
    const onInsert = vi.fn()
    render(
      <ImageBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={onInsert}
      />
    )

    const embedTab = screen.getByRole('tab', { name: 'Embed link' })
    fireEvent.click(embedTab)

    const input = screen.getByPlaceholderText(/paste image link/i)
    fireEvent.change(input, { target: { value: 'images.unsplash.com/photo-456.jpg' } })
    const submitBtn = screen.getByRole('button', { name: /add image/i })
    fireEvent.click(submitBtn)

    expect(onInsert).toHaveBeenCalledWith('https://images.unsplash.com/photo-456.jpg', 'photo-456')
  })

  it('closes popover on Escape key and Close button click', () => {
    const onClose = vi.fn()
    render(
      <ImageBlockPicker
        position={defaultPosition}
        onClose={onClose}
        onInsert={vi.fn()}
      />
    )

    const closeBtn = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('renders popover with expected top position without secondary clamp shift', () => {
    const { container } = render(
      <ImageBlockPicker
        position={{ left: 100, top: 400 }}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    const dialog = container.querySelector('[data-image-picker="true"]') as HTMLElement
    expect(dialog).toBeTruthy()
    expect(dialog.style.top).toBe('400px')
    expect(dialog.style.left).toBe('100px')
  })
})
