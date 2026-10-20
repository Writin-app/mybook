// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FileActionsMenu } from './FileActionsMenu'

let isMobileMock = false
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => isMobileMock,
}))

afterEach(() => {
  cleanup()
})

describe('FileActionsMenu', () => {
  const defaultProps = {
    fileName: 'Project Plan.md',
    folders: [],
    currentFolderId: null,
    isFavorite: false,
    onRename: vi.fn(),
    onDuplicate: vi.fn(),
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
    render(<FileActionsMenu {...defaultProps} />)

    const trigger = screen.getByRole('button', { name: 'More actions for Project Plan.md' })
    fireEvent.click(trigger)

    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(menu).not.toHaveAttribute('data-bottom-sheet')

    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Add to favorites' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Move…' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Move to Trash' })).toBeInTheDocument()
  })

  it('renders menu as a bottom sheet with backdrop on mobile', () => {
    isMobileMock = true
    render(<FileActionsMenu {...defaultProps} />)

    const trigger = screen.getByRole('button', { name: 'More actions for Project Plan.md' })
    fireEvent.click(trigger)

    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(menu).toHaveAttribute('data-bottom-sheet', 'true')
    expect(document.querySelector('[data-slot="dropdown-menu-backdrop"]')).toBeInTheDocument()
  })

  it('calls onRename when Rename is selected', () => {
    render(<FileActionsMenu {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Project Plan.md' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(defaultProps.onRename).toHaveBeenCalled()
  })

  it('calls onDuplicate when Duplicate is selected', () => {
    render(<FileActionsMenu {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Project Plan.md' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(defaultProps.onDuplicate).toHaveBeenCalled()
  })

  it('calls onToggleFavorite when favorite item is clicked', () => {
    render(<FileActionsMenu {...defaultProps} isFavorite={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Project Plan.md' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to favorites' }))
    expect(defaultProps.onToggleFavorite).toHaveBeenCalled()
  })

  it('shows "Remove from favorites" when isFavorite is true', () => {
    render(<FileActionsMenu {...defaultProps} isFavorite={true} />)
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Project Plan.md' }))
    expect(screen.getByRole('menuitem', { name: 'Remove from favorites' })).toBeInTheDocument()
  })

  it('calls onDelete when Move to Trash is selected', () => {
    render(<FileActionsMenu {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Project Plan.md' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Trash' }))
    expect(defaultProps.onDelete).toHaveBeenCalled()
  })

  it('opens MoveItemDialog when Move… is selected', () => {
    render(<FileActionsMenu {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Project Plan.md' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move…' }))
    expect(screen.getByText('Move file')).toBeInTheDocument()
  })
})
