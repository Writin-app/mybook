import { db } from '../database/db'
import { processPendingDriveSync } from '../database/repositories'
import type { MyBookFile, SyncConflict } from '../types/files'
import { areDocumentContentsEquivalent } from '../utils/documentMerge'

// Creates a non-blocking companion file (conflicted copy pattern)
// so genuine external Drive conflicts never lock the active editor or cause data loss.
export async function createConflictedCopyFile(
  fileId: string,
  remoteContent: string,
  remoteModifiedTime: string
): Promise<MyBookFile | null> {
  return db.transaction('rw', db.files, async () => {
    const file = await db.files.get(fileId)
    if (!file) return null

    if (areDocumentContentsEquivalent(file.content, remoteContent)) {
      return null
    }

    const baseName = file.name.replace(/\.(?:md|markdown)$/i, '').trim()
    const dateStr = remoteModifiedTime
      ? new Date(remoteModifiedTime).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
    const copyName = `${baseName} (Conflicted copy ${dateStr})`

    const existing = await db.files
      .filter((candidate) => !candidate.isDeleted && candidate.folderId === file.folderId && candidate.name === copyName)
      .first()
    if (existing) {
      if (areDocumentContentsEquivalent(existing.content, remoteContent)) {
        return existing
      }
    }

    const now = new Date().toISOString()
    const conflictedCopy: MyBookFile = {
      id: crypto.randomUUID(),
      driveFileId: null,
      workspaceType: file.workspaceType ?? 'drive',
      name: copyName,
      type: file.type,
      folderId: file.folderId,
      content: remoteContent,
      baseContent: remoteContent,
      mimeType: file.mimeType,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: remoteModifiedTime,
      syncStatus: 'backed-up',
      isDeleted: false,
    }

    await db.files.add(conflictedCopy)
    return conflictedCopy
  })
}

// Keeps the local document and stores the remote content as a recoverable
// version, so a remote edit is never dropped without a trace.
export async function recordRemoteConflict(fileId: string, remoteContent: string, remoteModifiedTime: string) {
  return db.transaction('rw', db.files, db.fileVersions, async () => {
    const file = await db.files.get(fileId)
    if (!file) return null

    // Check the saved snapshot inside the same transaction that records the
    // conflict. Autosave may have converged after the refresh began; an early
    // non-transactional read would otherwise publish a stale banner afterward.
    if (areDocumentContentsEquivalent(file.content, remoteContent)) {
      await db.files.update(fileId, {
        syncConflict: null,
        baseContent: remoteContent,
        lastSyncedAt: remoteModifiedTime || file.lastSyncedAt,
      })
      return null
    }

    if (file.syncConflict?.versionId) {
      if (file.syncConflict.remoteModifiedTime === remoteModifiedTime) return file.syncConflict
      const existingVersion = await db.fileVersions.get(file.syncConflict.versionId)
      if (existingVersion && areDocumentContentsEquivalent(existingVersion.content, remoteContent)) {
        // Remote content has not changed. Retain the stable conflict versionId and do not duplicate history.
        if (remoteModifiedTime && remoteModifiedTime !== file.syncConflict.remoteModifiedTime) {
          const updatedConflict: SyncConflict = { ...file.syncConflict, remoteModifiedTime }
          await db.files.update(fileId, { syncConflict: updatedConflict })
          await db.fileVersions.update(file.syncConflict.versionId, { driveModifiedTime: remoteModifiedTime })
          return updatedConflict
        }
        return file.syncConflict
      }

      const existingTime = new Date(file.syncConflict.remoteModifiedTime).getTime()
      const incomingTime = new Date(remoteModifiedTime).getTime()
      if (!isNaN(existingTime) && !isNaN(incomingTime) && existingTime >= incomingTime) {
        return file.syncConflict
      }
    }

    const conflict: SyncConflict = { remoteModifiedTime, versionId: crypto.randomUUID(), detectedAt: new Date().toISOString() }
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
    return conflict
  })
}

// Local edits win. The remote version stays in history and is acknowledged, so
// only newer remote changes raise another conflict.
export async function keepLocalVersion(
  fileId: string,
  expectedVersionId?: string,
  resolvedContent?: string,
  expectedRemoteModifiedTime?: string
) {
  const now = new Date().toISOString()
  let kept = false
  await db.transaction('rw', db.files, db.fileVersions, db.syncQueue, async () => {
    const file = await db.files.get(fileId)
    if (!file?.syncConflict) return
    const versionMatches = !expectedVersionId || file.syncConflict.versionId === expectedVersionId
    const timeMatches = Boolean(expectedRemoteModifiedTime && file.syncConflict.remoteModifiedTime === expectedRemoteModifiedTime)
    if (!versionMatches && !timeMatches) return

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

export async function mergeConflictVersions(
  fileId: string,
  mergedContent: string,
  expectedVersionId?: string,
  expectedRemoteModifiedTime?: string
) {
  const now = new Date().toISOString()
  let merged = false
  await db.transaction('rw', db.files, db.fileVersions, db.syncQueue, async () => {
    const file = await db.files.get(fileId)
    const conflict = file?.syncConflict
    if (!file || !conflict) return
    const versionMatches = !expectedVersionId || conflict.versionId === expectedVersionId
    const timeMatches = Boolean(expectedRemoteModifiedTime && conflict.remoteModifiedTime === expectedRemoteModifiedTime)
    if (!versionMatches && !timeMatches) return

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

export async function applyRemoteVersion(
  fileId: string,
  expectedVersionId?: string,
  expectedRemoteModifiedTime?: string
) {
  const now = new Date().toISOString()
  let applied = false
  await db.transaction('rw', db.files, db.fileVersions, db.syncQueue, async () => {
    const file = await db.files.get(fileId)
    const conflict = file?.syncConflict
    if (!file || !conflict) return
    const versionMatches = !expectedVersionId || conflict.versionId === expectedVersionId
    const timeMatches = Boolean(expectedRemoteModifiedTime && conflict.remoteModifiedTime === expectedRemoteModifiedTime)
    if (!versionMatches && !timeMatches) return
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
