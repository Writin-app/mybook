// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FolderActionsMenu } from './FolderActionsMenu'

let isMobileMock = false
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => isMobileMock,
}))

afterEach(() => {
  cleanup()
})

describe('FolderActionsMenu', () => {
  const defaultProps = {
    folderName: 'Documents',
    folders: [],
    folderId: 'folder-1',
    currentParentId: null,
    isFavorite: false,
    onRename: vi.fn(),
    onMove: vi.fn().mockResolvedValue({ success: true }),
    onCreateFolder: vi.fn().mockResolvedValue({ success: true }),
    onToggleFavorite: vi.fn(),
    onDelete: vi.fn(),
  }

  beforeEach(() => {
    isMobileMock = false
    vi.clearAllMocks()
  })

  it('renders menu items on desktop as a popover', () => {
    isMobileMock = false
    render(<FolderActionsMenu {...defaultProps} />)

    const trigger = screen.getByRole('button', { name: 'Actions for Documents' })
    fireEvent.click(trigger)

    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(menu).not.toHaveAttribute('data-bottom-sheet')

    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Add to favorites' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Move…' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
  })

  it('renders menu as a bottom sheet with backdrop on mobile', () => {
    isMobileMock = true
    render(<FolderActionsMenu {...defaultProps} />)

    const trigger = screen.getByRole('button', { name: 'Actions for Documents' })
    fireEvent.click(trigger)

    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(menu).toHaveAttribute('data-bottom-sheet', 'true')
    expect(document.querySelector('[data-slot="dropdown-menu-backdrop"]')).toBeInTheDocument()
  })

  it('calls onRename when Rename is selected', () => {
    render(<FolderActionsMenu {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Documents' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(defaultProps.onRename).toHaveBeenCalled()
  })

  it('calls onToggleFavorite when favorite item is clicked', () => {
    render(<FolderActionsMenu {...defaultProps} isFavorite={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Documents' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to favorites' }))
    expect(defaultProps.onToggleFavorite).toHaveBeenCalled()
  })

  it('shows "Remove from favorites" when isFavorite is true', () => {
    render(<FolderActionsMenu {...defaultProps} isFavorite={true} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Documents' }))
    expect(screen.getByRole('menuitem', { name: 'Remove from favorites' })).toBeInTheDocument()
  })

  it('calls onDelete when Delete is selected', () => {
    render(<FolderActionsMenu {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Documents' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(defaultProps.onDelete).toHaveBeenCalled()
  })

  it('opens MoveItemDialog when Move… is selected', () => {
    render(<FolderActionsMenu {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Documents' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move…' }))
    expect(screen.getByText('Move folder')).toBeInTheDocument()
  })
})
