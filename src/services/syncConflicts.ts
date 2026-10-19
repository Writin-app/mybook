import { db } from '../database/db'
import { processPendingDriveSync } from '../database/repositories'
import type { SyncConflict } from '../types/files'

// Keeps the local document and stores the remote content as a recoverable
// version, so a remote edit is never dropped without a trace.
export async function recordRemoteConflict(fileId: string, remoteContent: string, remoteModifiedTime: string) {
  const file = await db.files.get(fileId)
  if (!file) return null
  if (file.syncConflict?.remoteModifiedTime) {
    if (file.syncConflict.remoteModifiedTime === remoteModifiedTime) return file.syncConflict
    const existingTime = new Date(file.syncConflict.remoteModifiedTime).getTime()
    const incomingTime = new Date(remoteModifiedTime).getTime()
    if (!isNaN(existingTime) && !isNaN(incomingTime) && existingTime > incomingTime) {
      return file.syncConflict
    }
  }

  const conflict: SyncConflict = { remoteModifiedTime, versionId: crypto.randomUUID(), detectedAt: new Date().toISOString() }
  await db.transaction('rw', db.files, db.fileVersions, async () => {
    await db.fileVersions.add({
      id: conflict.versionId,
      fileId,
      source: 'drive',
      content: remoteContent,
      name: file.name,
      mimeType: file.mimeType,
      driveFileId: file.driveFileId,
      driveModifiedTime: remoteModifiedTime,
      createdAt: conflict.detectedAt,
      label: 'Remote version (not applied)',
    })
    await db.files.update(fileId, { syncConflict: conflict })
  })
  return conflict
}

// Local edits win. The remote version stays in history and is acknowledged, so
// only newer remote changes raise another conflict.
export async function keepLocalVersion(fileId: string, expectedVersionId?: string, resolvedContent?: string) {
  const now = new Date().toISOString()
  let kept = false
  await db.transaction('rw', db.files, db.fileVersions, db.syncQueue, async () => {
    const file = await db.files.get(fileId)
    if (!file?.syncConflict) return
    if (expectedVersionId && file.syncConflict.versionId !== expectedVersionId) return

    const remoteVersion = file.syncConflict.versionId ? await db.fileVersions.get(file.syncConflict.versionId) : null
    const baseContent = remoteVersion?.content ?? file.baseContent ?? file.content
    const remoteModifiedTime = remoteVersion?.driveModifiedTime ?? file.syncConflict?.remoteModifiedTime
    const nextContent = resolvedContent !== undefined ? resolvedContent : file.content

    await db.files.update(fileId, {
      content: nextContent,
      syncConflict: null,
      lastSyncedAt: remoteModifiedTime ?? file.lastSyncedAt ?? now,
      baseContent,
      syncStatus: 'pending',
      updatedAt: now,
    })
    const existing = await db.syncQueue
      .filter((item) => item.entityType === 'file' && item.entityId === fileId && item.status !== 'completed')
      .first()
    const operation = file.driveFileId ? 'update' : 'create'
    if (existing) {
      await db.syncQueue.update(existing.id, {
        operation: existing.operation === 'permanent-delete' ? 'permanent-delete' : operation,
        status: 'pending',
        errorMessage: null,
        updatedAt: now,
      })
    } else {
      await db.syncQueue.add({
        id: crypto.randomUUID(),
        entityId: fileId,
        entityType: 'file',
        operation,
        status: 'pending',
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
        errorMessage: null,
      })
    }
    kept = true
  })
  if (kept) {
    void processPendingDriveSync().catch(() => {})
  }
  return kept
}

export async function mergeConflictVersions(fileId: string, mergedContent: string, expectedVersionId?: string) {
  const now = new Date().toISOString()
  let merged = false
  await db.transaction('rw', db.files, db.fileVersions, db.syncQueue, async () => {
    const file = await db.files.get(fileId)
    const conflict = file?.syncConflict
    if (!file || !conflict) return
    if (expectedVersionId && conflict.versionId !== expectedVersionId) return

    await db.fileVersions.add({
      id: crypto.randomUUID(),
      fileId,
      source: 'local',
      content: file.content,
      name: file.name,
      mimeType: file.mimeType,
      driveFileId: file.driveFileId,
      driveModifiedTime: conflict.remoteModifiedTime,
      createdAt: now,
      label: 'Before merging versions',
    })
    await db.files.update(fileId, {
      content: mergedContent,
      baseContent: mergedContent,
      syncConflict: null,
      lastSyncedAt: conflict.remoteModifiedTime,
      syncStatus: 'pending',
      syncError: null,
      updatedAt: now,
    })
    const existing = await db.syncQueue
      .filter((item) => item.entityType === 'file' && item.entityId === fileId && item.status !== 'completed')
      .first()
    const operation = file.driveFileId ? 'update' : 'create'
    if (existing) {
      await db.syncQueue.update(existing.id, {
        operation: existing.operation === 'permanent-delete' ? 'permanent-delete' : operation,
        status: 'pending',
        errorMessage: null,
        updatedAt: now,
      })
    } else {
      await db.syncQueue.add({
        id: crypto.randomUUID(),
        entityId: fileId,
        entityType: 'file',
        operation,
        status: 'pending',
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
        errorMessage: null,
      })
    }
    merged = true
  })
  if (merged) {
    void processPendingDriveSync().catch(() => {})
  }
  return merged
}

export async function applyRemoteVersion(fileId: string, expectedVersionId?: string) {
  const now = new Date().toISOString()
  let applied = false
  await db.transaction('rw', db.files, db.fileVersions, db.syncQueue, async () => {
    const file = await db.files.get(fileId)
    const conflict = file?.syncConflict
    if (!file || !conflict) return
    if (expectedVersionId && conflict.versionId !== expectedVersionId) return
    const remote = await db.fileVersions.get(conflict.versionId)
    if (!remote) return

    await db.fileVersions.add({
      id: crypto.randomUUID(),
      fileId,
      source: 'local',
      content: file.content,
      name: file.name,
      mimeType: file.mimeType,
      driveFileId: file.driveFileId,
      driveModifiedTime: conflict.remoteModifiedTime,
      createdAt: now,
      label: 'Before using remote version',
    })
    await db.files.update(fileId, {
      content: remote.content,
      baseContent: remote.content,
      syncConflict: null,
      lastSyncedAt: conflict.remoteModifiedTime,
      syncStatus: 'backed-up',
      syncError: null,
      updatedAt: conflict.remoteModifiedTime,
    })
    await db.syncQueue
      .filter((item) => item.entityType === 'file' && item.entityId === fileId && item.status !== 'completed')
      .modify({ status: 'completed', errorMessage: null, updatedAt: now })
    applied = true
  })
  return applied
}
