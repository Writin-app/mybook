// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AudioBlockPicker } from './AudioBlockPicker'

afterEach(() => {
  cleanup()
})

describe('AudioBlockPicker', () => {
  const defaultPosition = { left: 100, top: 200 }

  it('renders the popover with Upload and Embed link tabs', () => {
    render(
      <AudioBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog', { name: 'Add an audio' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Upload' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Embed link' })).toBeInTheDocument()
    expect(screen.getByText(/drag & drop an audio file here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /browse files/i })).toBeInTheDocument()
  })

  it('triggers file selection when Browse files is clicked', () => {
    render(
      <AudioBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    const fileInput = screen.getByLabelText('Upload audio file') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    const browseBtn = screen.getByRole('button', { name: /browse files/i })
    fireEvent.click(browseBtn)

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('validates file type and displays error for non-audio files', () => {
    render(
      <AudioBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    const fileInput = screen.getByLabelText('Upload audio file')
    const invalidFile = new File(['text content'], 'notes.txt', { type: 'text/plain' })

    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    expect(screen.getByRole('alert')).toHaveTextContent(/please choose an audio file/i)
  })

  it('validates file size and displays error for files exceeding 50 MB', () => {
    render(
      <AudioBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    const fileInput = screen.getByLabelText('Upload audio file')
    const oversizedFile = new File([new ArrayBuffer(51 * 1024 * 1024)], 'huge.mp3', { type: 'audio/mp3' })

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } })

    expect(screen.getByRole('alert')).toHaveTextContent(/audio file is too large/i)
  })

  it('handles valid file upload and triggers onInsert on Add', async () => {
    const onInsert = vi.fn()
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-audio-url')
    window.URL.revokeObjectURL = vi.fn()

    render(
      <AudioBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={onInsert}
      />
    )

    const fileInput = screen.getByLabelText('Upload audio file')
    const validFile = new File(['mock audio data'], 'song.mp3', { type: 'audio/mp3' })

    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(screen.getByText('song.mp3')).toBeInTheDocument()
    })

    const addBtn = screen.getByRole('button', { name: 'Add audio' })
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(onInsert).toHaveBeenCalledWith(
        expect.stringContaining('data:audio/mp3;base64,'),
        'song',
        'html5'
      )
    })
  })

  it('embeds direct audio URL correctly via Embed link tab', () => {
    const onInsert = vi.fn()

    render(
      <AudioBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={onInsert}
      />
    )

    const embedTab = screen.getByRole('tab', { name: 'Embed link' })
    fireEvent.click(embedTab)

    const urlInput = screen.getByPlaceholderText(/paste audio link/i)
    fireEvent.change(urlInput, { target: { value: 'https://example.com/audio/podcast.mp3' } })

    const addBtn = screen.getByRole('button', { name: 'Add audio' })
    fireEvent.click(addBtn)

    expect(onInsert).toHaveBeenCalledWith(
      'https://example.com/audio/podcast.mp3',
      'podcast',
      'html5'
    )
  })

  it('renders custom title and submit label when provided', () => {
    render(
      <AudioBlockPicker
        position={defaultPosition}
        title="Replace audio"
        submitLabel="Replace"
        initialTab="embed"
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog', { name: 'Replace audio' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
  })
})
