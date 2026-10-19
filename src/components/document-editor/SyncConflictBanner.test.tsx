// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MyBookFile } from '../../types/files'
import { SyncConflictBanner } from './SyncConflictBanner'

afterEach(cleanup)

const mockFile: MyBookFile = {
  id: 'file-123',
  driveFileId: 'drive-123',
  name: 'Project Plan',
  type: 'document',
  folderId: null,
  content: JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Local draft content' }] }],
  }),
  mimeType: 'text/markdown',
  createdAt: '2026-10-18T10:00:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
  lastSyncedAt: '2026-10-18T10:00:00.000Z',
  syncConflict: {
    versionId: 'remote-ver-1',
    remoteModifiedTime: '2026-10-18T12:30:00.000Z',
    detectedAt: '2026-10-18T12:31:00.000Z',
  },
  syncStatus: 'pending',
  isDeleted: false,
}

describe('SyncConflictBanner', () => {
  it('1. renders near-full-screen responsive layout with side-by-side panes', () => {
    const onKeepMine = vi.fn()
    const onUseRemote = vi.fn()

    render(
      <SyncConflictBanner
        file={mockFile}
        conflictVersionId="remote-ver-1"
        onKeepMine={onKeepMine}
        onUseRemote={onUseRemote}
      />,
    )

    // Verify compact inline notice
    const notice = screen.getByRole('region', { name: 'Conflicting changes' })
    expect(notice).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review changes' })).toBeInTheDocument()

    // Open review interface
    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }))

    // Dialog layout dimensions
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('w-[96vw]')
    expect(dialog).toHaveClass('h-[90vh]')

    // Desktop side-by-side comparison panes
    expect(screen.getAllByText('Your version').length).toBeGreaterThan(0)
    expect(screen.getAllByText('This device • Local draft').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Other version').length).toBeGreaterThan(0)
    expect(screen.getByText('Google Drive')).toBeInTheDocument()

    // Actions visible
    expect(screen.getByRole('button', { name: 'Keep my version' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use other version' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Merge both versions' })).toBeInTheDocument()
  })

  it('2. provides discoverable merge action and performs clean safe merge', async () => {
    const onMerge = vi.fn().mockResolvedValue(true)
    const baseContent = 'Base line 1\nBase line 2'
    const localContent = 'Base line 1\nLocal addition'
    const remoteContent = 'Remote addition\nBase line 2'

    render(
      <SyncConflictBanner
        file={{ ...mockFile, baseContent }}
        conflictVersionId="remote-ver-1"
        localContent={localContent}
        remoteContent={remoteContent}
        onKeepMine={vi.fn()}
        onUseRemote={vi.fn()}
        onMerge={onMerge}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }))

    const mergeBtn = screen.getByRole('button', { name: 'Merge both versions' })
    expect(mergeBtn).toBeInTheDocument()

    // Can toggle merged preview
    const previewBtn = screen.getByRole('button', { name: 'Preview merged result' })
    expect(previewBtn).toBeInTheDocument()
    fireEvent.click(previewBtn)
    expect(screen.getByText('Merged result preview')).toBeInTheDocument()

    // Execute merge
    fireEvent.click(mergeBtn)

    await waitFor(() => {
      expect(onMerge).toHaveBeenCalledTimes(1)
    })
    expect(onMerge).toHaveBeenCalledWith(expect.stringContaining('Remote addition'))
    expect(onMerge).toHaveBeenCalledWith(expect.stringContaining('Local addition'))
  })

  it('3. handles incompatible merges without data loss or silent overwriting', async () => {
    const onMerge = vi.fn().mockResolvedValue(true)
    const baseContent = 'Shared line'
    const localContent = 'Local conflicting edit'
    const remoteContent = 'Remote conflicting edit'

    render(
      <SyncConflictBanner
        file={{ ...mockFile, baseContent }}
        conflictVersionId="remote-ver-1"
        localContent={localContent}
        remoteContent={remoteContent}
        onKeepMine={vi.fn()}
        onUseRemote={vi.fn()}
        onMerge={onMerge}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }))
    const mergeBtn = screen.getByRole('button', { name: 'Merge both versions' })
    fireEvent.click(mergeBtn)

    // Does NOT call onMerge
    expect(onMerge).not.toHaveBeenCalled()

    // Displays clear explanation of limitation
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Both versions modify the same section incompatibly. An automatic merge cannot be performed safely',
      )
    })

    // Dialog stays open so user can pick either version safely
    expect(screen.getByRole('button', { name: 'Keep my version' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use other version' })).toBeInTheDocument()
  })

  it('4. successful Keep my version clears the resolved banner from active UI state immediately', async () => {
    const onKeepMine = vi.fn().mockResolvedValue(true)

    render(
      <SyncConflictBanner
        conflictVersionId="remote-ver-1"
        onKeepMine={onKeepMine}
        onUseRemote={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep my version' }))

    await waitFor(() => {
      expect(onKeepMine).toHaveBeenCalledTimes(1)
    })

    // Banner is removed immediately from UI
    expect(screen.queryByRole('region', { name: 'Conflicting changes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('5. failed resolution preserves the conflict and leaves review open with actionable error', async () => {
    const onKeepMine = vi.fn().mockResolvedValue(false)

    render(
      <SyncConflictBanner
        conflictVersionId="remote-ver-1"
        onKeepMine={onKeepMine}
        onUseRemote={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep my version' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not preserve local version.')
    })

    // Review dialog remains open for retry
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Buttons are re-enabled
    expect(screen.getByRole('button', { name: 'Keep my version' })).not.toBeDisabled()
  })

  it('6. prevents resolving stale conflict when a newer conflict arrives while review is open', async () => {
    const onKeepMine = vi.fn().mockResolvedValue(true)

    const { rerender } = render(
      <SyncConflictBanner
        conflictVersionId="v1"
        onKeepMine={onKeepMine}
        onUseRemote={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Newer conflict arrives with v2
    rerender(
      <SyncConflictBanner
        conflictVersionId="v2"
        onKeepMine={onKeepMine}
        onUseRemote={vi.fn()}
      />,
    )

    expect(
      screen.getByText(
        'This conflict was updated by newer changes from another sync. Please close this dialog and review the updated versions.',
      ),
    ).toBeInTheDocument()

    const keepBtn = screen.getByRole('button', { name: 'Keep my version' })
    expect(keepBtn).toBeDisabled()
    fireEvent.click(keepBtn)
    expect(onKeepMine).not.toHaveBeenCalled()
  })

  it('7a. successful remote selection updates the UI and clears banner', async () => {
    const onUseRemote = vi.fn().mockResolvedValue(true)

    render(
      <SyncConflictBanner
        conflictVersionId="v1"
        onKeepMine={vi.fn()}
        onUseRemote={onUseRemote}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use other version' }))

    await waitFor(() => {
      expect(onUseRemote).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole('region', { name: 'Conflicting changes' })).not.toBeInTheDocument()
  })

  it('7b. successful merge selection updates the UI and clears banner', async () => {
    const onMerge = vi.fn().mockResolvedValue(true)
    const baseContent = 'Base line 1\nBase line 2'
    const localContent = 'Base line 1\nLocal addition'
    const remoteContent = 'Remote addition\nBase line 2'

    render(
      <SyncConflictBanner
        file={{
          ...mockFile,
          syncConflict: { ...mockFile.syncConflict!, versionId: 'v2' },
          baseContent,
        }}
        conflictVersionId="v2"
        onKeepMine={vi.fn()}
        onUseRemote={vi.fn()}
        onMerge={onMerge}
        localContent={localContent}
        remoteContent={remoteContent}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }))
    const mergeBtn = screen.getByRole('button', { name: 'Merge both versions' })
    fireEvent.click(mergeBtn)

    await waitFor(() => {
      expect(onMerge).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole('region', { name: 'Conflicting changes' })).not.toBeInTheDocument()
  })

  it('8. Later postpones without resolving or deleting conflict', () => {
    const onKeepMine = vi.fn()
    const onUseRemote = vi.fn()

    render(
      <SyncConflictBanner
        conflictVersionId="v1"
        onKeepMine={onKeepMine}
        onUseRemote={onUseRemote}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(onKeepMine).not.toHaveBeenCalled()
    expect(onUseRemote).not.toHaveBeenCalled()

    // Postponed notification remains discoverable
    expect(screen.getByText('Conflicting changes (pending review)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review changes' })).toBeInTheDocument()
  })
})
