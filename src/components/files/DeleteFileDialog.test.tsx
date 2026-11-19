// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DeleteFileDialog } from './DeleteFileDialog'

afterEach(() => {
  cleanup()
})

describe('DeleteFileDialog', () => {
  it('renders trash confirmation text with the file name when open', () => {
    render(
      <DeleteFileDialog
        isOpen
        fileName="Quarterly Plan"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Move "Quarterly Plan" to Trash?')
    expect(screen.getByText(/This file will move to Trash/)).toBeInTheDocument()
  })

  it('renders permanent delete confirmation text when mode is permanent', () => {
    render(
      <DeleteFileDialog
        isOpen
        fileName="Old Draft"
        mode="permanent"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Delete "Old Draft" permanently?')
    expect(screen.getByText(/permanently deleted and cannot be restored/)).toBeInTheDocument()
  })

  it('calls onConfirm when Move to Trash is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <DeleteFileDialog
        isOpen
        fileName="Quarterly Plan"
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
      <DeleteFileDialog
        isOpen
        fileName="Quarterly Plan"
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
