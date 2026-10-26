import { useEffect, useState } from 'react'

import { backfillLocalFoldersToDrive, ensureMyBookDriveFolder, importDriveFilesToLocal, importDriveFoldersToLocal } from '../services/googleDrive'
import { useAuthStore } from '../stores/useAuthStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { clearAccountDriveCache, folderRepository, processPendingDriveFolderSync, queueLocalItemsForDriveBackup, settingsRepository } from '../database/repositories'

const DRIVE_ACTIVE_EMAIL_KEY = 'google-drive.active-account-email'
const DRIVE_ACTIVE_VAULT_KEY = 'google-drive.last-bootstrapped-vault-id'
const DRIVE_BACKFILL_KEY = 'google-drive.folder-backfill-complete'
const DRIVE_INITIAL_SYNC_KEY = (email: string, vaultId?: string | null) =>
  vaultId ? `google-drive.initial-sync-complete:${email}:${vaultId}` : `google-drive.initial-sync-complete:${email}`
let importDriveBackupsFlight: Promise<void> | null = null
const progressListeners = new Set<(progress: { loaded: number; total: number; percent: number }) => void>()
let currentProgress = { loaded: 0, total: 0, percent: 0 }

function reportFlightProgress(p: { loaded: number; total: number; percent: number }) {
  currentProgress = {
    loaded: p.loaded,
    total: p.total,
    percent: Math.max(currentProgress.percent, p.percent),
  }
  for (const listener of progressListeners) {
    try {
      listener(currentProgress)
    } catch {
      // Ignore listener error
    }
  }
}

export async function importDriveBackupsToLocal(
  onProgress?: (progress: { loaded: number; total: number; percent: number }) => void,
) {
  if (onProgress) {
    progressListeners.add(onProgress)
    if (currentProgress.percent > 0) {
      onProgress(currentProgress)
    }
  }

  if (!importDriveBackupsFlight) {
    currentProgress = { loaded: 0, total: 0, percent: 0 }
    importDriveBackupsFlight = (async () => {
      await importDriveFoldersToLocal((p) => {
        reportFlightProgress({ loaded: p.loaded, total: p.total, percent: Math.round(p.percent * 0.3) })
      })
      await importDriveFilesToLocal((p) => {
        reportFlightProgress({ loaded: p.loaded, total: p.total, percent: 30 + Math.round(p.percent * 0.7) })
      })
    })().finally(() => {
      importDriveBackupsFlight = null
      progressListeners.clear()
      currentProgress = { loaded: 0, total: 0, percent: 0 }
    })
  }

  try {
    await importDriveBackupsFlight
  } finally {
    if (onProgress) {
      progressListeners.delete(onProgress)
    }
  }
}

export function useDriveBootstrap() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const email = useAuthStore((state) => state.email)
  const workspaceMode = useWorkspaceStore((state) => state.mode)
  const workspaceRevision = useWorkspaceStore((state) => state.workspaceRevision)
  const [isPreparing, setIsPreparing] = useState(false)
  const [isFetchingFiles, setIsFetchingFiles] = useState(false)
  const [fetchProgress, setFetchProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)

  useEffect(() => {
    if (workspaceMode === 'local' || !isAuthenticated || !email) return
    let cancelled = false
    const run = async () => {
      setIsPreparing(true)
      const activeEmailSetting = (await settingsRepository.get(DRIVE_ACTIVE_EMAIL_KEY)).data?.value
      const lastVaultIdSetting = (await settingsRepository.get(DRIVE_ACTIVE_VAULT_KEY)).data?.value
      const targetFolderIdSetting = (await settingsRepository.get('google-drive.mybook-folder-id')).data?.value as string | undefined

      const isDifferentAccount = typeof activeEmailSetting === 'string' && activeEmailSetting.toLowerCase() !== email.toLowerCase()
      const isDifferentVault = Boolean(targetFolderIdSetting && lastVaultIdSetting && targetFolderIdSetting !== lastVaultIdSetting)

      const baseInitialSyncFlag = (await settingsRepository.get(DRIVE_INITIAL_SYNC_KEY(email))).data?.value === true
      const vaultInitialSyncFlag = targetFolderIdSetting
        ? (await settingsRepository.get(DRIVE_INITIAL_SYNC_KEY(email, targetFolderIdSetting))).data?.value === true
        : false
      const initialSyncFlag = vaultInitialSyncFlag || baseInitialSyncFlag

      if (isDifferentAccount || isDifferentVault) {
        await clearAccountDriveCache()
        await settingsRepository.update(DRIVE_ACTIVE_EMAIL_KEY, email.toLowerCase())
      } else if (!activeEmailSetting) {
        await settingsRepository.update(DRIVE_ACTIVE_EMAIL_KEY, email.toLowerCase())
      }

      const shouldShowInitialFetch = !initialSyncFlag || isDifferentAccount || isDifferentVault

      if (shouldShowInitialFetch && !cancelled) {
        setIsFetchingFiles(true)
        setFetchProgress((prev) => Math.max(prev, 5))
      }

      try {
        const result = await ensureMyBookDriveFolder()
        if (!cancelled) {
          if (result.success) {
            setFolderId(result.folderId)
            await settingsRepository.update(DRIVE_ACTIVE_VAULT_KEY, result.folderId)
          }
          setStatusMessage(result.success
            ? result.created
              ? 'Writin Drive folder created.'
              : 'Writin Drive folder connected.'
            : result.error)
        }
        if (!result.success) {
          if (!cancelled) {
            setIsFetchingFiles(false)
          }
          return
        }
        if (shouldShowInitialFetch && !cancelled) {
          setFetchProgress((prev) => Math.max(prev, 15))
        }
        await processPendingDriveFolderSync()
        try {
          await importDriveBackupsToLocal((p) => {
            if (shouldShowInitialFetch && !cancelled) {
              setFetchProgress((prev) => Math.max(prev, 15 + Math.round(p.percent * 0.85)))
            }
          })
          if (shouldShowInitialFetch) {
            if (!cancelled) {
              setFetchProgress(100)
            }
            await settingsRepository.update(DRIVE_INITIAL_SYNC_KEY(email), true)
            if (result.folderId) {
              await settingsRepository.update(DRIVE_INITIAL_SYNC_KEY(email, result.folderId), true)
            }
            await new Promise((resolve) => setTimeout(resolve, 600))
            if (!cancelled) {
              setIsFetchingFiles(false)
            }
          }
          if (!cancelled) setStatusMessage('Synced across devices.')
        } catch (error) {
          if (!cancelled) {
            setIsFetchingFiles(false)
            setStatusMessage(error instanceof Error ? error.message : 'Sync paused.')
          }
        }
        const backfillFlag = (await settingsRepository.get(DRIVE_BACKFILL_KEY)).data?.value
        if (backfillFlag !== true) {
          const folders = await folderRepository.list()
          const backfillResults = await backfillLocalFoldersToDrive(folders)
          const firstFailure = backfillResults.find((entry) => !entry.success)
          if (!cancelled) {
            if (firstFailure) setStatusMessage(firstFailure.error)
            else setStatusMessage('Existing folders were synced to Google Drive.')
          }
          await settingsRepository.update(DRIVE_BACKFILL_KEY, true)
        }
        await queueLocalItemsForDriveBackup()
        await processPendingDriveFolderSync()
      } catch (error) {
        if (!cancelled) setStatusMessage(error instanceof Error ? error.message : 'Sync paused. Please retry.')
      } finally {
        if (!cancelled) {
          setIsFetchingFiles(false)
          setIsPreparing(false)
        }
      }
    }
    void run()
    const onlineHandler = () => {
      void run()
    }
    window.addEventListener('online', onlineHandler)
    return () => {
      cancelled = true
      setIsFetchingFiles(false)
      setIsPreparing(false)
      window.removeEventListener('online', onlineHandler)
    }
  }, [email, isAuthenticated, workspaceMode, workspaceRevision])

  return { isPreparing, isFetchingFiles, fetchProgress, statusMessage, folderId }
}
