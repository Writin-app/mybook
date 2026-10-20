// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TrashActionsMenu } from './TrashActionsMenu'

let isMobileMock = false
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => isMobileMock,
}))

afterEach(() => {
  cleanup()
})

describe('TrashActionsMenu', () => {
  const defaultProps = {
    fileName: 'Archived.md',
    itemKind: 'file' as const,
    onRestore: vi.fn(),
    onDelete: vi.fn(),
  }

  beforeEach(() => {
    isMobileMock = false
    vi.clearAllMocks()
  })

  it('renders desktop popover when isMobile is false', () => {
    isMobileMock = false
    render(<TrashActionsMenu {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Archived.md' }))

    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(menu).not.toHaveAttribute('data-bottom-sheet')
    expect(screen.getByRole('menuitem', { name: 'Restore file Archived.md' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete file Archived.md permanently' })).toBeInTheDocument()
  })

  it('renders mobile bottom sheet with backdrop when isMobile is true', () => {
    isMobileMock = true
    render(<TrashActionsMenu {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Archived.md' }))

    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(menu).toHaveAttribute('data-bottom-sheet', 'true')
    expect(document.querySelector('[data-slot="dropdown-menu-backdrop"]')).toBeInTheDocument()
  })

  it('calls onRestore when Restore is clicked', () => {
    render(<TrashActionsMenu {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Archived.md' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Restore file Archived.md' }))
    expect(defaultProps.onRestore).toHaveBeenCalled()
  })

  it('calls onDelete when Delete permanently is clicked', () => {
    render(<TrashActionsMenu {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Archived.md' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete file Archived.md permanently' }))
    expect(defaultProps.onDelete).toHaveBeenCalled()
  })
})
