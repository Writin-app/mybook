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
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

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

  it('does not overwrite newer typing when an in-flight save resolves and handles trailing save', async () => {
    let resolveFirstUpdate!: (value: { success: boolean }) => void
    const firstUpdatePromise = new Promise<{ success: boolean }>((resolve) => {
      resolveFirstUpdate = resolve
    })

    const updateMock = vi.mocked(fileRepository.update)
    updateMock.mockImplementationOnce(() => firstUpdatePromise)

    const { result, rerender } = renderHook(({ f }) => useAutosave(f), { initialProps: { f: file('initial') } })

    // Step 1: User types first edit
    act(() => result.current.setContent('first edit'))
    expect(result.current.hasUnsavedChanges()).toBe(true)

    // Trigger save for first edit (now in flight)
    let savePromise: Promise<boolean>
    act(() => {
      savePromise = result.current.save()
    })

    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledWith('file-1', expect.objectContaining({ content: 'first edit' }), expect.anything())

    // Step 2: User types second edit while first save is still in flight
    act(() => result.current.setContent('second edit'))
    expect(result.current.content).toBe('second edit')

    // Step 3: First save resolves
    await act(async () => {
      resolveFirstUpdate({ success: true })
      await savePromise
    })

    // Step 4: Dexie emits the record that was just saved ('first edit')
    rerender({ f: file('first edit') })

    // CRITICAL ASSERTION: The active editor content MUST NOT be overwritten by 'first edit'
    expect(result.current.content).toBe('second edit')
    expect(result.current.hasUnsavedChanges()).toBe(true)

    // Step 5: Advance timers for trailing save
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    // Verify second save runs for 'second edit'
    expect(updateMock).toHaveBeenCalledTimes(2)
    expect(updateMock).toHaveBeenCalledWith('file-1', expect.objectContaining({ content: 'second edit' }), expect.anything())
    expect(result.current.hasUnsavedChanges()).toBe(false)
  })

  it('does not overwrite content or schedule trailing save when replaceContent runs during an in-flight save', async () => {
    let resolveSave!: (value: { success: boolean }) => void
    const savePromise = new Promise<{ success: boolean }>((res) => { resolveSave = res })
    const updateMock = vi.mocked(fileRepository.update).mockImplementationOnce(() => savePromise)

    const initial = file('initial')
    const { result } = renderHook(() => useAutosave(initial))

    // Step 1: User types local edit and triggers save
    act(() => result.current.setContent('local edit'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(updateMock).toHaveBeenCalledTimes(1)

    // Step 2: While save is in flight, remote version is applied via replaceContent
    act(() => result.current.replaceContent('remote version', 'backed-up'))
    expect(result.current.content).toBe('remote version')

    // Step 3: In-flight save finishes
    await act(async () => {
      resolveSave({ success: true })
      await result.current.waitForPendingSave()
    })

    // Advance any debounced timers
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    // Step 4: Ensure content is still 'remote version' and no second save was scheduled
    expect(result.current.content).toBe('remote version')
    expect(result.current.hasUnsavedChanges()).toBe(false)
    expect(updateMock).toHaveBeenCalledTimes(1)
  })

  it('re-arms trailing save when in-flight save is rejected as stale if local typing continues', async () => {
    let resolveSave!: (value: { success: boolean; stale?: boolean }) => void
    const savePromise = new Promise<{ success: boolean; stale?: boolean }>((res) => { resolveSave = res })
    const updateMock = vi.mocked(fileRepository.update)
      .mockImplementationOnce(() => savePromise)
      .mockResolvedValueOnce({ success: true })

    const initial = file('initial')
    const { result } = renderHook(() => useAutosave(initial))

    // Step 1: User types local edit and triggers save
    act(() => result.current.setContent('first edit'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(updateMock).toHaveBeenCalledTimes(1)

    // Step 2: User types more local edits while first save is in flight
    act(() => result.current.setContent('second edit'))

    // Step 3: First save resolves as stale (e.g., rejected because a concurrent remote merge committed to Dexie)
    await act(async () => {
      resolveSave({ success: false, stale: true })
      await result.current.waitForPendingSave()
    })

    // Local buffer must be intact
    expect(result.current.content).toBe('second edit')
    expect(result.current.hasUnsavedChanges()).toBe(true)

    // Step 4: Advance timers to allow re-armed trailing save to fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    // Trailing save fired for 'second edit'
    expect(updateMock).toHaveBeenCalledTimes(2)
    expect(updateMock).toHaveBeenLastCalledWith('file-1', expect.objectContaining({ content: 'second edit' }), expect.anything())
  })
})
