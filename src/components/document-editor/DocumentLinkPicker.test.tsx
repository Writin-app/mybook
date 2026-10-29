// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MyBookFile, MyBookFolder } from '../../types/files'
import { DocumentLinkPicker } from './TiptapDocumentEditor'

afterEach(() => {
  cleanup()
})

function mockFile(id: string, name: string, type: MyBookFile['type'] = 'document'): MyBookFile {
  return {
    id,
    driveFileId: null,
    workspaceType: 'local',
    name,
    type,
    folderId: null,
    content: '',
    mimeType: type === 'document' ? 'application/x-mybook-document' : 'application/x-mybook-spreadsheet',
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
    lastSyncedAt: null,
    syncStatus: 'local',
    isDeleted: false,
  }
}

describe('DocumentLinkPicker positioning', () => {
  const files: MyBookFile[] = [
    mockFile('doc-1', 'Project Notes'),
    mockFile('doc-2', 'Roadmap'),
    mockFile('doc-3', 'Sprint Backlog'),
  ]
  const folders: MyBookFolder[] = []

  it('opens just below the insertion point when there is sufficient room below', () => {
    // Caret at top: 100, bottom: 124, height: 24, viewport height: 768
    const rect = new DOMRect(150, 100, 1, 24)
    render(
      <DocumentLinkPicker
        currentFileId="current"
        files={files}
        folders={folders}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        onSelectIndex={vi.fn()}
        rect={rect}
        query=""
        selectedIndex={0}
      />
    )

    const picker = screen.getByRole('listbox', { name: 'Link to Page options' })
    expect(picker).toBeInTheDocument()

    // below = rect.bottom (124) + gap (8) = 132px
    expect(picker).toHaveStyle({ top: '132px', left: '150px' })
  })

  it('dynamically adjusts and flips above the insertion point when near the bottom of viewport', () => {
    // Caret near bottom: top: 600, bottom: 624, height: 24 in 768px viewport
    const rect = new DOMRect(120, 600, 1, 24)
    // 3 items: flatTargets: 3 * 40 + groupedTargets: 1 * 28 + 16 = 164px
    render(
      <DocumentLinkPicker
        currentFileId="current"
        files={files}
        folders={folders}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        onSelectIndex={vi.fn()}
        rect={rect}
        query=""
        selectedIndex={0}
      />
    )

    const picker = screen.getByRole('listbox', { name: 'Link to Page options' })
    expect(picker).toBeInTheDocument()

    // 124 + 8 + 164 = 796 > 768 - 8 (760), so there is not enough room below.
    // above = rect.top (600) - estimatedHeight (164) - gap (8) = 428px
    expect(picker).toHaveStyle({ top: '428px', left: '120px' })
  })

  it('selects option on click', () => {
    const onSelect = vi.fn()
    const rect = new DOMRect(100, 100, 1, 24)
    render(
      <DocumentLinkPicker
        currentFileId="current"
        files={files}
        folders={folders}
        onClose={vi.fn()}
        onSelect={onSelect}
        onSelectIndex={vi.fn()}
        rect={rect}
        query=""
        selectedIndex={0}
      />
    )

    const option = screen.getByRole('option', { name: 'Link to page Roadmap' })
    fireEvent.mouseDown(option)
    expect(onSelect).toHaveBeenCalledWith({ id: 'doc-2', name: 'Roadmap' })
  })

  it('renders empty state when no matching documents are found', () => {
    const rect = new DOMRect(100, 100, 1, 24)
    render(
      <DocumentLinkPicker
        currentFileId="current"
        files={files}
        folders={folders}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        onSelectIndex={vi.fn()}
        rect={rect}
        query="nonexistent"
        selectedIndex={0}
      />
    )

    expect(screen.getByText('No pages found')).toBeInTheDocument()
    const picker = screen.getByRole('listbox', { name: 'Link to Page options' })
    // With 0 items, estimated height is 72px; room below permits: top = 124 + 8 = 132px
    expect(picker).toHaveStyle({ top: '132px' })
  })
})
