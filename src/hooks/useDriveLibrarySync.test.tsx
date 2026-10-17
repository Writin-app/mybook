// @vitest-environment jsdom
import { renderHook, act, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { useDriveLibrarySync } from './useDriveLibrarySync'
import { processPendingDriveFolderSync } from '../database/repositories'
import { importDriveBackupsToLocal } from './useDriveBootstrap'
import { useAuthStore } from '../stores/useAuthStore'
import * as workspaceStore from '../stores/useWorkspaceStore'

vi.mock('../database/repositories', () => ({
  processPendingDriveFolderSync: vi.fn(),
}))

vi.mock('./useDriveBootstrap', () => ({
  importDriveBackupsToLocal: vi.fn(),
}))

vi.mock('../stores/useWorkspaceStore', () => ({
  isLocalWorkspace: vi.fn(),
}))

describe('useDriveLibrarySync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.mocked(workspaceStore.isLocalWorkspace).mockReturnValue(false)
    vi.mocked(processPendingDriveFolderSync).mockResolvedValue(undefined)
    vi.mocked(importDriveBackupsToLocal).mockResolvedValue(undefined)
    useAuthStore.setState({ isAuthenticated: true, email: 'test@example.com' })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('pushes the queue then pulls from Drive on each interval', async () => {
    renderHook(() => useDriveLibrarySync({ intervalMs: 1000 }))
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(processPendingDriveFolderSync).toHaveBeenCalledTimes(1)
    expect(importDriveBackupsToLocal).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(importDriveBackupsToLocal).toHaveBeenCalledTimes(2)
  })

  it('skips when disabled, offline, local, unauthenticated or hidden', async () => {
    const { unmount } = renderHook(() => useDriveLibrarySync({ intervalMs: 1000, enabled: false }))
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    unmount()

    renderHook(() => useDriveLibrarySync({ intervalMs: 1000 }))
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

    vi.mocked(workspaceStore.isLocalWorkspace).mockReturnValue(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    vi.mocked(workspaceStore.isLocalWorkspace).mockReturnValue(false)

    useAuthStore.setState({ isAuthenticated: false })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    useAuthStore.setState({ isAuthenticated: true })

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })

    expect(processPendingDriveFolderSync).not.toHaveBeenCalled()
    expect(importDriveBackupsToLocal).not.toHaveBeenCalled()
  })

  it('does not overlap runs while one is in flight', async () => {
    let release: () => void = () => {}
    vi.mocked(importDriveBackupsToLocal).mockImplementation(() => new Promise<void>((resolve) => { release = resolve }))
    renderHook(() => useDriveLibrarySync({ intervalMs: 1000 }))
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(processPendingDriveFolderSync).toHaveBeenCalledTimes(1)
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(1000) })
    expect(processPendingDriveFolderSync).toHaveBeenCalledTimes(2)
  })

  it('syncs when the window regains focus and survives failures', async () => {
    vi.mocked(processPendingDriveFolderSync).mockRejectedValueOnce(new Error('boom'))
    renderHook(() => useDriveLibrarySync({ intervalMs: 60000 }))
    await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(0) })
    expect(processPendingDriveFolderSync).toHaveBeenCalledTimes(1)
    await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(0) })
    expect(importDriveBackupsToLocal).toHaveBeenCalledTimes(1)
  })
})
