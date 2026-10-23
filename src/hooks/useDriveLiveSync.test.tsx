// @vitest-environment jsdom
import { renderHook, act, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { useDriveLiveSync } from './useDriveLiveSync'
import * as googleDriveService from '../services/googleDrive'
import { useAuthStore } from '../stores/useAuthStore'
import * as workspaceStore from '../stores/useWorkspaceStore'

vi.mock('../services/googleDrive', () => ({
  refreshDriveFileToLocal: vi.fn(),
}))

vi.mock('../stores/useWorkspaceStore', () => ({
  isLocalWorkspace: vi.fn(),
}))

describe('useDriveLiveSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.mocked(workspaceStore.isLocalWorkspace).mockReturnValue(false)
    useAuthStore.setState({ isAuthenticated: true, email: 'test@example.com' })
    vi.mocked(googleDriveService.refreshDriveFileToLocal).mockResolvedValue({ updated: false })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('does nothing when disabled or missing driveFileId', () => {
    renderHook(() => useDriveLiveSync('doc-1', null, { enabled: false }))
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(googleDriveService.refreshDriveFileToLocal).not.toHaveBeenCalled()

    renderHook(() => useDriveLiveSync('doc-1', undefined, { enabled: true }))
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(googleDriveService.refreshDriveFileToLocal).not.toHaveBeenCalled()
  })

  it('periodically polls refreshDriveFileToLocal when enabled', async () => {
    renderHook(() => useDriveLiveSync('doc-1', 'drive-1', { enabled: true, intervalMs: 5000 }))
    expect(googleDriveService.refreshDriveFileToLocal).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(googleDriveService.refreshDriveFileToLocal).toHaveBeenCalledWith('doc-1')
    expect(googleDriveService.refreshDriveFileToLocal).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(googleDriveService.refreshDriveFileToLocal).toHaveBeenCalledTimes(2)
  })

  it('pauses Drive polling while the document has active local edits, then resumes', async () => {
    const { rerender } = renderHook(
      ({ isEditing }) => useDriveLiveSync('doc-1', 'drive-1', { enabled: true, intervalMs: 5000, isEditing }),
      { initialProps: { isEditing: true } }
    )

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(googleDriveService.refreshDriveFileToLocal).not.toHaveBeenCalled()

    rerender({ isEditing: false })
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(googleDriveService.refreshDriveFileToLocal).toHaveBeenCalledWith('doc-1')
    expect(googleDriveService.refreshDriveFileToLocal).toHaveBeenCalledTimes(1)
  })

  it('does not start an immediate focus refresh while the user is editing', async () => {
    renderHook(() => useDriveLiveSync('doc-1', 'drive-1', { enabled: true, intervalMs: 5000, isEditing: true }))

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(googleDriveService.refreshDriveFileToLocal).not.toHaveBeenCalled()
  })

  it('skips polling when offline or in local workspace', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    renderHook(() => useDriveLiveSync('doc-1', 'drive-1', { enabled: true, intervalMs: 5000 }))

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(googleDriveService.refreshDriveFileToLocal).not.toHaveBeenCalled()

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    vi.mocked(workspaceStore.isLocalWorkspace).mockReturnValue(true)

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(googleDriveService.refreshDriveFileToLocal).not.toHaveBeenCalled()
  })

  it('triggers immediate refresh on window focus and visibility change', async () => {
    renderHook(() => useDriveLiveSync('doc-1', 'drive-1', { enabled: true, intervalMs: 5000 }))

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(googleDriveService.refreshDriveFileToLocal).toHaveBeenCalledTimes(1)

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(googleDriveService.refreshDriveFileToLocal).toHaveBeenCalledTimes(2)
  })

  it('cleans up interval and listeners on unmount', async () => {
    const { unmount } = renderHook(() => useDriveLiveSync('doc-1', 'drive-1', { enabled: true, intervalMs: 5000 }))
    unmount()
    vi.mocked(googleDriveService.refreshDriveFileToLocal).mockClear()

    await act(async () => {
      vi.advanceTimersByTime(10000)
      window.dispatchEvent(new Event('focus'))
    })
    expect(googleDriveService.refreshDriveFileToLocal).not.toHaveBeenCalled()
  })
})
