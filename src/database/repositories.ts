import { db } from './db'
import type { AppSetting, FileType, FileVersionSource, MyBookFile, MyBookFolder, SyncOperation, SyncQueueItem, WorkspaceType } from '../types/files'
import { backupDocumentToDrive, backupSpreadsheetToDrive, ensureMyBookDriveFolder, ensureVisibleFolderInParent, permanentlyDeleteDriveFile, restoreDriveFile, restoreDriveFolder, syncDriveAttachmentsOnRenameOrMove, trashDriveFile, trashDriveFileAttachments, trashDriveFolder, updateDriveFile, updateDriveFolder } from '../services/googleDrive'
import { deleteLocalWorkspaceFile, deleteLocalWorkspaceFolder, ensureLocalWorkspaceFolder, getDeviceDirectoryHandle, readLocalWorkspaceFile, syncAttachmentsOnRenameOrMove, writeLocalWorkspaceFile } from '../services/localWorkspace'
import { isLocalWorkspace, shouldSyncWithDrive } from '../stores/useWorkspaceStore'
import { devLog } from '../utils/safeLog'
import { areDocumentContentsEquivalent } from '../utils/documentMerge'

export interface RepositoryResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

function failure(error: unknown, fallback: string): RepositoryResult<never> {
  devLog('error', fallback, error)
  return { success: false, error: error instanceof Error ? error.message : fallback }
}

export function cleanName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export function appFileName(name: string, type: FileType) {
  const cleaned = cleanName(name)
  const withoutExtension = type === 'spreadsheet'
    ? cleaned.replace(/\.xlsx$/i, '')
    : cleaned.replace(/\.mybook\.md$/i, '').replace(/\.md$/i, '').replace(/\.docx$/i, '')
  return cleanName(withoutExtension) || cleaned
}

async function queueFolderSync(folderId: string, operation: SyncOperation, errorMessage: string | null = null) {
  await db.transaction('rw', db.syncQueue, async () => {
    const existing = await db.syncQueue.filter((item) => item.entityType === 'folder' && item.entityId === folderId && item.status !== 'completed').first()
    const now = new Date().toISOString()
    if (existing) {
      const nextOperation = operation === 'permanent-delete'
        ? 'permanent-delete'
        : existing.operation === 'permanent-delete'
          ? 'permanent-delete'
          : existing.operation === 'create' && operation === 'update'
            ? 'create'
            : operation
      await db.syncQueue.update(existing.id, { operation: nextOperation, status: 'pending', retryCount: existing.retryCount, errorMessage, updatedAt: now })
      return
    }
    await db.syncQueue.add({ id: crypto.randomUUID(), entityId: folderId, entityType: 'folder', operation, status: 'pending', retryCount: 0, createdAt: now, updatedAt: now, errorMessage })
  })
}

async function queueFileSync(fileId: string, operation: SyncOperation, errorMessage: string | null = null) {
  await db.transaction('rw', db.syncQueue, async () => {
    const existing = await db.syncQueue.filter((item) => item.entityType === 'file' && item.entityId === fileId && item.status !== 'completed').first()
    const now = new Date().toISOString()
    if (existing) {
      const nextOperation = operation === 'permanent-delete'
        ? 'permanent-delete'
        : existing.operation === 'permanent-delete'
          ? 'permanent-delete'
          : existing.operation === 'create' && operation === 'update'
            ? 'create'
            : operation
      await db.syncQueue.update(existing.id, { operation: nextOperation, status: 'pending', errorMessage, updatedAt: now })
      return
    }
    await db.syncQueue.add({ id: crypto.randomUUID(), entityId: fileId, entityType: 'file', operation, status: 'pending', retryCount: 0, createdAt: now, updatedAt: now, errorMessage })
  })
}

async function queueFileMetadataSync(fileId: string) {
  await db.transaction('rw', db.syncQueue, async () => {
    const items = await db.syncQueue
      .filter((item) => item.entityType === 'file' && item.entityId === fileId && item.status !== 'completed')
      .toArray()
    const contentSync = items.find((item) => item.operation === 'create' || item.operation === 'update')
    if (contentSync) {
      // An existing content backup includes current file metadata. If it is
      // already running, ask the queue processor to run it once more afterward.
      if (contentSync.status === 'processing') {
        await db.syncQueue.update(contentSync.id, { status: 'pending', updatedAt: new Date().toISOString() })
      }
      return
    }

    const metadataSync = items.find((item) => item.operation === 'metadata-update')
    if (metadataSync) {
      await db.syncQueue.update(metadataSync.id, {
        status: 'pending',
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      })
      return
    }

    const now = new Date().toISOString()
    await db.syncQueue.add({
      id: crypto.randomUUID(),
      entityId: fileId,
      entityType: 'file',
      operation: 'metadata-update',
      status: 'pending',
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      errorMessage: null,
    })
  })
}

async function maybeQueueFolderSync(folderId: string, operation: SyncOperation, errorMessage: string | null = null) {
  if (!shouldSyncWithDrive()) return
  await queueFolderSync(folderId, operation, errorMessage)
}

async function maybeQueueFileSync(fileId: string, operation: SyncOperation, errorMessage: string | null = null) {
  if (!shouldSyncWithDrive()) return
  await queueFileSync(fileId, operation, errorMessage)
}

async function maybeProcessPendingDriveSync() {
  if (shouldSyncWithDrive() && navigator.onLine) await processPendingDriveSync()
}

function processPendingDriveSyncInBackground() {
  void maybeProcessPendingDriveSync().catch((error) => {
    devLog('warn', 'Could not process pending Drive sync in the background.', error)
  })
}

function initialSyncStatus() {
  return isLocalWorkspace() ? 'local' as const : 'pending' as const
}

function pendingSyncStatus() {
  return isLocalWorkspace() ? 'local' as const : 'pending' as const
}

function activeWorkspaceType(): WorkspaceType {
  return isLocalWorkspace() ? 'local' : 'drive'
}

function isMediaOrAttachmentFile(file: MyBookFile) {
  const name = file.name.toLowerCase()
  const mime = (file.mimeType || '').toLowerCase()
  if (
    mime.startsWith('image/') ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    /\.(png|jpe?g|gif|webp|svg|bmp|ico|mp4|webm|mov|m4v|mp3|wav|ogg|m4a|flac|aac)$/i.test(name)
  ) {
    return true
  }
  if (name.includes('_attachments') || name.includes('-attachments') || name.includes('.attachments')) {
    return true
  }
  return false
}

function isAttachmentFolder(folder: MyBookFolder) {
  const name = folder.name.toLowerCase()
  return name.endsWith('_attachments') || name.endsWith('-attachments') || name.endsWith('.attachments')
}

function fileBelongsToActiveWorkspace(file: MyBookFile) {
  if (isMediaOrAttachmentFile(file)) return false
  if (isLocalWorkspace()) {
    return file.workspaceType === 'local' || (!file.workspaceType && file.syncStatus === 'local' && !file.driveFileId)
  }
  return file.workspaceType !== 'local'
}

function folderBelongsToActiveWorkspace(folder: MyBookFolder) {
  if (isAttachmentFolder(folder)) return false
  if (isLocalWorkspace()) return folder.workspaceType === 'local'
  return folder.workspaceType !== 'local'
}

async function persistLocalFile(file: MyBookFile | undefined) {
  if (!file) return
  if (isLocalWorkspace() || await getDeviceDirectoryHandle()) {
    await writeLocalWorkspaceFile(file)
  }
}

async function finalizeLocalFilePermanentDelete(file: MyBookFile) {
  await deleteLocalWorkspaceFile(file)
  await db.files.delete(file.id)
  await db.syncQueue.filter((item) => item.entityType === 'file' && item.entityId === file.id).delete()
}

async function localFolderSubtree(folderId: string) {
  const allFolders = (await db.folders.toArray()).filter(folderBelongsToActiveWorkspace)
  const ids = new Set([folderId])
  let changed = true
  while (changed) {
    changed = false
    allFolders.forEach((candidate) => {
      if (candidate.parentId && ids.has(candidate.parentId) && !ids.has(candidate.id)) {
        ids.add(candidate.id)
        changed = true
      }
    })
  }
  return ids
}

async function finalizeLocalFolderPermanentDelete(folderId: string) {
  await db.transaction('rw', db.folders, db.files, db.syncQueue, async () => {
    const ids = await localFolderSubtree(folderId)
    const files = await db.files.filter((file) => fileBelongsToActiveWorkspace(file) && Boolean(file.folderId && ids.has(file.folderId))).toArray()
    await Promise.all(files.map((file) => deleteLocalWorkspaceFile(file)))
    await db.files.bulkDelete(files.map((file) => file.id))
    await db.folders.bulkDelete([...ids])
    await db.syncQueue
      .filter((item) => (item.entityType === 'folder' && ids.has(item.entityId)) || (item.entityType === 'file' && files.some((file) => file.id === item.entityId)))
      .delete()
  })
}

async function hydrateLocalFile(file: MyBookFile | undefined) {
  if (!file || !fileBelongsToActiveWorkspace(file)) return undefined
  if (!isLocalWorkspace()) return file
  if (file.content) return file
  const localContent = await readLocalWorkspaceFile(file)
  return localContent === null ? file : { ...file, content: localContent }
}

async function folderIsInActiveWorkspace(folderId: string | null) {
  if (!folderId) return true
  const folder = await db.folders.get(folderId)
  return Boolean(folder && folderBelongsToActiveWorkspace(folder) && !folder.isDeleted)
}

async function ensureLocalFolderOnDrive(folderId: string | null, visiting = new Set<string>()): Promise<string> {
  const bootstrap = await ensureMyBookDriveFolder()
  if (!bootstrap.success) throw new Error(bootstrap.error)
  if (!folderId) return bootstrap.folderId
  if (visiting.has(folderId)) throw new Error('A folder cannot be moved inside itself.')
  const folder = await db.folders.get(folderId)
  if (!folder || folder.isDeleted) throw new Error('The destination folder could not be found.')
  if (folder.driveFolderId) return folder.driveFolderId
  visiting.add(folderId)
  const parentDriveId = await ensureLocalFolderOnDrive(folder.parentId, visiting)
  const driveFolder = folder.isFavorite
    ? await ensureVisibleFolderInParent(folder.name, parentDriveId, { isFavorite: 'true' })
    : await ensureVisibleFolderInParent(folder.name, parentDriveId)
  await db.folders.update(folder.id, { driveFolderId: driveFolder.id, updatedAt: new Date().toISOString() })
  visiting.delete(folderId)
  return driveFolder.id
}

export async function saveFileVersion(file: MyBookFile, source: FileVersionSource, label: string, driveModifiedTime: string | null = null) {
  if (!file.content) return
  await db.fileVersions.add({
    id: crypto.randomUUID(),
    fileId: file.id,
    source,
    content: file.content,
    name: file.name,
    mimeType: file.mimeType,
    driveFileId: file.driveFileId,
    driveModifiedTime,
    createdAt: new Date().toISOString(),
    label,
  })
}

type SyncFileOutcome = 'completed' | 'paused-conflict' | 'skipped'

async function syncFileItem(item: SyncQueueItem): Promise<SyncFileOutcome> {
  const file = await db.files.get(item.entityId)
  if (!file) { await db.syncQueue.delete(item.id); return 'skipped' }
  if (item.operation === 'permanent-delete') {
    if (file.driveFileId) {
      await permanentlyDeleteDriveFile(file.driveFileId)
      const parentFolder = file.folderId ? await db.folders.get(file.folderId) : null
      const bootstrap = await ensureMyBookDriveFolder()
      const driveParentId = parentFolder?.driveFolderId ?? (bootstrap.success ? bootstrap.folderId : null)
      if (driveParentId) {
        await trashDriveFileAttachments(file.name, driveParentId)
      }
    }
    await finalizeLocalFilePermanentDelete(file)
    return 'completed'
  }
  if (item.operation === 'delete') {
    if (file.driveFileId) {
      await trashDriveFile(file.driveFileId)
      const parentFolder = file.folderId ? await db.folders.get(file.folderId) : null
      const bootstrap = await ensureMyBookDriveFolder()
      const driveParentId = parentFolder?.driveFolderId ?? (bootstrap.success ? bootstrap.folderId : null)
      if (driveParentId) {
        await trashDriveFileAttachments(file.name, driveParentId)
      }
    }
    return 'completed'
  }
  if (item.operation === 'restore' && file.driveFileId) {
    await restoreDriveFile(file.driveFileId)
    return 'completed'
  }
  if (item.operation === 'metadata-update') {
    if (!file.driveFileId || file.type !== 'document') return 'skipped'
    const result = await updateDriveFile(file.driveFileId, {
      appProperties: {
        isFavorite: file.isFavorite ? 'true' : 'false',
        writingLanguage: file.writingLanguage ?? 'automatic',
      },
    })
    const pendingContentSync = await db.syncQueue
      .filter((queueItem) => queueItem.entityType === 'file' && queueItem.entityId === file.id && queueItem.status !== 'completed')
      .toArray()
    const hasPendingContentSync = pendingContentSync.some((queueItem) => queueItem.operation === 'create' || queueItem.operation === 'update')
    await db.files.update(file.id, {
      ...(result.modifiedTime ? { lastSyncedAt: result.modifiedTime } : {}),
      syncError: null,
      ...(file.syncStatus === 'failed' && !hasPendingContentSync ? { syncStatus: 'backed-up' } : {}),
    })
    return 'completed'
  }

  let targetFolderId = file.folderId
  if (targetFolderId) {
    const parentFolder = await db.folders.get(targetFolderId)
    if (!parentFolder || parentFolder.isDeleted) {
      targetFolderId = null
      await db.files.update(file.id, { folderId: null, updatedAt: new Date().toISOString() })
    }
  }
  await ensureLocalFolderOnDrive(targetFolderId)
  const fileToBackup = await db.files.get(item.entityId)
  if (!fileToBackup || fileToBackup.isDeleted) return 'skipped'
  if (fileToBackup.syncConflict) {
    // Unresolved conflict present: do not push local draft to Drive until user resolves conflict.
    return 'paused-conflict'
  }
  const result = fileToBackup.type === 'spreadsheet'
    ? await backupSpreadsheetToDrive({ fileId: fileToBackup.id, title: fileToBackup.name, content: fileToBackup.content, folderId: fileToBackup.folderId })
    : await backupDocumentToDrive({ fileId: fileToBackup.id, title: fileToBackup.name, content: fileToBackup.content, folderId: fileToBackup.folderId })
  if (!result.success) throw new Error(result.error)

  const current = await db.files.get(fileToBackup.id)
  if (!current || current.isDeleted) return 'skipped'
  if (current.syncConflict) {
    // Conflict appeared while backup was in flight: do not mark backed-up.
    return 'paused-conflict'
  }
  const isStillLatest =
    current.content === fileToBackup.content &&
    current.name === fileToBackup.name &&
    current.folderId === fileToBackup.folderId &&
    current.isFavorite === fileToBackup.isFavorite &&
    current.writingLanguage === fileToBackup.writingLanguage

  if (isStillLatest) {
    await db.files.update(fileToBackup.id, { syncError: null, syncStatus: 'backed-up' })
  } else {
    await db.files.update(fileToBackup.id, { syncError: null, syncStatus: 'pending' })
  }
  return 'completed'
}

let pendingDriveSyncFlight: Promise<void> | null = null
let pendingDriveSyncRerunRequested = false

async function processPendingDriveSyncOnce() {
  if (!shouldSyncWithDrive()) return
  if (!navigator.onLine) return
  const queue = await db.syncQueue.filter((item) => item.status !== 'completed').sortBy('createdAt')
  for (const item of queue) {
    const freshItem = await db.syncQueue.get(item.id)
    if (!freshItem || freshItem.status === 'completed') continue

    if (item.entityType === 'file') {
      try {
        await db.syncQueue.update(item.id, { status: 'processing', updatedAt: new Date().toISOString() })
        const outcome = await syncFileItem(item)
        await db.transaction('rw', db.syncQueue, async () => {
          const currentQueueItem = await db.syncQueue.get(item.id)
          if (!currentQueueItem) return
          if (outcome === 'paused-conflict') {
            // Revert status to 'pending' so it remains in the queue, waiting for user resolution.
            // Do NOT mark completed and do NOT trigger immediate rerun loop.
            await db.syncQueue.update(item.id, {
              status: 'pending',
              errorMessage: null,
              updatedAt: new Date().toISOString(),
            })
          } else if (outcome === 'completed') {
            if (currentQueueItem.status === 'processing') {
              await db.syncQueue.update(item.id, { status: 'completed', errorMessage: null, updatedAt: new Date().toISOString() })
            } else if (currentQueueItem.status === 'pending') {
              pendingDriveSyncRerunRequested = true
            }
          }
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Google Drive file sync failed.'
        await db.files.update(item.entityId, { syncStatus: 'failed', syncError: message })
        await db.transaction('rw', db.syncQueue, async () => {
          const currentQueueItem = await db.syncQueue.get(item.id)
          if (currentQueueItem && currentQueueItem.status === 'pending') {
            await db.syncQueue.update(item.id, {
              retryCount: (currentQueueItem.retryCount ?? item.retryCount) + 1,
              errorMessage: message,
              updatedAt: new Date().toISOString(),
            })
            pendingDriveSyncRerunRequested = true
          } else if (currentQueueItem) {
            await db.syncQueue.update(item.id, {
              status: 'failed',
              retryCount: item.retryCount + 1,
              errorMessage: message,
              updatedAt: new Date().toISOString(),
            })
          }
        })
      }
      continue
    }
    const folder = await db.folders.get(item.entityId)
    if (!folder) { await db.syncQueue.delete(item.id); continue }
    try {
      await db.syncQueue.update(item.id, { status: 'processing', updatedAt: new Date().toISOString() })
      if (item.operation === 'permanent-delete') {
        if (folder.driveFolderId) await permanentlyDeleteDriveFile(folder.driveFolderId)
        await finalizeLocalFolderPermanentDelete(folder.id)
      } else if (item.operation === 'create' && !folder.driveFolderId && !folder.isDeleted) {
        await ensureLocalFolderOnDrive(folder.id)
      } else if (item.operation === 'update') {
        if (!folder.driveFolderId && !folder.isDeleted) {
          await ensureLocalFolderOnDrive(folder.id)
        } else if (folder.driveFolderId) {
          const driveParentId = await ensureLocalFolderOnDrive(folder.parentId)
          await updateDriveFolder(folder.driveFolderId, {
            name: folder.name,
            parentId: driveParentId,
            appProperties: { isFavorite: folder.isFavorite ? 'true' : 'false' },
          })
        }
      } else if (folder.driveFolderId && item.operation === 'delete') await trashDriveFolder(folder.driveFolderId)
      else if (folder.driveFolderId && item.operation === 'restore') await restoreDriveFolder(folder.driveFolderId)

      await db.transaction('rw', db.syncQueue, async () => {
        const currentQueueItem = await db.syncQueue.get(item.id)
        if (currentQueueItem && currentQueueItem.status === 'processing') {
          await db.syncQueue.update(item.id, { status: 'completed', errorMessage: null, updatedAt: new Date().toISOString() })
        } else if (currentQueueItem && currentQueueItem.status === 'pending') {
          pendingDriveSyncRerunRequested = true
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Drive folder sync failed.'
      await db.transaction('rw', db.syncQueue, async () => {
        const currentQueueItem = await db.syncQueue.get(item.id)
        if (currentQueueItem && currentQueueItem.status === 'pending') {
          await db.syncQueue.update(item.id, {
            retryCount: (currentQueueItem.retryCount ?? item.retryCount) + 1,
            errorMessage: message,
            updatedAt: new Date().toISOString(),
          })
          pendingDriveSyncRerunRequested = true
        } else if (currentQueueItem) {
          await db.syncQueue.update(item.id, {
            status: 'failed',
            retryCount: item.retryCount + 1,
            errorMessage: message,
            updatedAt: new Date().toISOString(),
          })
        }
      })
    }
  }
}

export async function processPendingDriveSync() {
  if (pendingDriveSyncFlight) {
    pendingDriveSyncRerunRequested = true
    return pendingDriveSyncFlight
  }
  pendingDriveSyncFlight = (async () => {
    do {
      pendingDriveSyncRerunRequested = false
      await processPendingDriveSyncOnce()
    } while (pendingDriveSyncRerunRequested)
  })().finally(() => {
    pendingDriveSyncFlight = null
    pendingDriveSyncRerunRequested = false
  })
  return pendingDriveSyncFlight
}

export const processPendingDriveFolderSync = processPendingDriveSync

export async function queueLocalItemsForDriveBackup() {
  if (!shouldSyncWithDrive()) return
  const folders = await db.folders.filter((folder) => !folder.isDeleted && folder.workspaceType === 'local').toArray()
  const files = await db.files.filter((file) => !file.isDeleted && file.workspaceType === 'local').toArray()
  await Promise.all(folders.map(async (folder) => {
    await db.folders.update(folder.id, { workspaceType: 'drive' })
    await queueFolderSync(folder.id, 'create')
  }))
  await Promise.all(files.map(async (file) => {
    await db.files.update(file.id, { workspaceType: 'drive', syncStatus: 'pending', syncError: null })
    await queueFileSync(file.id, 'create')
  }))
}

export async function uniqueFileName(name: string, folderId: string | null, excludedId?: string) {
  const files = await db.files.filter((file) => file.folderId === folderId && fileBelongsToActiveWorkspace(file)).toArray()
  return !files.some((file) => file.id !== excludedId && !file.isDeleted && file.folderId === folderId && appFileName(file.name, file.type).toLocaleLowerCase() === name.toLocaleLowerCase())
}

export async function nextFileName(baseName: string, folderId: string | null) {
  if (await uniqueFileName(baseName, folderId)) return baseName
  let suffix = 2
  let name = `${baseName} ${suffix}`
  while (!(await uniqueFileName(name, folderId))) {
    suffix += 1
    name = `${baseName} ${suffix}`
  }
  return name
}

function logicalFileKeys(file: MyBookFile) {
  const nameKey = `${file.folderId ?? 'root'}:${file.type}:${appFileName(file.name, file.type).toLocaleLowerCase()}`
  return file.driveFileId ? [`drive:${file.driveFileId}`, `name:${nameKey}`] : [`name:${nameKey}`]
}

function filePreference(file: MyBookFile) {
  const syncScore = file.driveFileId ? 100 : 0
  const backedUpScore = file.syncStatus === 'backed-up' ? 20 : 0
  const syncedAt = file.lastSyncedAt ? new Date(file.lastSyncedAt).getTime() : 0
  const updatedAt = new Date(file.updatedAt).getTime()
  return syncScore + backedUpScore + Math.max(syncedAt, updatedAt) / 1_000_000_000_000
}

function uniqueLogicalFiles(files: MyBookFile[]) {
  const sorted = [...files].sort((a, b) => filePreference(b) - filePreference(a))
  const seen = new Set<string>()
  const visible: MyBookFile[] = []
  for (const file of sorted) {
    const keys = logicalFileKeys(file)
    if (keys.some((key) => seen.has(key))) continue
    keys.forEach((key) => seen.add(key))
    visible.push(file)
  }
  return visible
}

function folderPreference(folder: MyBookFolder) {
  const syncScore = folder.driveFolderId ? 100 : 0
  const updatedAt = new Date(folder.updatedAt).getTime()
  return syncScore + updatedAt / 1_000_000_000_000
}

function uniqueLogicalFolders(folders: MyBookFolder[]) {
  const sorted = [...folders].sort((a, b) => folderPreference(b) - folderPreference(a))
  const seenDriveIds = new Set<string>()
  const claimedStubKeys = new Set<string>()
  const seenStubKeys = new Set<string>()
  const visible: MyBookFolder[] = []

  for (const folder of sorted) {
    if (folder.driveFolderId) {
      if (seenDriveIds.has(folder.driveFolderId)) continue
      seenDriveIds.add(folder.driveFolderId)
      claimedStubKeys.add(`${folder.parentId ?? 'root'}:${folder.name.toLocaleLowerCase()}`)
      visible.push(folder)
    } else {
      const nameKey = `${folder.parentId ?? 'root'}:${folder.name.toLocaleLowerCase()}`
      if (claimedStubKeys.has(nameKey) || seenStubKeys.has(nameKey)) continue
      seenStubKeys.add(nameKey)
      visible.push(folder)
    }
  }
  return visible
}

export const fileRepository = {
  async create(type: FileType, folderId: string | null = null): Promise<RepositoryResult<MyBookFile>> {
    try {
      const now = new Date().toISOString()
      if (!(await folderIsInActiveWorkspace(folderId))) return { success: false, error: 'Folder could not be found in this workspace.' }
      const name = await nextFileName(type === 'document' ? 'Untitled' : 'Untitled Spreadsheet', folderId)
      const file: MyBookFile = { id: crypto.randomUUID(), driveFileId: null, workspaceType: activeWorkspaceType(), name, type, folderId, content: '', mimeType: type === 'document' ? 'application/x-mybook-document' : 'application/x-mybook-spreadsheet', createdAt: now, updatedAt: now, lastSyncedAt: null, syncStatus: initialSyncStatus(), isDeleted: false }
      await db.files.add(file)
      await persistLocalFile(file)
      await maybeQueueFileSync(file.id, 'create', navigator.onLine ? null : 'Offline. File will sync when you reconnect.')
      processPendingDriveSyncInBackground()
      return { success: true, data: file }
    } catch (error) { return failure(error, 'Could not create file.') }
  },
  async get(id: string) {
    try {
      const file = await hydrateLocalFile(await db.files.get(id))
      return { success: true, data: file ? { ...file, name: appFileName(file.name, file.type) } : file }
    } catch (error) { return failure(error, 'Could not load file.') }
  },
  async update(
    id: string,
    changes: Partial<Omit<MyBookFile, 'id'>>,
    options?: { expectedUpdatedAt?: string; expectedContent?: string }
  ): Promise<RepositoryResult & { stale?: boolean }> {
    try {
      const existing = await db.files.get(id)
      if (!existing) return { success: false, error: 'File could not be found.' }
      if (!fileBelongsToActiveWorkspace(existing)) return { success: false, error: 'File could not be found in this workspace.' }
      if (changes.content !== undefined && changes.content === existing.content && Object.keys(changes).every((key) => key === 'content')) return { success: true }
      if (changes.name !== undefined) {
        const name = appFileName(changes.name, existing.type)
        if (!name) return { success: false, error: 'File name cannot be empty.' }
        const file = await db.files.get(id)
        if (!file) return { success: false, error: 'File could not be found.' }
        if (!(await uniqueFileName(name, changes.folderId ?? file.folderId, id))) return { success: false, error: 'A file with this name already exists here.' }
        changes = { ...changes, name }
      }
      const nextChanges = isLocalWorkspace()
        ? { ...changes, syncStatus: pendingSyncStatus(), syncError: null }
        : changes
      const isRenamedOrMoved = (
        (changes.name !== undefined && changes.name !== existing.name) ||
        (changes.folderId !== undefined && changes.folderId !== existing.folderId)
      )
      if (isRenamedOrMoved) {
        if (isLocalWorkspace() || await getDeviceDirectoryHandle()) {
          await syncAttachmentsOnRenameOrMove(existing, { ...existing, ...nextChanges })
          await deleteLocalWorkspaceFile(existing)
        }
        if (shouldSyncWithDrive() && existing.driveFileId) {
          const oldParent = existing.folderId ? await db.folders.get(existing.folderId) : null
          const newParent = nextChanges.folderId !== undefined
            ? (nextChanges.folderId ? await db.folders.get(nextChanges.folderId) : null)
            : oldParent
          const bootstrap = await ensureMyBookDriveFolder()
          const oldDriveParentId = oldParent?.driveFolderId ?? (bootstrap.success ? bootstrap.folderId : null)
          const newDriveParentId = newParent?.driveFolderId ?? (bootstrap.success ? bootstrap.folderId : null)
          if (oldDriveParentId && newDriveParentId) {
            await syncDriveAttachmentsOnRenameOrMove(
              existing.name,
              nextChanges.name ?? existing.name,
              oldDriveParentId,
              newDriveParentId
            )
          }
        }
      }
      if (options?.expectedUpdatedAt !== undefined || options?.expectedContent !== undefined) {
        let isStale = false
        await db.transaction('rw', db.files, db.fileVersions, db.syncQueue, async () => {
          const current = await db.files.get(id)
          if (!current) throw new Error('File could not be found.')
          if (options.expectedUpdatedAt !== undefined && current.updatedAt !== options.expectedUpdatedAt) {
            isStale = true
            return
          }
          if (options.expectedContent !== undefined && current.content !== options.expectedContent) {
            isStale = true
            return
          }
          let persistedChanges = nextChanges
          if (changes.content !== undefined && current.syncConflict?.versionId) {
            const remoteVersion = await db.fileVersions.get(current.syncConflict.versionId)
            if (remoteVersion && areDocumentContentsEquivalent(changes.content, remoteVersion.content)) {
              // Autosave may catch up to the saved remote version after a
              // transient conflict was recorded. Clear that stale banner in
              // the same transaction as the converging content write.
              persistedChanges = {
                ...nextChanges,
                syncConflict: null,
                baseContent: remoteVersion.content,
                lastSyncedAt: remoteVersion.driveModifiedTime ?? current.syncConflict.remoteModifiedTime ?? current.lastSyncedAt,
              }
            }
          }
          await db.files.update(id, { ...persistedChanges, updatedAt: new Date().toISOString() })
          if (changes.name !== undefined || changes.folderId !== undefined || changes.content !== undefined) {
            await maybeQueueFileSync(id, current.driveFileId ? 'update' : 'create', navigator.onLine ? null : 'Offline. File changes will sync when you reconnect.')
          }
        })
        if (isStale) {
          return { success: false, stale: true, error: 'File was modified concurrently.' }
        }
      } else {
        await db.files.update(id, { ...nextChanges, updatedAt: new Date().toISOString() })
        if (changes.name !== undefined || changes.folderId !== undefined || changes.content !== undefined) {
          await maybeQueueFileSync(id, existing.driveFileId ? 'update' : 'create', navigator.onLine ? null : 'Offline. File changes will sync when you reconnect.')
        }
      }
      await persistLocalFile(await db.files.get(id))
      if (changes.name !== undefined || changes.folderId !== undefined || changes.content !== undefined) {
        processPendingDriveSyncInBackground()
      }
      return { success: true }
    } catch (error) { return failure(error, 'Could not update file.') }
  },
  async delete(id: string) {
    try {
      const file = await db.files.get(id)
      if (!file) return { success: false, error: 'File could not be found.' }
      if (!fileBelongsToActiveWorkspace(file)) return { success: false, error: 'File could not be found in this workspace.' }
      await db.files.update(id, { isDeleted: true, updatedAt: new Date().toISOString() })
      if (isLocalWorkspace() || await getDeviceDirectoryHandle()) {
        await deleteLocalWorkspaceFile(file)
      }
      await maybeQueueFileSync(id, 'delete', navigator.onLine ? null : 'Offline. File will move to Drive Trash when you reconnect.')
      processPendingDriveSyncInBackground()
      return { success: true }
    } catch (error) { return failure(error, 'Could not delete file.') }
  },
  async restore(id: string) {
    try {
      const file = await db.files.get(id)
      if (!file) return { success: false, error: 'File could not be found.' }
      if (!fileBelongsToActiveWorkspace(file)) return { success: false, error: 'File could not be found in this workspace.' }
      let safeFolderId = file.folderId
      if (safeFolderId) {
        const folder = await db.folders.get(safeFolderId)
        if (!folder || folder.isDeleted) {
          safeFolderId = null
        }
      }
      await db.files.update(id, { folderId: safeFolderId, isDeleted: false, updatedAt: new Date().toISOString() })
      await persistLocalFile(await db.files.get(id))
      await maybeQueueFileSync(id, file.driveFileId ? 'restore' : 'create', navigator.onLine ? null : 'Offline. File restore will sync when you reconnect.')
      processPendingDriveSyncInBackground()
      return { success: true }
    } catch (error) { return failure(error, 'Could not restore file.') }
  },
  async setFavorite(id: string, isFavorite: boolean): Promise<RepositoryResult> {
    try {
      const file = await db.files.get(id)
      if (!file) return { success: false, error: 'File could not be found.' }
      if (!fileBelongsToActiveWorkspace(file)) return { success: false, error: 'File could not be found in this workspace.' }
      await db.files.update(id, { isFavorite })
      await maybeQueueFileSync(id, 'update')
      processPendingDriveSyncInBackground()
      return { success: true }
    } catch (error) {
      return failure(error, 'Could not update favorite.')
    }
  },
  async setWritingLanguage(id: string, writingLanguage: string): Promise<RepositoryResult> {
    try {
      const file = await db.files.get(id)
      if (!file) return { success: false, error: 'File could not be found.' }
      if (!fileBelongsToActiveWorkspace(file)) return { success: false, error: 'File could not be found in this workspace.' }
      if (file.type !== 'document') return { success: false, error: 'Writing language is only available for documents.' }
      if (file.writingLanguage === writingLanguage) return { success: true }

      const fileWithContent = await hydrateLocalFile(file)
      await db.files.update(id, { writingLanguage })
      await persistLocalFile({ ...(fileWithContent ?? file), writingLanguage })
      if (shouldSyncWithDrive() && file.driveFileId) {
        await queueFileMetadataSync(id)
        processPendingDriveSyncInBackground()
      }
      return { success: true }
    } catch (error) {
      return failure(error, 'Could not update writing language.')
    }
  },
  async permanentlyDelete(id: string): Promise<RepositoryResult> {
    try {
      const file = await db.files.get(id)
      if (!file) return { success: true }
      if (!fileBelongsToActiveWorkspace(file)) return { success: false, error: 'File could not be found in this workspace.' }
      if (!shouldSyncWithDrive() || !file.driveFileId) {
        await finalizeLocalFilePermanentDelete(file)
        return { success: true }
      }
      const now = new Date().toISOString()
      await db.files.update(id, { isDeleted: true, syncStatus: 'pending', syncError: null, updatedAt: now })
      await queueFileSync(id, 'permanent-delete', navigator.onLine ? null : 'Offline. File will be permanently deleted from Drive when you reconnect.')
      processPendingDriveSyncInBackground()
      return { success: true }
    } catch (error) {
      return failure(error, 'Could not permanently delete file.')
    }
  },
  async list(includeDeleted = false): Promise<MyBookFile[]> {
    try {
      const files = await db.files.filter((file) => fileBelongsToActiveWorkspace(file) && (includeDeleted || !file.isDeleted)).toArray()
      const normalized = files.map((file) => ({ ...file, name: appFileName(file.name, file.type) }))
      return includeDeleted ? normalized : uniqueLogicalFiles(normalized)
    } catch (error) { devLog('error', 'Could not list files.', error); return [] }
  },
  async search(query: string): Promise<MyBookFile[]> {
    try {
      const value = query.trim().toLocaleLowerCase()
      const files = (await db.files.filter((file) => fileBelongsToActiveWorkspace(file) && !file.isDeleted && appFileName(file.name, file.type).toLocaleLowerCase().includes(value)).toArray())
        .map((file) => ({ ...file, name: appFileName(file.name, file.type) }))
      return uniqueLogicalFiles(files)
    } catch (error) { devLog('error', 'Could not search files.', error); return [] }
  },
  async duplicate(id: string): Promise<RepositoryResult<MyBookFile>> {
    try {
      const source = await db.files.get(id)
      if (!source) return { success: false, error: 'File could not be found.' }
      if (!fileBelongsToActiveWorkspace(source)) return { success: false, error: 'File could not be found in this workspace.' }
      const now = new Date().toISOString()
      let suffix = 2
      let copyName = `${source.name} ${suffix}`
      while (!(await uniqueFileName(copyName, source.folderId))) copyName = `${source.name} ${++suffix}`
      const copy = { ...source, id: crypto.randomUUID(), driveFileId: null, workspaceType: activeWorkspaceType(), name: copyName, createdAt: now, updatedAt: now, lastSyncedAt: null, syncStatus: initialSyncStatus(), isDeleted: false, isFavorite: false }
      await db.files.add(copy)
      await persistLocalFile(copy)
      await maybeQueueFileSync(copy.id, 'create', navigator.onLine ? null : 'Offline. File copy will sync when you reconnect.')
      processPendingDriveSyncInBackground()
      return { success: true, data: copy }
    } catch (error) { return failure(error, 'Could not duplicate file.') }
  },
  async isNameAvailable(name: string, folderId: string | null, excludedId?: string): Promise<boolean> {
    try {
      const normalized = cleanName(name)
      if (!normalized) return false
      return await uniqueFileName(normalized, folderId, excludedId)
    } catch (error) { devLog('error', 'Could not check file name availability.', error); return true }
  },
}

export const folderRepository = {
  async create(name: string, parentId: string | null = null): Promise<RepositoryResult<MyBookFolder>> {
    try {
      const normalized = cleanName(name)
      if (!normalized) return { success: false, error: 'Folder name cannot be empty.' }
      if (!(await folderIsInActiveWorkspace(parentId))) return { success: false, error: 'Parent folder could not be found in this workspace.' }
      const siblings = await db.folders.filter((folder) => folderBelongsToActiveWorkspace(folder) && !folder.isDeleted && folder.parentId === parentId).toArray()
      if (siblings.some((folder) => folder.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) return { success: false, error: `"${normalized}" already exists. Use a different name.` }
      const now = new Date().toISOString()
      const folder: MyBookFolder = { id: crypto.randomUUID(), driveFolderId: null, workspaceType: activeWorkspaceType(), name: normalized, parentId, createdAt: now, updatedAt: now, isDeleted: false }
      await db.folders.add(folder)
      if (isLocalWorkspace() || await getDeviceDirectoryHandle()) {
        await ensureLocalWorkspaceFolder(folder.id)
      }
      await maybeQueueFolderSync(folder.id, 'create', navigator.onLine ? null : 'Offline. Folder will sync when you reconnect.')
      processPendingDriveSyncInBackground()
      return { success: true, data: folder }
    } catch (error) { return failure(error, 'Could not create folder.') }
  },
  async get(id: string) { try { const folder = await db.folders.get(id); return { success: true, data: folder && folderBelongsToActiveWorkspace(folder) ? folder : undefined } } catch (error) { return failure(error, 'Could not load folder.') } },
  async update(id: string, changes: Partial<Omit<MyBookFolder, 'id'>>): Promise<RepositoryResult> {
    try {
      const folder = await db.folders.get(id); if (!folder || !folderBelongsToActiveWorkspace(folder)) return { success: false, error: 'Folder could not be found.' }
      const targetParentId = changes.parentId !== undefined ? changes.parentId : folder.parentId
      if (targetParentId === id) return { success: false, error: 'A folder cannot be moved inside itself.' }
      if (changes.parentId !== undefined) {
        const allFolders = (await db.folders.toArray()).filter(folderBelongsToActiveWorkspace)
        const descendants = new Set<string>()
        let changed = true
        while (changed) {
          changed = false
          for (const candidate of allFolders) {
            if ((candidate.parentId === id || (candidate.parentId && descendants.has(candidate.parentId))) && !descendants.has(candidate.id)) {
              descendants.add(candidate.id); changed = true
            }
          }
        }
        if (targetParentId && descendants.has(targetParentId)) return { success: false, error: 'A folder cannot be moved into one of its subfolders.' }
      }
      if (changes.name !== undefined) { const name = cleanName(changes.name); if (!name) return { success: false, error: 'Folder name cannot be empty.' }; changes = { ...changes, name } }
      const nextName = changes.name ?? folder.name
      const siblings = await db.folders.filter((item) => folderBelongsToActiveWorkspace(item) && !item.isDeleted && item.id !== id && item.parentId === targetParentId).toArray()
      if (siblings.some((item) => item.name.toLocaleLowerCase() === nextName.toLocaleLowerCase())) return { success: false, error: `"${nextName}" already exists. Use a different name.` }
      const next = { ...changes, updatedAt: new Date().toISOString() }
      await db.folders.update(id, next)
      if (changes.name !== undefined || changes.parentId !== undefined) {
        if (isLocalWorkspace() || await getDeviceDirectoryHandle()) {
          await ensureLocalWorkspaceFolder(id)
        }
        await maybeQueueFolderSync(id, folder.driveFolderId ? 'update' : 'create', navigator.onLine ? null : 'Offline. Folder changes will sync when you reconnect.')
        processPendingDriveSyncInBackground()
      }
      return { success: true }
    } catch (error) { return failure(error, 'Could not update folder.') }
  },
  async delete(id: string): Promise<RepositoryResult> {
    try {
      const folder = await db.folders.get(id)
      if (!folder || !folderBelongsToActiveWorkspace(folder)) return { success: false, error: 'Folder could not be found.' }
      let deletedFolderIds: string[] = []
      await db.transaction('rw', db.folders, db.files, async () => {
        const allFolders = (await db.folders.toArray()).filter(folderBelongsToActiveWorkspace)
        const ids = new Set([id]); let changed = true
        while (changed) { changed = false; allFolders.forEach((folder) => { if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) { ids.add(folder.id); changed = true } }) }
        deletedFolderIds = [...ids]
        const now = new Date().toISOString()
        await Promise.all([...ids].map((folderId) => db.folders.update(folderId, { isDeleted: true, updatedAt: now })))
        await db.files.filter((file) => fileBelongsToActiveWorkspace(file) && Boolean(file.folderId && ids.has(file.folderId))).modify({ isDeleted: true, updatedAt: now })
      })
      if (isLocalWorkspace() || await getDeviceDirectoryHandle()) {
        await deleteLocalWorkspaceFolder(id)
      }
      await Promise.all(deletedFolderIds.map((folderId) => maybeQueueFolderSync(folderId, 'delete', navigator.onLine ? null : 'Offline. Folder will move to Drive Trash when you reconnect.')))
      processPendingDriveSyncInBackground()
      return { success: true }
    } catch (error) { return failure(error, 'Could not delete folder.') }
  },
  async restore(id: string) {
    try {
      let restoredFolderIds: string[] = []
      let restoredFileIds: string[] = []
      await db.transaction('rw', db.folders, db.files, async () => {
        const folder = await db.folders.get(id)
        if (!folder || !folderBelongsToActiveWorkspace(folder)) throw new Error('Folder could not be found.')
        const parent = folder.parentId ? await db.folders.get(folder.parentId) : null
        const safeParentId = parent && folderBelongsToActiveWorkspace(parent) && !parent.isDeleted ? folder.parentId : null
        const allFolders = (await db.folders.toArray()).filter(folderBelongsToActiveWorkspace)
        const ids = new Set([id])
        let changed = true
        while (changed) {
          changed = false
          allFolders.forEach((candidate) => {
            if (candidate.parentId && ids.has(candidate.parentId) && !ids.has(candidate.id)) {
              ids.add(candidate.id)
              changed = true
            }
          })
        }
        restoredFolderIds = [...ids]
        const now = new Date().toISOString()
        await db.folders.update(id, { parentId: safeParentId, isDeleted: false, updatedAt: now })
        await Promise.all(restoredFolderIds
          .filter((folderId) => folderId !== id)
          .map((folderId) => db.folders.update(folderId, { isDeleted: false, updatedAt: now })))
        const nestedFiles = await db.files.filter((file) => fileBelongsToActiveWorkspace(file) && Boolean(file.folderId && ids.has(file.folderId))).toArray()
        restoredFileIds = nestedFiles.map((file) => file.id)
        await Promise.all(restoredFileIds.map((fileId) => db.files.update(fileId, { isDeleted: false, updatedAt: now })))
      })
      const restoredFolders = await db.folders.bulkGet(restoredFolderIds)
      await Promise.all(restoredFolders
        .filter((folder): folder is MyBookFolder => Boolean(folder))
        .map((folder) => maybeQueueFolderSync(folder.id, folder.driveFolderId ? 'restore' : 'create', navigator.onLine ? null : 'Offline. Folder restore will sync when you reconnect.')))
      const restoredFiles = await db.files.bulkGet(restoredFileIds)
      await Promise.all(restoredFiles
        .filter((file): file is MyBookFile => Boolean(file))
        .map(async (file) => {
          await persistLocalFile(file)
          await maybeQueueFileSync(file.id, file.driveFileId ? 'restore' : 'create', navigator.onLine ? null : 'Offline. File restore will sync when you reconnect.')
        }))
      processPendingDriveSyncInBackground()
      return { success: true }
    } catch (error) {
      return failure(error, 'Could not restore folder.')
    }
  },
  async setFavorite(id: string, isFavorite: boolean): Promise<RepositoryResult> {
    try {
      const folder = await db.folders.get(id)
      if (!folder || !folderBelongsToActiveWorkspace(folder)) return { success: false, error: 'Folder could not be found.' }
      await db.folders.update(id, { isFavorite })
      await maybeQueueFolderSync(id, 'update')
      processPendingDriveSyncInBackground()
      return { success: true }
    } catch (error) {
      return failure(error, 'Could not update favorite.')
    }
  },
  async permanentlyDelete(id: string): Promise<RepositoryResult> {
    try {
      const folder = await db.folders.get(id)
      if (!folder || !folderBelongsToActiveWorkspace(folder)) return { success: false, error: 'Folder could not be found.' }
      if (!shouldSyncWithDrive() || !folder.driveFolderId) {
        await finalizeLocalFolderPermanentDelete(id)
        return { success: true }
      }
      const ids = await localFolderSubtree(id)
      const now = new Date().toISOString()
      await db.transaction('rw', db.folders, db.files, async () => {
        await Promise.all([...ids].map((folderId) => db.folders.update(folderId, { isDeleted: true, updatedAt: now })))
        await db.files.filter((file) => fileBelongsToActiveWorkspace(file) && Boolean(file.folderId && ids.has(file.folderId))).modify({ isDeleted: true, syncStatus: 'pending', syncError: null, updatedAt: now })
      })
      await queueFolderSync(id, 'permanent-delete', navigator.onLine ? null : 'Offline. Folder will be permanently deleted from Drive when you reconnect.')
      processPendingDriveSyncInBackground()
      return { success: true }
    } catch (error) {
      return failure(error, 'Could not permanently delete folder.')
    }
  },
  async list(includeDeleted = false): Promise<MyBookFolder[]> {
    try {
      const folders = await db.folders.filter((folder) => folderBelongsToActiveWorkspace(folder) && (includeDeleted || !folder.isDeleted)).toArray()
      return includeDeleted ? folders : uniqueLogicalFolders(folders)
    } catch (error) {
      devLog('error', 'Could not list folders.', error)
      return []
    }
  },
  async search(query: string): Promise<MyBookFolder[]> {
    try {
      const value = query.trim().toLocaleLowerCase()
      const folders = await db.folders.filter((folder) => folderBelongsToActiveWorkspace(folder) && !folder.isDeleted && folder.name.toLocaleLowerCase().includes(value)).toArray()
      return uniqueLogicalFolders(folders)
    } catch (error) {
      devLog('error', 'Could not search folders.', error)
      return []
    }
  },
}

export const settingsRepository = {
  async create(setting: AppSetting) { try { await db.settings.add(setting); return { success: true } } catch (error) { return failure(error, 'Could not create setting.') } },
  async get(key: string) { try { return { success: true, data: await db.settings.get(key) } } catch (error) { return failure(error, 'Could not load setting.') } },
  async update(key: string, value: unknown) { try { await db.settings.put({ key, value, updatedAt: new Date().toISOString() }); return { success: true } } catch (error) { return failure(error, 'Could not update setting.') } },
  async delete(key: string) { try { await db.settings.delete(key); return { success: true } } catch (error) { return failure(error, 'Could not delete setting.') } },
  async restore() { return { success: false, error: 'Settings do not support restore.' } },
  async list() { return db.settings.toArray() }, async search(query: string) { return db.settings.filter((item) => item.key.includes(query)).toArray() },
}

export const syncQueueRepository = {
  async create(item: SyncQueueItem) { try { await db.syncQueue.add(item); return { success: true, data: item } } catch (error) { return failure(error, 'Could not queue sync operation.') } },
  async get(id: string) { try { return { success: true, data: await db.syncQueue.get(id) } } catch (error) { return failure(error, 'Could not load sync operation.') } },
  async update(id: string, changes: Partial<SyncQueueItem>) { try { await db.syncQueue.update(id, { ...changes, updatedAt: new Date().toISOString() }); return { success: true } } catch (error) { return failure(error, 'Could not update sync operation.') } },
  async delete(id: string) { try { await db.syncQueue.delete(id); return { success: true } } catch (error) { return failure(error, 'Could not delete sync operation.') } },
  async restore() { return { success: false, error: 'Sync queue items do not support restore.' } },
  async list() { return db.syncQueue.toArray() }, async search(query: string) { return db.syncQueue.filter((item) => item.entityId.includes(query)).toArray() },
}

export const fileVersionRepository = {
  async list(fileId: string) {
    try {
      return await db.fileVersions.where('fileId').equals(fileId).reverse().sortBy('createdAt')
    } catch (error) {
      devLog('error', 'Could not list file versions.', error)
      return []
    }
  },
  async restore(versionId: string): Promise<RepositoryResult<MyBookFile>> {
    try {
      const version = await db.fileVersions.get(versionId)
      if (!version) return { success: false, error: 'Version could not be found.' }
      const file = await db.files.get(version.fileId)
      if (!file) return { success: false, error: 'File could not be found.' }
      if (!fileBelongsToActiveWorkspace(file)) return { success: false, error: 'File could not be found in this workspace.' }
      await saveFileVersion(file, 'local', 'Before version restore')
      await db.files.update(file.id, {
        content: version.content,
        name: version.name,
        mimeType: version.mimeType,
        syncStatus: pendingSyncStatus(),
        syncError: null,
        updatedAt: new Date().toISOString(),
      })
      await persistLocalFile(await db.files.get(file.id))
      await maybeQueueFileSync(file.id, file.driveFileId ? 'update' : 'create')
      processPendingDriveSyncInBackground()
      const restored = await db.files.get(file.id)
      return { success: true, data: restored }
    } catch (error) {
      return failure(error, 'Could not restore version.')
    }
  },
}

const cacheClearListeners = new Set<() => void>()

export function onClearAccountDriveCache(callback: () => void) {
  cacheClearListeners.add(callback)
  return () => {
    cacheClearListeners.delete(callback)
  }
}

export async function clearAccountDriveCache() {
  try {
    await db.transaction('rw', [db.files, db.folders, db.fileVersions, db.syncQueue, db.settings], async () => {
      const driveFiles = await db.files.filter((file) => file.workspaceType !== 'local').toArray()
      const driveFileIds = new Set(driveFiles.map((file) => file.id))
      if (driveFileIds.size > 0) {
        await db.files.bulkDelete(Array.from(driveFileIds))
        const driveVersions = await db.fileVersions.filter((version) => driveFileIds.has(version.fileId)).toArray()
        if (driveVersions.length > 0) {
          await db.fileVersions.bulkDelete(driveVersions.map((version) => version.id))
        }
      }
      const driveFolders = await db.folders.filter((folder) => folder.workspaceType !== 'local').toArray()
      if (driveFolders.length > 0) {
        await db.folders.bulkDelete(driveFolders.map((folder) => folder.id))
      }
      await db.syncQueue.clear()
      const driveSettings = await db.settings.filter((setting) => setting.key.startsWith('google-drive.')).toArray()
      if (driveSettings.length > 0) {
        await db.settings.bulkDelete(driveSettings.map((setting) => setting.key))
      }
    })
  } catch (error) {
    devLog('error', 'Could not clear account Drive cache.', error)
  }
  cacheClearListeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // ignore
    }
  })
}
