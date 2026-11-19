// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DeleteFolderDialog } from './DeleteFolderDialog'

afterEach(() => {
  cleanup()
})

describe('DeleteFolderDialog', () => {
  it('renders confirmation text with the folder name when open', () => {
    render(
      <DeleteFolderDialog
        isOpen
        folderName="Projects"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Move "Projects" to Trash?')
    expect(screen.getByText(/This folder will move to Trash/)).toBeInTheDocument()
  })

  it('calls onConfirm when Move to Trash is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <DeleteFolderDialog
        isOpen
        folderName="Projects"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Move to Trash/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(
      <DeleteFolderDialog
        isOpen
        folderName="Projects"
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
