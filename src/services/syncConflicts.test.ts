import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '../database/db'
import type { MyBookFile } from '../types/files'
import { applyRemoteVersion, createConflictedCopyFile, keepLocalVersion, mergeConflictVersions, recordRemoteConflict } from './syncConflicts'

const file = (overrides: Partial<MyBookFile> = {}): MyBookFile => ({
  id: 'file-1', driveFileId: 'drive-1', name: 'Doc', type: 'document', folderId: null, content: 'local edit', baseContent: 'base',
  mimeType: 'application/x-mybook-document', createdAt: '2026-10-03T10:00:00.000Z', updatedAt: '2026-10-03T10:00:00.000Z',
  lastSyncedAt: '2026-10-03T11:00:00.000Z', syncStatus: 'pending', isDeleted: false, ...overrides,
})

describe('sync conflicts', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.files.add(file())
  })

  it('records the remote content as a version without touching local content', async () => {
    await recordRemoteConflict('file-1', 'remote edit', '2026-10-03T12:00:00.000Z')

    const stored = await db.files.get('file-1')
    expect(stored?.content).toBe('local edit')
    expect(stored?.syncConflict?.remoteModifiedTime).toBe('2026-10-03T12:00:00.000Z')
    expect((await db.fileVersions.get(stored!.syncConflict!.versionId))?.content).toBe('remote edit')
  })

  it('does not record the same remote version twice', async () => {
    await recordRemoteConflict('file-1', 'remote edit', '2026-10-03T12:00:00.000Z')
    await recordRemoteConflict('file-1', 'remote edit', '2026-10-03T12:00:00.000Z')
    expect(await db.fileVersions.count()).toBe(1)
  })

  it('does not create a conflict when autosave has already converged to the remote content', async () => {
    await db.files.update('file-1', { content: 'same content' })

    const conflict = await recordRemoteConflict('file-1', 'same content', '2026-10-03T12:00:00.000Z')

    expect(conflict).toBeNull()
    expect((await db.files.get('file-1'))).toMatchObject({
      syncConflict: null,
      baseContent: 'same content',
      lastSyncedAt: '2026-10-03T12:00:00.000Z',
    })
    expect(await db.fileVersions.count()).toBe(0)
  })

  it('clears a stored conflict when its remote version now equals the saved local content', async () => {
    const conflict = await recordRemoteConflict('file-1', 'remote edit', '2026-10-03T12:00:00.000Z')
    await db.files.update('file-1', { content: 'remote edit' })

    const cleared = await recordRemoteConflict('file-1', 'remote edit', '2026-10-03T12:00:00.000Z')

    expect(cleared).toBeNull()
    expect((await db.files.get('file-1'))).toMatchObject({
      syncConflict: null,
      baseContent: 'remote edit',
      lastSyncedAt: '2026-10-03T12:00:00.000Z',
    })
    expect(await db.fileVersions.get(conflict!.versionId)).toMatchObject({ content: 'remote edit' })
  })

  it('keeps local edits, acknowledges the remote version and queues a push', async () => {
    await recordRemoteConflict('file-1', 'remote edit', '2026-10-03T12:00:00.000Z')
    await keepLocalVersion('file-1')

    const stored = await db.files.get('file-1')
    expect(stored).toMatchObject({ content: 'local edit', syncConflict: null, syncStatus: 'pending', lastSyncedAt: '2026-10-03T12:00:00.000Z' })

    const queueItem = await db.syncQueue.filter((item) => item.entityId === 'file-1').first()
    expect(queueItem).toMatchObject({
      entityId: 'file-1',
      entityType: 'file',
      operation: 'update',
      status: 'pending',
    })
  })

  it('uses the remote version on request and preserves the local one in history', async () => {
    await db.syncQueue.add({
      id: 'queue-1',
      entityId: 'file-1',
      entityType: 'file',
      operation: 'update',
      status: 'pending',
      retryCount: 0,
      createdAt: '2026-10-03T10:00:00.000Z',
      updatedAt: '2026-10-03T10:00:00.000Z',
      errorMessage: null,
    })
    await recordRemoteConflict('file-1', 'remote edit', '2026-10-03T12:00:00.000Z')
    expect(await applyRemoteVersion('file-1')).toBe(true)

    const stored = await db.files.get('file-1')
    expect(stored).toMatchObject({ content: 'remote edit', baseContent: 'remote edit', syncConflict: null, syncStatus: 'backed-up' })
    const versions = await db.fileVersions.toArray()
    expect(versions.some((version) => version.content === 'local edit' && version.label === 'Before using remote version')).toBe(true)

    const queueItem = await db.syncQueue.get('queue-1')
    expect(queueItem?.status).toBe('completed')
  })

  it('does not clear a newer conflict when resolving with an older expectedVersionId in keepLocalVersion', async () => {
    const c1 = await recordRemoteConflict('file-1', 'remote edit 1', '2026-10-03T12:00:00.000Z')
    const c2 = await recordRemoteConflict('file-1', 'remote edit 2', '2026-10-03T13:00:00.000Z')
    expect(c1?.versionId).not.toBe(c2?.versionId)

    const result = await keepLocalVersion('file-1', c1!.versionId)
    expect(result).toBe(false)

    const stored = await db.files.get('file-1')
    expect(stored?.syncConflict?.versionId).toBe(c2!.versionId)
    expect(stored?.syncConflict?.remoteModifiedTime).toBe('2026-10-03T13:00:00.000Z')
  })

  it('does not apply an older remote version when a newer conflict arrived', async () => {
    const c1 = await recordRemoteConflict('file-1', 'remote edit 1', '2026-10-03T12:00:00.000Z')
    const c2 = await recordRemoteConflict('file-1', 'remote edit 2', '2026-10-03T13:00:00.000Z')

    const applied = await applyRemoteVersion('file-1', c1!.versionId)
    expect(applied).toBe(false)

    const stored = await db.files.get('file-1')
    expect(stored?.content).toBe('local edit')
    expect(stored?.syncConflict?.versionId).toBe(c2!.versionId)
  })

  it('merges conflict versions safely, preserves local draft in history, and queues for upload', async () => {
    await recordRemoteConflict('file-1', 'remote edit', '2026-10-03T12:00:00.000Z')
    const storedBefore = await db.files.get('file-1')
    const conflictVersionId = storedBefore?.syncConflict?.versionId

    const merged = await mergeConflictVersions('file-1', 'merged content', conflictVersionId)
    expect(merged).toBe(true)

    const stored = await db.files.get('file-1')
    expect(stored).toMatchObject({
      content: 'merged content',
      baseContent: 'merged content',
      syncConflict: null,
      syncStatus: 'pending',
      lastSyncedAt: '2026-10-03T12:00:00.000Z',
    })

    const versions = await db.fileVersions.toArray()
    expect(versions.some((v) => v.content === 'local edit' && v.label === 'Before merging versions')).toBe(true)

    const queueItem = await db.syncQueue.filter((item) => item.entityId === 'file-1').first()
    expect(queueItem).toMatchObject({
      entityId: 'file-1',
      entityType: 'file',
      operation: 'update',
      status: 'pending',
    })
  })

  it('does not merge versions when a newer conflict has arrived', async () => {
    const c1 = await recordRemoteConflict('file-1', 'remote edit 1', '2026-10-03T12:00:00.000Z')
    const c2 = await recordRemoteConflict('file-1', 'remote edit 2', '2026-10-03T13:00:00.000Z')

    const merged = await mergeConflictVersions('file-1', 'merged content', c1!.versionId)
    expect(merged).toBe(false)

    const stored = await db.files.get('file-1')
    expect(stored?.content).toBe('local edit')
    expect(stored?.syncConflict?.versionId).toBe(c2!.versionId)
  })

  it('persists provided resolvedContent and updates baseContent to acknowledged remote version', async () => {
    const conflict = await recordRemoteConflict('file-1', 'remote colliding draft', '2026-10-03T12:00:00.000Z')
    expect(conflict).toBeDefined()

    const kept = await keepLocalVersion('file-1', conflict!.versionId, 'my editor draft')
    expect(kept).toBe(true)

    const stored = await db.files.get('file-1')
    expect(stored?.content).toBe('my editor draft')
    expect(stored?.baseContent).toBe('remote colliding draft')
    expect(stored?.lastSyncedAt).toBe('2026-10-03T12:00:00.000Z')
    expect(stored?.syncConflict).toBeNull()
    expect(stored?.syncStatus).toBe('pending')
  })

  it('keeps versionId stable and updates timestamp in place when same content is polled with newer time', async () => {
    const c1 = await recordRemoteConflict('file-1', 'remote draft', '2026-10-03T12:00:00.000Z')
    expect(c1).toBeDefined()
    const c2 = await recordRemoteConflict('file-1', 'remote draft', '2026-10-03T12:05:00.000Z')
    expect(c2?.versionId).toBe(c1?.versionId)
    expect(c2?.remoteModifiedTime).toBe('2026-10-03T12:05:00.000Z')

    // fileVersions should only have 1 version record for this stable conflict
    expect(await db.fileVersions.count()).toBe(1)
  })

  it('resolves keepLocalVersion using matching expectedRemoteModifiedTime', async () => {
    await recordRemoteConflict('file-1', 'remote colliding draft', '2026-10-03T12:00:00.000Z')
    const kept = await keepLocalVersion('file-1', undefined, 'my final draft', '2026-10-03T12:00:00.000Z')
    expect(kept).toBe(true)

    const stored = await db.files.get('file-1')
    expect(stored?.content).toBe('my final draft')
    expect(stored?.syncConflict).toBeNull()
  })

  describe('createConflictedCopyFile (Conflicted Copy Pattern)', () => {
    it('creates a companion file with remote content and conflicted copy naming', async () => {
      const copy = await createConflictedCopyFile('file-1', 'remote different edit', '2026-10-03T12:00:00.000Z')
      expect(copy).not.toBeNull()
      expect(copy?.name).toBe('Doc (Conflicted copy 2026-10-03)')
      expect(copy?.content).toBe('remote different edit')
      expect(copy?.syncStatus).toBe('backed-up')

      // Original file remains completely unchanged
      const original = await db.files.get('file-1')
      expect(original?.content).toBe('local edit')

      // Conflicted copy file is persisted in db.files
      const inDb = await db.files.get(copy!.id)
      expect(inDb?.name).toBe('Doc (Conflicted copy 2026-10-03)')
    })

    it('does not duplicate companion file when same remote content is received', async () => {
      const copy1 = await createConflictedCopyFile('file-1', 'remote different edit', '2026-10-03T12:00:00.000Z')
      const copy2 = await createConflictedCopyFile('file-1', 'remote different edit', '2026-10-03T12:00:00.000Z')
      expect(copy1?.id).toBe(copy2?.id)

      const totalFiles = await db.files.count()
      expect(totalFiles).toBe(2) // Original + 1 copy
    })

    it('returns null and creates no file when remote content equals local content', async () => {
      const copy = await createConflictedCopyFile('file-1', 'local edit', '2026-10-03T12:00:00.000Z')
      expect(copy).toBeNull()
      expect(await db.files.count()).toBe(1)
    })
  })
})
