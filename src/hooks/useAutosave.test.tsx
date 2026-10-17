// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MyBookFile } from '../types/files'
import { fileRepository } from '../database/repositories'
import { useAutosave } from './useAutosave'

vi.mock('../database/repositories', () => ({ fileRepository: { update: vi.fn().mockResolvedValue({ success: true }) } }))
vi.mock('../stores/useWorkspaceStore', () => ({ isLocalWorkspace: () => false }))

const file = (content: string): MyBookFile => ({
  id: 'file-1', driveFileId: 'drive-1', name: 'Doc', type: 'document', folderId: null, content, mimeType: 'x',
  createdAt: '', updatedAt: '', lastSyncedAt: '2026-10-03T12:00:00.000Z', syncStatus: 'backed-up', isDeleted: false,
})

describe('useAutosave external updates', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('adopts incoming content when there are no unsaved edits', () => {
    const { result, rerender } = renderHook(({ f }) => useAutosave(f), { initialProps: { f: file('a') } })
    rerender({ f: file('b') })
    expect(result.current.content).toBe('b')
  })

  it('keeps unsaved edits when store changes under active typing', () => {
    const { result, rerender } = renderHook(({ f }) => useAutosave(f), { initialProps: { f: file('a') } })
    act(() => result.current.setContent('typed locally'))
    expect(result.current.hasUnsavedChanges()).toBe(true)

    rerender({ f: file('remote') })

    expect(result.current.content).toBe('typed locally')
  })

  it('reports which file the hydrated content belongs to', () => {
    const { result, rerender } = renderHook(({ f }) => useAutosave(f), { initialProps: { f: file('a') } })
    expect(result.current.hydratedFileId).toBe('file-1')
    rerender({ f: { ...file(''), id: 'file-2' } })
    expect(result.current.hydratedFileId).toBe('file-2')
    expect(result.current.content).toBe('')
  })

  it('saves pending edits to the previous file when switching files', () => {
    const { result, rerender } = renderHook(({ f }) => useAutosave(f), { initialProps: { f: file('a') } })
    act(() => result.current.setContent('typed just before switching'))

    rerender({ f: { ...file('other'), id: 'file-2' } })

    expect(fileRepository.update).toHaveBeenCalledWith('file-1', expect.objectContaining({ content: 'typed just before switching' }))
    expect(result.current.content).toBe('other')
  })
})
