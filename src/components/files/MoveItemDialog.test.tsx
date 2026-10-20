// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MoveItemDialog } from './MoveItemDialog'

afterEach(() => {
  cleanup()
})
import type { MyBookFolder } from '../../types/files'

vi.mock('../../hooks/use-mobile', () => ({ useIsMobile: () => false }))

const folders: MyBookFolder[] = [
  {
    id: 'projects',
    driveFolderId: null,
    name: 'Projects',
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'archive',
    driveFolderId: null,
    name: 'Archive',
    parentId: 'projects',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isDeleted: false,
  },
]

describe('MoveItemDialog', () => {
  it('uses a folder-specific search placeholder when moving a folder', () => {
    render(
      <MoveItemDialog
        isOpen
        itemKind="folder"
        folders={folders}
        onClose={vi.fn()}
        onMove={vi.fn().mockResolvedValue({ success: true })}
        onCreateFolder={vi.fn()}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Search folders' })).toHaveAttribute('placeholder', 'Search folders')
  })

  it('requires a destination and moves a file to the selected folder', async () => {
    const onMove = vi.fn().mockResolvedValue({ success: true })
    render(
      <MoveItemDialog
        isOpen
        itemKind="file"
        folders={folders}
        onClose={vi.fn()}
        onMove={onMove}
        onCreateFolder={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Move file' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Search files' })).toHaveAttribute('placeholder', 'Search files')
    expect(screen.getByRole('button', { name: 'Create new folder' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move to folder' })).toBeDisabled()
    expect(screen.queryByText(/Destination:/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('treeitem', { name: /Projects/ }))

    expect(screen.getByRole('button', { name: 'Create new folder' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Move to Projects' }))

    await waitFor(() => expect(onMove).toHaveBeenCalledWith('projects'))
  })

  it('creates a child folder under the selected destination and selects it', async () => {
    const createdFolder = { ...folders[0], id: 'new-folder', name: 'Design', parentId: 'projects' }
    const onCreateFolder = vi.fn().mockResolvedValue({ success: true, data: createdFolder })
    const onMove = vi.fn().mockResolvedValue({ success: true })
    render(
      <MoveItemDialog
        isOpen
        itemKind="folder"
        folders={folders}
        onClose={vi.fn()}
        onMove={onMove}
        onCreateFolder={onCreateFolder}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Move folder' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('treeitem', { name: /Projects/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create new folder' }))
    const input = screen.getByRole('textbox', { name: 'New folder name' })
    fireEvent.change(input, { target: { value: 'Design' } })
    const createForm = input.closest('form')
    expect(createForm).not.toBeNull()
    if (createForm) fireEvent.submit(createForm)

    await waitFor(() => expect(onCreateFolder).toHaveBeenCalledWith('Design', 'projects'))
    expect(screen.getByRole('button', { name: 'Move to Design' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Move to Design' }))

    await waitFor(() => expect(onMove).toHaveBeenCalledWith('new-folder'))
  })

  it('does not select a folder that is an invalid destination', () => {
    render(
      <MoveItemDialog
        isOpen
        itemKind="folder"
        folders={folders}
        disabledFolderIds={['projects', 'archive']}
        onClose={vi.fn()}
        onMove={vi.fn().mockResolvedValue({ success: true })}
        onCreateFolder={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('treeitem', { name: /Projects/ }))
    expect(screen.getByRole('button', { name: 'Move to folder' })).toBeDisabled()
  })

  it('allows choosing the workspace root as the parent for a new folder', () => {
    render(
      <MoveItemDialog
        isOpen
        itemKind="file"
        folders={folders}
        disabledFolderIds={['root']}
        onClose={vi.fn()}
        onMove={vi.fn().mockResolvedValue({ success: true })}
        onCreateFolder={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('treeitem', { name: /Writin root/ }))
    expect(screen.getByRole('button', { name: 'Create new folder' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move to Writin root' })).toBeDisabled()
  })

  it('highlights only the selected parent row, not its nested folder rows', () => {
    render(
      <MoveItemDialog
        isOpen
        itemKind="file"
        folders={folders}
        onClose={vi.fn()}
        onMove={vi.fn().mockResolvedValue({ success: true })}
        onCreateFolder={vi.fn()}
      />,
    )

    const rootItem = screen.getByRole('treeitem', { name: /Writin root/ })
    const projectsItem = screen.getByRole('treeitem', { name: /Projects/ })
    fireEvent.click(screen.getByRole('button', { name: 'Expand Projects' }))
    const archiveItem = screen.getByRole('treeitem', { name: /Archive/ })
    fireEvent.click(rootItem)

    expect(rootItem).toHaveAttribute('aria-selected', 'true')
    expect(projectsItem).toHaveAttribute('aria-selected', 'false')
    expect(archiveItem).toHaveAttribute('aria-selected', 'false')
    expect(rootItem.querySelector('[data-tree-row]')).toHaveClass('bg-primary')
    expect(projectsItem.querySelector('[data-tree-row]')).not.toHaveClass('bg-primary')
    expect(archiveItem.querySelector('[data-tree-row]')).not.toHaveClass('bg-primary')
  })

  it('moves to a selected tree destination when Enter is pressed again', async () => {
    const onMove = vi.fn().mockResolvedValue({ success: true })
    render(
      <MoveItemDialog
        isOpen
        itemKind="file"
        folders={folders}
        onClose={vi.fn()}
        onMove={onMove}
        onCreateFolder={vi.fn()}
      />,
    )

    const projects = screen.getByRole('treeitem', { name: /Projects/ })
    fireEvent.keyDown(projects, { key: 'Enter' })
    fireEvent.keyDown(projects, { key: 'Enter' })

    await waitFor(() => expect(onMove).toHaveBeenCalledWith('projects'))
  })

  it('creates the pending folder on blur under its original parent without changing a newer selection', async () => {
    const onCreateFolder = vi.fn().mockResolvedValue({
      success: true,
      data: { ...folders[0], id: 'new-folder', name: 'Design', parentId: 'projects' },
    })
    render(
      <MoveItemDialog
        isOpen
        itemKind="file"
        folders={folders}
        onClose={vi.fn()}
        onMove={vi.fn().mockResolvedValue({ success: true })}
        onCreateFolder={onCreateFolder}
      />,
    )

    fireEvent.click(screen.getByRole('treeitem', { name: /Projects/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create new folder' }))
    const input = screen.getByRole('textbox', { name: 'New folder name' })
    fireEvent.change(input, { target: { value: 'Design' } })
    fireEvent.blur(input)
    fireEvent.click(screen.getByRole('button', { name: 'Expand Projects' }))
    fireEvent.click(screen.getByRole('treeitem', { name: /Archive/ }))

    await waitFor(() => expect(onCreateFolder).toHaveBeenCalledWith('Design', 'projects'))
    expect(screen.getByRole('button', { name: 'Move to Archive' })).toBeInTheDocument()
  })

  it('keeps the move dialog open when Escape is pressed in the new-folder input', () => {
    const onClose = vi.fn()
    render(
      <MoveItemDialog
        isOpen
        itemKind="file"
        folders={folders}
        onClose={onClose}
        onMove={vi.fn().mockResolvedValue({ success: true })}
        onCreateFolder={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('treeitem', { name: /Projects/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create new folder' }))
    const input = screen.getByRole('textbox', { name: 'New folder name' })
    fireEvent.change(input, { target: { value: 'Draft' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Move file' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'New folder name' })).not.toBeInTheDocument()
  })

  it('renders nested folders with responsive indentation and touch-friendly chevron controls', () => {
    const nestedFolders: MyBookFolder[] = [
      {
        id: 'level-1',
        name: 'Very Long Department Name For Marketing & Strategy 2026',
        parentId: null,
        driveFolderId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isDeleted: false,
      },
      {
        id: 'level-2',
        name: 'Nested Subfolder Level 2',
        parentId: 'level-1',
        driveFolderId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isDeleted: false,
      },
    ]

    render(
      <MoveItemDialog
        isOpen
        itemKind="file"
        folders={nestedFolders}
        onClose={vi.fn()}
        onMove={vi.fn().mockResolvedValue({ success: true })}
        onCreateFolder={vi.fn()}
      />,
    )

    // Expand level 1
    const expandBtn = screen.getByRole('button', { name: /Expand Very Long Department/ })
    expect(expandBtn).toHaveClass('size-8')
    expect(expandBtn).toHaveClass('sm:size-7')
    fireEvent.click(expandBtn)

    // Verify title attribute on long folder name
    const folderSpan = screen.getByTitle('Very Long Department Name For Marketing & Strategy 2026')
    expect(folderSpan).toBeInTheDocument()

    // Verify responsive indentation class on the child group container
    const level2Item = screen.getByRole('treeitem', { name: /Nested Subfolder Level 2/ })
    const parentGroup = level2Item.closest('div[role="group"]')
    expect(parentGroup).toBeInTheDocument()
    expect(parentGroup).toHaveClass('ml-2.5')
    expect(parentGroup).toHaveClass('sm:ml-5')
    expect(parentGroup).toHaveClass('pl-1.5')
    expect(parentGroup).toHaveClass('sm:pl-2')
  })
})
