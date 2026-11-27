// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { FolderNameDialog } from './FolderNameDialog'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false
  })
})

afterEach(() => {
  cleanup()
})

describe('FolderNameDialog', () => {
  it('shows duplicate folder names before submit', () => {
    render(
      <FolderNameDialog
        isOpen
        title="Create folder"
        submitLabel="Create"
        existingFolderNames={['Projects']}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: ' projects ' } })

    expect(screen.getByRole('alert')).toHaveTextContent('"Projects" already exists. Use a different name.')
    expect(screen.getByRole('alert')).toHaveClass('text-[var(--token-colors-foreground-destructive-muted)]')
    expect(screen.getByRole('alert')).not.toHaveClass('bg-destructive/10')
    expect(screen.getByLabelText('Folder name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Folder name')).toHaveClass('aria-invalid:border-destructive')
  })

  it('does not show a duplicate error while a new folder is being submitted', async () => {
    let resolveSubmit: (value: { success: boolean; data: { id: string; name: string } }) => void = () => {}
    const submitPromise = new Promise<{ success: boolean; data: { id: string; name: string } }>((resolve) => {
      resolveSubmit = resolve
    })
    const onClose = vi.fn()
    const onSubmit = vi.fn(() => submitPromise)
    const { rerender } = render(
      <FolderNameDialog
        isOpen
        title="Create folder"
        submitLabel="Create"
        existingFolderNames={[]}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'Projects' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled())

    rerender(
      <FolderNameDialog
        isOpen
        title="Create folder"
        submitLabel="Create"
        existingFolderNames={['Projects']}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    resolveSubmit({ success: true, data: { id: 'folder-1', name: 'Projects' } })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
