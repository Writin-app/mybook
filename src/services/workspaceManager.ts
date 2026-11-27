import { db } from '../database/db'
import { clearAccountDriveCache } from '../database/repositories'
import {
  getDriveVaultRootName,
  listExistingDriveVaults,
  selectExistingDriveVault,
  setDriveVaultRootName,
  type DriveVaultSummary,
} from './googleDrive'
import {
  checkDeviceDirectoryHandleValid,
  ensureLocalWorkspaceFolder,
  forgetDeviceDirectoryHandle,
  getActiveStandaloneLocalId,
  getCloudMirrorEntry,
  getDeviceDirectoryHandle,
  getLocalWorkspaceDetails,
  initializeLocalWorkspace,
  listCloudMirrorEntries,
  listStandaloneLocalVaults,
  LOCAL_DIRECTORY_HANDLE_KEY,
  saveCloudMirrorEntry,
  saveDeviceDirectoryHandle,
  saveLocalWorkspaceDetails,
  setActiveStandaloneLocalId,
  writeLocalWorkspaceFile,
  type LocalWorkspaceStoragePreference,
} from './localWorkspace'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { useAuthStore } from '../stores/useAuthStore'

export interface AppWorkspaceItem {
  id: string
  name: string
  type: 'cloud' | 'local'
  driveFolderId?: string
  hasLocalMirror?: boolean
  localFolderName?: string
  isActive: boolean
}

export async function listAllWorkspaces(): Promise<AppWorkspaceItem[]> {
  const workspaceState = useWorkspaceStore.getState()
  const workspaceMode = workspaceState.mode
  const isMirrorMissing = workspaceState.isMirrorFolderMissing
  const isAuthenticated = useAuthStore.getState().isAuthenticated
  const localDetails = await getLocalWorkspaceDetails()
  const activeDriveName = await getDriveVaultRootName()
  const activeDriveFolderId = (await db.settings.get('google-drive.mybook-folder-id'))?.value as string | undefined

  let localHandle: FileSystemDirectoryHandle | null = null
  let fallbackLocalFolderName: string | undefined
  if (!isMirrorMissing) {
    const rawHandle = await getDeviceDirectoryHandle()
    if (rawHandle) {
      fallbackLocalFolderName = rawHandle.name
      const validity = await checkDeviceDirectoryHandleValid(rawHandle)
      if (validity.valid) {
        localHandle = validity.handle ?? rawHandle
      } else if (validity.error === 'NotFoundError') {
        await forgetDeviceDirectoryHandle()
        useWorkspaceStore.getState().setMirrorFolderMissing(true)
        localHandle = null
        fallbackLocalFolderName = undefined
      }
    }
  }

  const workspaces: AppWorkspaceItem[] = []

  // 1. Cloud Workspaces (if authenticated with Google)
  const cloudMirrors = await listCloudMirrorEntries()
  if (isAuthenticated) {
    let driveVaults: DriveVaultSummary[] = []
    try {
      driveVaults = await listExistingDriveVaults()
    } catch {
      driveVaults = []
    }

    // If active drive folder is known but not returned in discovery, ensure it is in the list
    if (activeDriveFolderId && !driveVaults.some((v) => v.id === activeDriveFolderId)) {
      driveVaults.unshift({
        id: activeDriveFolderId,
        name: activeDriveName || 'Writin',
      })
    } else if (driveVaults.length === 0 && workspaceMode === 'drive') {
      driveVaults.push({
        id: activeDriveFolderId || 'active-drive-vault',
        name: activeDriveName || 'Writin',
      })
    }

    for (const vault of driveVaults) {
      const isThisActive = workspaceMode === 'drive' && (vault.id === activeDriveFolderId || vault.name.toLowerCase() === activeDriveName.toLowerCase())
      const mirrorEntry = cloudMirrors[vault.id]
      const hasLegacyMirror =
        isThisActive && !localDetails?.isStandalone && Boolean(localHandle) && !isMirrorMissing
      const hasLocalMirror = Boolean(mirrorEntry?.handle) || hasLegacyMirror
      const localFolderName =
        mirrorEntry?.handle?.name ??
        (hasLegacyMirror && localHandle ? localHandle.name : undefined)
      workspaces.push({
        id: vault.id,
        name: vault.name,
        type: 'cloud',
        driveFolderId: vault.id,
        hasLocalMirror,
        localFolderName,
        isActive: isThisActive,
      })
    }
  }

  // 2. Standalone Local Workspaces
  const isLocalActive = workspaceMode === 'local'
  const standaloneVaults = await listStandaloneLocalVaults()
  if (standaloneVaults.length > 0) {
    const activeStandaloneId = await getActiveStandaloneLocalId()
    standaloneVaults.forEach((vault, idx) => {
      const isThisLocalActive =
        isLocalActive && (activeStandaloneId ? vault.id === activeStandaloneId : idx === 0)
      workspaces.push({
        id: vault.id,
        name: vault.name,
        type: 'local',
        hasLocalMirror: vault.storage === 'file-system' && Boolean(vault.handle),
        localFolderName: vault.handle?.name,
        isActive: isThisLocalActive,
      })
    })
  } else {
    const shouldIncludeLocalWorkspace =
      !isAuthenticated || isLocalActive || Boolean(localDetails?.isStandalone)

    if (shouldIncludeLocalWorkspace) {
      const explicitLocalName =
        localDetails?.name && localDetails.name !== 'Local Vault'
          ? localDetails.name
          : undefined
      const localName =
        explicitLocalName ||
        localHandle?.name ||
        fallbackLocalFolderName ||
        localDetails?.name ||
        'Local Vault'
      workspaces.push({
        id: 'local-workspace',
        name: localName,
        type: 'local',
        hasLocalMirror: Boolean(localHandle) && !isMirrorMissing,
        localFolderName:
          !isMirrorMissing && (localHandle || fallbackLocalFolderName)
            ? (localHandle?.name ?? fallbackLocalFolderName)
            : undefined,
        isActive: isLocalActive,
      })
    }
  }

  return workspaces
}

export async function switchWorkspace(target: AppWorkspaceItem): Promise<void> {
  if (target.isActive) return

  if (target.type === 'local') {
    const standaloneVaults = await listStandaloneLocalVaults()
    const match = standaloneVaults.find((v) => v.id === target.id)
    if (match) {
      await setActiveStandaloneLocalId(match.id)
      await saveLocalWorkspaceDetails({
        name: match.name,
        storage: match.storage,
        createdAt: match.createdAt,
        isStandalone: true,
      })
      if (match.handle) {
        await saveDeviceDirectoryHandle(match.handle)
      } else {
        await db.settings.delete(LOCAL_DIRECTORY_HANDLE_KEY)
      }
    }
    useWorkspaceStore.getState().createLocalWorkspace()
    return
  }

  // Switching to a Cloud workspace:
  await clearAccountDriveCache().catch(() => undefined)
  if (target.driveFolderId && target.driveFolderId !== 'active-drive-vault') {
    await selectExistingDriveVault(target.driveFolderId, target.name)
    const mirror = await getCloudMirrorEntry(target.driveFolderId)
    if (mirror?.handle) {
      await saveDeviceDirectoryHandle(mirror.handle)
    } else {
      await db.settings.delete(LOCAL_DIRECTORY_HANDLE_KEY)
    }
  } else {
    await setDriveVaultRootName(target.name)
  }
  useWorkspaceStore.getState().selectGoogleWorkspace()
}

export async function createCloudWorkspaceAction(
  name: string,
  directoryHandle?: FileSystemDirectoryHandle,
): Promise<void> {
  const trimmed = name.trim() || 'Writin'
  await clearAccountDriveCache().catch(() => undefined)
  await db.settings.delete('google-drive.mybook-folder-id')
  await setDriveVaultRootName(trimmed)
  if (directoryHandle) {
    await saveDeviceDirectoryHandle(directoryHandle)
    await saveLocalWorkspaceDetails({
      name: trimmed,
      storage: 'file-system',
      createdAt: new Date().toISOString(),
    })
  }
  useWorkspaceStore.getState().selectGoogleWorkspace()
}

export async function createLocalWorkspaceAction({
  name = 'Writin',
  directoryHandle,
  storagePreference = directoryHandle ? 'file-system' : 'private',
}: {
  name?: string
  directoryHandle?: FileSystemDirectoryHandle
  storagePreference?: LocalWorkspaceStoragePreference
}): Promise<void> {
  await initializeLocalWorkspace({
    name,
    directoryHandle,
    storagePreference,
    allowPrivateFallback: storagePreference !== 'file-system',
  })
  useWorkspaceStore.getState().createLocalWorkspace()
  useWorkspaceStore.getState().bumpWorkspaceRevision()
}

export async function mirrorCurrentCloudWorkspaceToLocal(
  directoryHandle: FileSystemDirectoryHandle,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const store = useWorkspaceStore.getState()
  store.setMirrorProgress({ isMirroring: true, progress: 0 })
  onProgress?.(0)

  try {
    const activeDriveName = (await getDriveVaultRootName()) || 'Writin'
    let targetHandle = directoryHandle
    if (directoryHandle.name.trim().toLowerCase() !== activeDriveName.trim().toLowerCase()) {
      try {
        targetHandle = await directoryHandle.getDirectoryHandle(activeDriveName, { create: true })
      } catch {
        targetHandle = directoryHandle
      }
    }
    await saveDeviceDirectoryHandle(targetHandle)
    const activeDriveFolderId = (await db.settings.get('google-drive.mybook-folder-id'))?.value as string | undefined
    if (activeDriveFolderId) {
      await saveCloudMirrorEntry(activeDriveFolderId, targetHandle, activeDriveName)
    }
    const existingDetails = await getLocalWorkspaceDetails()
    if (!existingDetails?.isStandalone) {
      await saveLocalWorkspaceDetails({
        name: activeDriveName,
        storage: 'file-system',
        createdAt: new Date().toISOString(),
      })
    }
    const activeFolders = await db.folders.filter((f) => !f.isDeleted && f.workspaceType !== 'local').toArray()
    const activeFiles = await db.files.filter((f) => !f.isDeleted && f.workspaceType !== 'local').toArray()
    const totalItems = activeFolders.length + activeFiles.length
    let completed = 0

    const stepProgress = () => {
      completed += 1
      const pct = totalItems > 0 ? Math.round((completed / totalItems) * 100) : 100
      store.setMirrorProgress({ isMirroring: true, progress: pct })
      onProgress?.(pct)
    }

    for (const folder of activeFolders) {
      await ensureLocalWorkspaceFolder(folder.id).catch(() => undefined)
      stepProgress()
    }
    for (const f of activeFiles) {
      await writeLocalWorkspaceFile(f).catch(() => undefined)
      stepProgress()
    }
    store.setMirrorProgress({ isMirroring: false, progress: 100 })
    useWorkspaceStore.getState().bumpWorkspaceRevision()
  } catch (err) {
    store.setMirrorProgress({ isMirroring: false, progress: 0 })
    throw err
  }
}

export async function connectCloudToLocalWorkspaceAction(
  folderId?: string,
  folderName?: string,
): Promise<void> {
  if (folderId && folderName) {
    await selectExistingDriveVault(folderId, folderName)
  } else if (folderName) {
    await setDriveVaultRootName(folderName)
  }
  useWorkspaceStore.getState().selectGoogleWorkspace()
}
