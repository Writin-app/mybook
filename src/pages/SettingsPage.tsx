import { ArrowDownTrayIcon, ArrowPathIcon, ArrowRightStartOnRectangleIcon, ArrowUpTrayIcon, CloudArrowUpIcon, FolderOpenIcon, MoonIcon, ShieldCheckIcon, SunIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'

import { AppButton } from '../components/common/AppButton'
import { Progress } from '../components/ui/progress'
import { usePwaStore } from '../stores/usePwaStore'
import { useDriveBootstrap } from '../hooks/useDriveBootstrap'
import { getDriveFolderStatus, openMyBookFolderInDrive } from '../services/googleDrive'
import { exportLocalWorkspaceBackup, importLocalWorkspaceBackup } from '../services/localBackup'
import { downloadVaultZip } from '../services/vaultExport'
import {
  canPickDeviceDirectory,
  getLocalStorageProtectionStatus,
  getLocalWorkspaceDetails,
  pickLocalWorkspaceDirectory,
  requestPersistentLocalStorage,
  saveDeviceDirectoryHandle,
  saveLocalWorkspaceDetails,
  writeLocalWorkspaceFile,
} from '../services/localWorkspace'
import { useAuthStore } from '../stores/useAuthStore'
import { db } from '../database/db'
import { processPendingDriveFolderSync } from '../database/repositories'
import { APP_VERSION } from '../config/app'
import { useAppStore } from '../stores/useAppStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { toast } from '../components/ui/toast'

export function SettingsPage() {
  const { email, logout, reconnect } = useAuthStore()
  const { mode: workspaceMode, clearWorkspace, selectGoogleWorkspace } = useWorkspaceStore()
  const { theme, toggleTheme } = useAppStore()
  const navigate = useNavigate()
  const backupInputRef = useRef<HTMLInputElement>(null)
  const { isPreparing, statusMessage } = useDriveBootstrap()
  const [storedFolderId, setStoredFolderId] = useState<string | null>(null)
  const [databaseStatus, setDatabaseStatus] = useState<'checking' | 'ready' | 'failed'>('checking')
  const [storageStatus, setStorageStatus] = useState<{ persisted: boolean; usage?: number; quota?: number } | null>(null)
  const [backupAction, setBackupAction] = useState<'export' | 'import' | 'persist' | null>(null)
  const [mirroredFolder, setMirroredFolder] = useState<string | null>(null)
  const [isMirroring, setIsMirroring] = useState(false)
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const needRefresh = usePwaStore((state) => state.needRefresh)
  const isUpdating = usePwaStore((state) => state.isUpdating)
  const updateProgress = usePwaStore((state) => state.updateProgress)
  const updateStatusMessage = usePwaStore((state) => state.updateStatusMessage)
  const startUpdate = usePwaStore((state) => state.startUpdate)
  const checkForUpdates = usePwaStore((state) => state.checkForUpdates)
  const supportsDeviceFolder = canPickDeviceDirectory()
  const files = useLiveQuery(() => db.files.filter((file) => {
    const belongsToLocal = file.workspaceType === 'local' || (!file.workspaceType && file.syncStatus === 'local' && !file.driveFileId)
    return !file.isDeleted && (workspaceMode === 'local' ? belongsToLocal : !belongsToLocal)
  }).toArray(), [workspaceMode], []) ?? []
  const syncQueue = useLiveQuery(() => db.syncQueue.toArray(), [], []) ?? []
  const backupStats = {
    total: files.length,
    backedUp: files.filter((file) => file.syncStatus === 'backed-up' && Boolean(file.driveFileId)).length,
    pending: files.filter((file) => file.syncStatus === 'pending' || file.syncStatus === 'backing-up' || file.syncStatus === 'offline').length,
    failed: files.filter((file) => file.syncStatus === 'failed').length,
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      if (workspaceMode === 'local') {
        setStoredFolderId(null)
        return
      }
      const id = await getDriveFolderStatus()
      if (active) setStoredFolderId(id)
    }
    void load()
    return () => { active = false }
  }, [workspaceMode])
  useEffect(() => {
    void db.open().then(() => setDatabaseStatus('ready')).catch(() => setDatabaseStatus('failed'))
  }, [])
  useEffect(() => {
    let active = true
    void getLocalStorageProtectionStatus().then((status) => {
      if (active) setStorageStatus(status)
    }).catch(() => {
      if (active) setStorageStatus({ persisted: false })
    })
    return () => { active = false }
  }, [])
  useEffect(() => {
    let active = true
    void getLocalWorkspaceDetails().then((details) => {
      if (active && details?.storage === 'file-system') {
        setMirroredFolder(details.name)
      }
    })
    return () => { active = false }
  }, [])

  const handleLogout = async () => {
    await logout()
    clearWorkspace()
    navigate('/login', { replace: true, state: null })
  }

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdates(true)
    try {
      const hasUpdate = await checkForUpdates()
      if (hasUpdate) {
        toast.add({
          title: 'Update ready',
          description: 'A new version of Writin is ready to install.',
          type: 'info',
        })
      } else {
        toast.add({
          title: 'Up to date',
          description: `Writin version ${APP_VERSION} is the latest version.`,
          type: 'info',
        })
      }
    } finally {
      setIsCheckingUpdates(false)
    }
  }

  const isLocalMode = workspaceMode === 'local'

  const handleMakeAllAvailableLocally = async () => {
    setIsMirroring(true)
    try {
      const picked = await pickLocalWorkspaceDirectory()
      if (!picked) return
      await saveDeviceDirectoryHandle(picked.handle)
      await saveLocalWorkspaceDetails({
        name: picked.name,
        storage: 'file-system',
        createdAt: new Date().toISOString(),
      })
      setMirroredFolder(picked.name)
      const activeFiles = await db.files.filter((f) => !f.isDeleted).toArray()
      for (const f of activeFiles) {
        await writeLocalWorkspaceFile(f)
      }
      toast.add({
        title: 'Drive files mirrored',
        description: `All files are now available in "${picked.name}" on this computer.`,
        type: 'success',
        priority: 'low',
      })
    } catch (error) {
      toast.add({
        title: 'Could not mirror files',
        description: error instanceof Error ? error.message : 'Please try again.',
        type: 'error',
        priority: 'low',
      })
    } finally {
      setIsMirroring(false)
    }
  }

  const protectStorage = async () => {
    setBackupAction('persist')
    try {
      const persisted = await requestPersistentLocalStorage()
      const nextStatus = await getLocalStorageProtectionStatus()
      setStorageStatus(nextStatus)
      toast.add({ title: persisted ? 'Local storage protection enabled' : 'Storage protection is not available here', type: persisted ? 'success' : 'warning', priority: 'low' })
    } finally {
      setBackupAction(null)
    }
  }

  const exportBackup = async () => {
    setBackupAction('export')
    try {
      const result = await exportLocalWorkspaceBackup()
      toast.add({ title: result.method === 'share' ? 'Backup ready to save' : 'Backup downloaded', description: result.fileName, type: 'success', priority: 'low' })
    } catch (error) {
      toast.add({ title: 'Could not export backup', description: error instanceof Error ? error.message : 'Please try again.', type: 'error', priority: 'low' })
    } finally {
      setBackupAction(null)
    }
  }

  const importBackup = async (file: File | undefined) => {
    if (!file) return
    setBackupAction('import')
    try {
      const result = await importLocalWorkspaceBackup(file)
      toast.add({ title: 'Backup imported', description: `${result.fileCount} files restored into a new folder.`, type: 'success', priority: 'low' })
      navigate(`/folders/${result.folderId}`)
    } catch (error) {
      toast.add({ title: 'Could not import backup', description: error instanceof Error ? error.message : 'Choose a valid Writin backup file.', type: 'error', priority: 'low' })
    } finally {
      setBackupAction(null)
      if (backupInputRef.current) backupInputRef.current.value = ''
    }
  }

  const connectDriveBackup = () => {
    selectGoogleWorkspace()
    navigate('/login', { replace: false, state: { from: '/settings' } })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4">
      <section aria-labelledby="appearance-heading" className="rounded-2xl bg-muted/70 p-4">
        <h2 id="appearance-heading" className="text-base font-semibold leading-6">Appearance</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Choose how Writin looks on this device.</p>
        <AppButton className="mt-3" variant="secondary" onPress={toggleTheme}>
          {theme === 'light' ? <MoonIcon aria-hidden="true" className="size-5" /> : <SunIcon aria-hidden="true" className="size-5" />}
          Use {theme === 'light' ? 'dark' : 'light'} theme
        </AppButton>
      </section>
      <section aria-labelledby="account-heading" className="rounded-2xl bg-muted/70 p-4">
        <h2 id="account-heading" className="text-base font-semibold leading-6">Account</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {isLocalMode ? 'Using a local workspace on this device.' : email ? `Signed in as ${email}.` : 'Your Google session will appear here after sign-in.'}
        </p>
        <AppButton className="mt-4" variant="secondary" onPress={() => void handleLogout()}>
          <ArrowRightStartOnRectangleIcon aria-hidden="true" className="size-5" />
          {isLocalMode ? 'Return to start' : 'Log out'}
        </AppButton>
      </section>
      <section aria-labelledby="drive-heading" className="rounded-2xl bg-muted/70 p-4">
        <h2 id="drive-heading" className="text-base font-semibold leading-6">Google Drive</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {isLocalMode
            ? 'Google Drive is not connected for this local workspace.'
            : isPreparing
            ? 'Checking your Writin Drive folder...'
            : storedFolderId
              ? 'Writin folder is connected.'
              : 'Writin folder is not connected yet.'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLocalMode ? 'Files are saved locally first. Connect Google Drive to start automatic cloud backup.' : statusMessage ?? 'Writin syncs your files across signed-in devices using Drive backups.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <AppButton
            variant="secondary"
            isDisabled={isLocalMode || !storedFolderId}
            onPress={() => {
              if (storedFolderId) openMyBookFolderInDrive(storedFolderId)
            }}
          >
            Open Writin folder in Drive
          </AppButton>
          <AppButton variant="secondary" isDisabled={isLocalMode} onPress={() => void reconnect()}>
            Reconnect
          </AppButton>
          {isLocalMode ? (
            <AppButton variant="primary" onPress={connectDriveBackup}>
              <CloudArrowUpIcon aria-hidden="true" className="size-5" />
              Connect Google Drive backup
            </AppButton>
          ) : null}
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([['Local files', backupStats.total], [isLocalMode ? 'Stored locally' : 'Synced', isLocalMode ? backupStats.total : backupStats.backedUp], ['Syncing', isLocalMode ? 0 : backupStats.pending], ['Sync paused', isLocalMode ? 0 : backupStats.failed]] as const).map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--app-border)] p-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold">{value}</dd></div>)}
        </dl>
        {!isLocalMode && backupStats.failed > 0 ? <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><p className="font-medium">Sync paused</p>{files.filter((file) => file.syncStatus === 'failed').map((file) => <p key={file.id} className="mt-1 text-muted-foreground">{file.name}: {file.syncError ?? 'Sync failed.'}</p>)}</div> : null}
      </section>
      {!isLocalMode && supportsDeviceFolder ? (
        <section aria-labelledby="mirror-heading" className="rounded-2xl bg-muted/70 p-4">
          <h2 id="mirror-heading" className="text-base font-semibold leading-6">Mirror Drive files to folder</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Mirror your Google Drive files to a chosen folder on your computer for offline access and two-way syncing.
          </p>
          {mirroredFolder ? (
            <div className="mt-3 rounded-xl border border-[var(--app-border)] p-3 text-sm">
              <span className="font-medium text-foreground">Mirrored local folder: </span>
              <span className="text-muted-foreground">{mirroredFolder}</span>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <AppButton
              variant="secondary"
              isLoading={isMirroring}
              loadingLabel="Mirroring..."
              onPress={() => void handleMakeAllAvailableLocally()}
            >
              <FolderOpenIcon aria-hidden="true" className="size-5" />
              {mirroredFolder ? 'Change mirrored folder' : 'Make All Available Locally'}
            </AppButton>
          </div>
        </section>
      ) : null}
      {isLocalMode ? (
        <section aria-labelledby="backup-heading" className="rounded-2xl bg-muted/70 p-4">
          <h2 id="backup-heading" className="text-base font-semibold leading-6">Local backup</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Save a backup file to Files or iCloud Drive, or restore a backup into a new imported folder.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--app-border)] p-3">
              <dt className="text-sm text-muted-foreground">Storage protection</dt>
              <dd className="mt-1 font-medium">{storageStatus?.persisted ? 'Protected' : 'Best effort'}</dd>
            </div>
            <div className="rounded-xl border border-[var(--app-border)] p-3">
              <dt className="text-sm text-muted-foreground">Used</dt>
              <dd className="mt-1 font-medium">{formatBytes(storageStatus?.usage)}</dd>
            </div>
            <div className="rounded-xl border border-[var(--app-border)] p-3">
              <dt className="text-sm text-muted-foreground">Available quota</dt>
              <dd className="mt-1 font-medium">{formatBytes(storageStatus?.quota)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <AppButton variant="secondary" isLoading={backupAction === 'persist'} loadingLabel="Checking..." onPress={() => void protectStorage()}>
              <ShieldCheckIcon aria-hidden="true" className="size-5" />
              Protect storage
            </AppButton>
            <AppButton variant="secondary" isLoading={backupAction === 'export'} loadingLabel="Preparing..." onPress={() => void exportBackup()}>
              <ArrowUpTrayIcon aria-hidden="true" className="size-5" />
              Export JSON backup
            </AppButton>
            <AppButton variant="secondary" onPress={() => void downloadVaultZip()}>
              <ArrowUpTrayIcon aria-hidden="true" className="size-5" />
              Export full vault (ZIP)
            </AppButton>
            <AppButton variant="secondary" isLoading={backupAction === 'import'} loadingLabel="Importing..." onPress={() => backupInputRef.current?.click()}>
              <ArrowDownTrayIcon aria-hidden="true" className="size-5" />
              Import backup
            </AppButton>
          </div>
          <input
            ref={backupInputRef}
            type="file"
            accept=".mybook-backup.json,application/json"
            aria-hidden="true"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => void importBackup(event.target.files?.[0])}
          />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Protection helps prevent automatic browser cleanup. Export or Drive backup is still needed before removing app or browser data.
          </p>
        </section>
      ) : null}
      <section aria-labelledby="files-heading" className="rounded-2xl bg-muted/70 p-4">
        <h2 id="files-heading" className="text-base font-semibold leading-6">Files</h2>
        <AppButton className="mt-4" variant="secondary" onPress={() => navigate('/trash')}><TrashIcon aria-hidden="true" className="size-5" />Open Trash</AppButton>
      </section>
      <section aria-labelledby="updates-heading" className="rounded-2xl bg-muted/70 p-4">
        <h2 id="updates-heading" className="text-base font-semibold leading-6">App version & updates</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Writin version {APP_VERSION}</p>
            <p className="text-sm text-muted-foreground">
              {needRefresh
                ? 'A newer version of Writin is ready to install.'
                : 'You are using the latest version of Writin.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {needRefresh ? (
              <AppButton
                variant="primary"
                isLoading={isUpdating}
                loadingLabel="Updating…"
                onPress={() => void startUpdate()}
              >
                <ArrowPathIcon aria-hidden="true" className="size-4" />
                Update now
              </AppButton>
            ) : (
              <AppButton
                variant="secondary"
                isLoading={isCheckingUpdates}
                loadingLabel="Checking…"
                onPress={() => void handleCheckForUpdates()}
              >
                <ArrowPathIcon aria-hidden="true" className="size-4" />
                Check for updates
              </AppButton>
            )}
          </div>
        </div>
        {isUpdating ? (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">{updateStatusMessage ?? 'Updating…'}</p>
            <Progress value={updateProgress} className="w-full" />
          </div>
        ) : null}
      </section>
      <section aria-labelledby="privacy-heading" className="rounded-2xl bg-muted/70 p-4">
        <h2 id="privacy-heading" className="text-base font-semibold leading-6">Privacy and personal use</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Writin keeps editable files locally in this browser. Google Drive stores your backups in the Writin folder and syncs them across connected devices. Access tokens are never included in links or logs.</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">This application is provided for personal use. Keep independent copies of important information and review Google permissions before connecting an account.</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] pt-4">
          <p className="text-sm text-muted-foreground">Writin version {APP_VERSION}</p>
          <AppButton variant="secondary" onPress={() => navigate('/about')}>About Writin & Features</AppButton>
        </div>
      </section>
      <section aria-labelledby="diagnostics-heading" className="rounded-2xl bg-muted/70 p-4">
        <h2 id="diagnostics-heading" className="text-base font-semibold leading-6">Sync diagnostics</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Technical health information for recovery and troubleshooting. Private document content and access tokens are never shown.</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--app-border)] p-3"><dt className="text-sm text-muted-foreground">Local database</dt><dd className="mt-1 font-medium">{databaseStatus === 'ready' ? 'Available' : databaseStatus === 'failed' ? 'Unavailable' : 'Checking…'}</dd></div>
          <div className="rounded-xl border border-[var(--app-border)] p-3"><dt className="text-sm text-muted-foreground">Queued operations</dt><dd className="mt-1 font-medium">{syncQueue.filter((item) => item.status !== 'completed').length}</dd></div>
          <div className="rounded-xl border border-[var(--app-border)] p-3"><dt className="text-sm text-muted-foreground">Failed operations</dt><dd className="mt-1 font-medium">{syncQueue.filter((item) => item.status === 'failed').length}</dd></div>
        </dl>
        {!isLocalMode && syncQueue.some((item) => item.status === 'failed') ? <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><p className="font-medium">Some Drive operations need attention.</p>{syncQueue.filter((item) => item.status === 'failed').slice(0, 5).map((item) => <p key={item.id} className="mt-1 text-muted-foreground">{item.entityType} {item.operation}: {item.errorMessage ?? 'Retry required.'}</p>)}</div> : null}
        <AppButton className="mt-4" variant="secondary" isDisabled={isLocalMode} onPress={() => void processPendingDriveFolderSync()}>Retry Drive sync</AppButton>
      </section>
    </div>
  )
}

function formatBytes(value: number | undefined) {
  if (!value) return 'Unknown'
  const units = ['B', 'KB', 'MB', 'GB'] as const
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}
