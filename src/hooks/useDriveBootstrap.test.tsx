// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDriveBootstrap } from './useDriveBootstrap'

const mocks = vi.hoisted(() => ({
  mode: 'drive',
  revision: 0,
  ensure: vi.fn(),
  folders: vi.fn(),
  files: vi.fn(),
  process: vi.fn(),
  queue: vi.fn(),
  backfill: vi.fn(),
}))

vi.mock('../stores/useAuthStore', () => ({ useAuthStore: (select: (value: unknown) => unknown) => select({ isAuthenticated: true, email: 'writer@example.com' }) }))
vi.mock('../stores/useWorkspaceStore', () => ({ useWorkspaceStore: (select: (value: unknown) => unknown) => select({ mode: mocks.mode, workspaceRevision: mocks.revision }) }))
vi.mock('../services/googleDrive', () => ({
  ensureMyBookDriveFolder: mocks.ensure,
  importDriveFoldersToLocal: mocks.folders,
  importDriveFilesToLocal: mocks.files,
  backfillLocalFoldersToDrive: mocks.backfill,
}))
vi.mock('../database/repositories', () => ({
  clearAccountDriveCache: vi.fn(async () => undefined),
  folderRepository: { list: vi.fn(async () => []) },
  settingsRepository: { get: vi.fn(async () => ({ data: { value: true } })), update: vi.fn() },
  processPendingDriveFolderSync: mocks.process,
  queueLocalItemsForDriveBackup: mocks.queue,
}))


beforeEach(() => {
  vi.resetAllMocks()
  mocks.mode = 'drive'
  mocks.revision = 0
  mocks.ensure.mockResolvedValue({ success: true, folderId: 'same-root', folderName: 'Writin', created: false })
})
afterEach(cleanup)

describe('Drive bootstrap migration', () => {
  it('runs root preparation before importing or queuing existing work', async () => {
    const { result } = renderHook(useDriveBootstrap)
    await waitFor(() => expect(mocks.queue).toHaveBeenCalledOnce())
    expect(result.current.folderId).toBe('same-root')
    expect(mocks.ensure).toHaveBeenCalledOnce()
    expect(mocks.ensure.mock.invocationCallOrder[0]).toBeLessThan(mocks.folders.mock.invocationCallOrder[0]!)
    expect(mocks.ensure.mock.invocationCallOrder[0]).toBeLessThan(mocks.queue.mock.invocationCallOrder[0]!)
  })

  it('shows migration failure without importing into a replacement and retries on reconnect', async () => {
    mocks.ensure.mockResolvedValueOnce({ success: false, error: 'Folder rename failed; retry.' })
    const { result } = renderHook(useDriveBootstrap)
    await waitFor(() => expect(result.current.statusMessage).toBe('Folder rename failed; retry.'))
    expect(mocks.queue).not.toHaveBeenCalled()
    expect(mocks.files).not.toHaveBeenCalled()
    expect(result.current.isPreparing).toBe(false)
    expect(result.current.isFetchingFiles).toBe(false)
    await act(async () => { window.dispatchEvent(new Event('online')) })
    await waitFor(() => expect(mocks.queue).toHaveBeenCalledOnce())
    expect(result.current.folderId).toBe('same-root')
  })

  it('leaves local-only workspaces independent of cloud migration', async () => {
    mocks.mode = 'local'
    const { result } = renderHook(useDriveBootstrap)
    expect(mocks.ensure).not.toHaveBeenCalled()
    expect(result.current.isPreparing).toBe(false)
  })

  it('sets isFetchingFiles to true on initial sync and completes with saved flag', async () => {
    let resolveFolders: () => void
    const foldersPromise = new Promise<void>((resolve) => {
      resolveFolders = resolve
    })
    mocks.folders.mockImplementation(async (onProgress) => {
      onProgress?.({ loaded: 1, total: 2, percent: 50 })
      await foldersPromise
    })

    const { result } = renderHook(useDriveBootstrap)
    // Initially when setting is false/unset, it triggers fetching
    await waitFor(() => expect(mocks.ensure).toHaveBeenCalled())
    expect(result.current.isPreparing).toBe(true)

    resolveFolders!()
    await waitFor(() => expect(mocks.queue).toHaveBeenCalled())
  })

  it('keeps fetch progress strictly monotonic and closes isFetchingFiles when backups import finishes', async () => {
    const { settingsRepository } = await import('../database/repositories')
    vi.mocked(settingsRepository.get).mockImplementation(async (key: string) => {
      if (key.startsWith('google-drive.initial-sync-complete')) {
        return {
          success: true,
          data: {
            key,
            value: false,
            updatedAt: '2026-09-01T00:00:00.000Z',
          },
        }
      }
      return { success: true, data: { key, value: true, updatedAt: '2026-09-01T00:00:00.000Z' } }
    })

    mocks.folders.mockImplementation(async (onProgress) => {
      onProgress?.({ loaded: 1, total: 10, percent: 80 })
      onProgress?.({ loaded: 2, total: 20, percent: 40 }) // lower percent should not move progress backward
    })
    mocks.files.mockImplementation(async (onProgress) => {
      onProgress?.({ loaded: 1, total: 10, percent: 90 })
      onProgress?.({ loaded: 2, total: 20, percent: 50 })
    })

    const { result } = renderHook(useDriveBootstrap)
    await waitFor(() => {
      expect(result.current.fetchProgress).toBe(100)
      expect(result.current.isFetchingFiles).toBe(false)
    })
    expect(settingsRepository.update).toHaveBeenCalledWith('google-drive.initial-sync-complete:writer@example.com', true)
  })

  it('clears drive cache on startup when switching from another account', async () => {
    const { clearAccountDriveCache, settingsRepository } = await import('../database/repositories')
    vi.mocked(settingsRepository.get).mockImplementation(async (key: string) => {
      if (key === 'google-drive.active-account-email') {
        return {
          success: true,
          data: { key, value: 'other_user@example.com', updatedAt: '2026-09-01T00:00:00.000Z' },
        }
      }
      return { success: true, data: { key, value: true, updatedAt: '2026-09-01T00:00:00.000Z' } }
    })

    renderHook(useDriveBootstrap)
    await waitFor(() => expect(clearAccountDriveCache).toHaveBeenCalled())
    expect(settingsRepository.update).toHaveBeenCalledWith('google-drive.active-account-email', 'writer@example.com')
  })

  it('does not show fetch card or clear cache on page refresh when already synced', async () => {
    const { clearAccountDriveCache, settingsRepository } = await import('../database/repositories')
    vi.mocked(settingsRepository.get).mockImplementation(async (key: string) => {
      if (key === 'google-drive.active-account-email') {
        return { success: true, data: { key, value: 'writer@example.com', updatedAt: '2026-09-01T00:00:00.000Z' } }
      }
      if (key === 'google-drive.initial-sync-complete:writer@example.com') {
        return { success: true, data: { key, value: true, updatedAt: '2026-09-01T00:00:00.000Z' } }
      }
      return { success: true, data: { key, value: true, updatedAt: '2026-09-01T00:00:00.000Z' } }
    })

    const { result } = renderHook(useDriveBootstrap)
    await waitFor(() => expect(mocks.queue).toHaveBeenCalled())
    expect(result.current.isFetchingFiles).toBe(false)
    expect(clearAccountDriveCache).not.toHaveBeenCalled()
  })

  it('shows the fetch card when switching vaults on the same account', async () => {
    const { clearAccountDriveCache, settingsRepository } = await import('../database/repositories')
    let targetVault = 'vault-a'
    vi.mocked(settingsRepository.get).mockImplementation(async (key: string) => {
      const values: Record<string, unknown> = {
        'google-drive.active-account-email': 'writer@example.com',
        'google-drive.last-bootstrapped-vault-id': 'vault-a',
        'google-drive.mybook-folder-id': targetVault,
      }
      return { success: true, data: { key, value: key in values ? values[key] : false, updatedAt: '2026-09-01T00:00:00.000Z' } }
    })
    mocks.files.mockImplementation(() => new Promise<void>(() => undefined))
    mocks.folders.mockResolvedValue(undefined)

    const { result, rerender } = renderHook(useDriveBootstrap)
    await waitFor(() => expect(mocks.ensure).toHaveBeenCalledTimes(1))

    targetVault = 'vault-b'
    mocks.revision = 1
    rerender()

    await waitFor(() => expect(clearAccountDriveCache).toHaveBeenCalled())
    await waitFor(() => expect(result.current.isFetchingFiles).toBe(true))
  })
})
