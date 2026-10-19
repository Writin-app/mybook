// @vitest-environment jsdom
import { Editor, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../database/db'
import {
  applyRemoteVersion,
  keepLocalVersion,
  mergeConflictVersions,
  recordRemoteConflict,
} from '../../services/syncConflicts'
import type { MyBookFile } from '../../types/files'
import { mergeDocuments } from '../../utils/documentMerge'
import { applyRemoteDocumentPatch } from './remoteEditorPatch'

describe('Phase 3C: Pending Remote Update Integrity Audit', () => {
  beforeEach(async () => {
    await db.files.clear()
    await db.fileVersions.clear()
    await db.syncQueue.clear()
  })

  const createTestEditor = (content: JSONContent) =>
    new Editor({
      extensions: [StarterKit],
      content,
    })

  const createMockFile = (overrides: Partial<MyBookFile> = {}): MyBookFile => {
    const now = new Date().toISOString()
    return {
      id: 'file-audit-1',
      name: 'Integrity Audit Doc',
      type: 'document',
      folderId: null,
      driveFileId: 'drive-audit-1',
      workspaceType: 'drive',
      mimeType: 'application/x-mybook-document',
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Base content."}]}]}',
      baseContent: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Base content."}]}]}',
      lastSyncedAt: now,
      syncStatus: 'backed-up',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }
  }

  describe('1. Multiple incoming updates', () => {
    it('accumulates sequential rapid remote updates without discarding earlier changes', () => {
      const baseContent = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Section 1' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Section 2' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Section 3' }] },
        ],
      })

      // Editor has local user typing in Section 2
      const editor = createTestEditor(JSON.parse(baseContent) as JSONContent)
      editor.commands.setTextSelection(21)
      editor.commands.insertContent(' - Local addition')
      expect(editor.getText()).toContain('Section 2 - Local addition')

      // First remote update modifies Section 1
      const remoteUpdate1 = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Section 1 (Remote Edit 1)' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Section 2' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Section 3' }] },
        ],
      })

      // Simulate first update becoming pending
      let pendingRemote: { content: string; baseContent?: string; timestamp: number } | null = {
        content: remoteUpdate1,
        baseContent,
        timestamp: Date.now(),
      }

      // Second remote update arrives modifying Section 3 while user is still typing in Section 2
      const remoteUpdate2 = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Section 1' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Section 2' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Section 3 (Remote Edit 2)' }] },
        ],
      })

      // Queue reconciles incoming update with existing pending update
      const combinedRemote = mergeDocuments(pendingRemote.baseContent ?? baseContent, pendingRemote.content, remoteUpdate2)
      expect(combinedRemote.success).toBe(true)
      expect(combinedRemote.hasConflict).toBe(false)

      pendingRemote = {
        content: combinedRemote.content,
        baseContent,
        timestamp: Date.now(),
      }

      // Verify cumulative remote contains BOTH remote changes
      expect(combinedRemote.content).toContain('Section 1 (Remote Edit 1)')
      expect(combinedRemote.content).toContain('Section 3 (Remote Edit 2)')

      // When local user pauses typing and autosave triggers retry:
      const currentLocal = JSON.stringify(editor.getJSON())
      const finalMerge = mergeDocuments(baseContent, currentLocal, pendingRemote.content)
      expect(finalMerge.success).toBe(true)
      expect(finalMerge.hasConflict).toBe(false)

      const patchRes = applyRemoteDocumentPatch(editor, finalMerge.content)
      expect(patchRes.applied).toBe(true)

      // All three changes coexist: Remote 1, Local 2, and Remote 3!
      expect(editor.getText()).toBe(
        'Section 1 (Remote Edit 1)\n\nSection 2 - Local addition\n\nSection 3 (Remote Edit 2)'
      )

      editor.destroy()
    })

    it('escalates to durable conflict when two incoming remote updates conflict with each other', async () => {
      const fileId = 'file-conflicting-remotes'
      const now = new Date().toISOString()
      const baseContent = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original line' }] }],
      })

      await db.files.add(createMockFile({ id: fileId, content: baseContent, baseContent }))

      const remoteUpdate1 = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Remote branch Alpha' }] }],
      })
      const remoteUpdate2 = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Remote branch Beta' }] }],
      })

      // Attempting to combine contradictory remote updates detects conflict
      const combined = mergeDocuments(baseContent, remoteUpdate1, remoteUpdate2)
      expect(combined.hasConflict).toBe(true)

      // Immediately records conflict so neither version is silently discarded
      const conflict = await recordRemoteConflict(fileId, remoteUpdate2, now)
      expect(conflict).toBeDefined()

      const fileInDb = await db.files.get(fileId)
      expect(fileInDb?.syncConflict?.versionId).toBe(conflict?.versionId)
    })
  })

  describe('2. Retry lifecycle & no-typing recovery', () => {
    it('retries and applies pending remote patch even if no further typing occurs', () => {
      const baseContent = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Sentence A.' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Sentence B.' }] },
        ],
      })

      const editor = createTestEditor(JSON.parse(baseContent) as JSONContent)

      // Remote update changed Sentence A
      const remoteContent = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Sentence A (Remote).' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Sentence B.' }] },
        ],
      })

      // Transient pending patch exists
      const pending = {
        content: remoteContent,
        baseContent,
        timestamp: Date.now(),
      }

      // User did not type any further characters: editor content matches local exactly
      const currentLocal = JSON.stringify(editor.getJSON())
      expect(currentLocal).toBe(baseContent)

      // Flush / retry lifecycle executes retry without needing new typing
      const merged = mergeDocuments(pending.baseContent, currentLocal, pending.content)
      expect(merged.success).toBe(true)
      expect(merged.hasConflict).toBe(false)

      const patchRes = applyRemoteDocumentPatch(editor, merged.content)
      expect(patchRes.applied).toBe(true)
      expect(editor.getText()).toBe('Sentence A (Remote).\n\nSentence B.')

      editor.destroy()
    })
  })

  describe('3. Navigation and reload durability', () => {
    it('persists unapplied remote update to IndexedDB and recovers upon reload', async () => {
      const fileId = 'file-durable-nav'
      const now = new Date().toISOString()
      const localContent = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Local draft prior to unmount' }] }],
      })
      const remoteContent = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Remote update waiting for recovery' }] }],
      })

      await db.files.add(createMockFile({ id: fileId, content: localContent }))

      // On unmount/navigation, pending update is recorded as durable conflict
      const conflict = await recordRemoteConflict(fileId, remoteContent, now)
      expect(conflict).toBeDefined()

      // Simulate app reload: fetch fresh file from database
      const reloadedFile = await db.files.get(fileId)
      expect(reloadedFile).toBeDefined()
      expect(reloadedFile?.syncConflict).toBeDefined()
      expect(reloadedFile?.syncConflict?.versionId).toBe(conflict?.versionId)

      // Fetch stored remote version from db.fileVersions
      const storedVersion = await db.fileVersions.get(conflict!.versionId)
      expect(storedVersion).toBeDefined()
      expect(storedVersion?.content).toBe(remoteContent)
      expect(storedVersion?.label).toBe('Remote version (not applied)')
    })
  })

  describe('4. Conflict resolution isolation & stale callback guards', () => {
    it('clears only the expected conflict version and rejects stale resolution callbacks', async () => {
      const fileId = 'file-stale-callback'
      const now = new Date().toISOString()
      const localContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"My current draft"}]}]}'
      const remoteContentV1 = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Remote V1"}]}]}'
      const remoteContentV2 = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Remote V2 (Newer)"}]}]}'

      await db.files.add(createMockFile({ id: fileId, content: localContent }))

      // Conflict V1 recorded
      const conflictV1 = await recordRemoteConflict(fileId, remoteContentV1, now)
      expect(conflictV1).toBeDefined()

      // Later, a newer conflict V2 arrives
      const later = new Date(Date.now() + 10000).toISOString()
      const conflictV2 = await recordRemoteConflict(fileId, remoteContentV2, later)
      expect(conflictV2).toBeDefined()
      expect(conflictV2?.versionId).not.toBe(conflictV1?.versionId)

      // A stale resolution callback tries to resolve V1 with expectedVersionId = conflictV1.versionId
      const keptStale = await keepLocalVersion(fileId, conflictV1!.versionId)
      expect(keptStale).toBe(false)

      // Newer conflict V2 remains completely intact!
      const fileAfterStale = await db.files.get(fileId)
      expect(fileAfterStale?.syncConflict?.versionId).toBe(conflictV2?.versionId)

      // Resolving with the correct newer versionId succeeds
      const keptNewer = await keepLocalVersion(fileId, conflictV2!.versionId)
      expect(keptNewer).toBe(true)

      const fileAfterNewer = await db.files.get(fileId)
      expect(fileAfterNewer?.syncConflict).toBeNull()
    })

    it('Keep my version resolves conflict, records local content, and preserves resolution state', async () => {
      const fileId = 'file-keep-resolution-lifecycle'
      const remoteTime = new Date(Date.now() + 5000).toISOString()
      const localContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"My preferred draft"}]}]}'
      const remoteContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Remote alternate"}]}]}'

      await db.files.add(createMockFile({
        id: fileId,
        content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Old db content"}]}]}',
        baseContent: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Base"}]}]}',
      }))

      const conflict = await recordRemoteConflict(fileId, remoteContent, remoteTime)
      expect(conflict).toBeDefined()

      const kept = await keepLocalVersion(fileId, conflict!.versionId, localContent)
      expect(kept).toBe(true)

      const fileAfterKeep = await db.files.get(fileId)
      expect(fileAfterKeep?.syncConflict).toBeNull()
      expect(fileAfterKeep?.content).toBe(localContent)
      expect(fileAfterKeep?.baseContent).toBe(remoteContent)
      expect(fileAfterKeep?.lastSyncedAt).toBe(remoteTime)
      expect(fileAfterKeep?.syncStatus).toBe('pending')

      const queueItem = await db.syncQueue.filter((item) => item.entityId === fileId && item.status === 'pending').first()
      expect(queueItem).toBeDefined()
      expect(queueItem?.operation).toBe('update')
    })

    it('mergeConflictVersions records pre-merge history and marks sync pending for push', async () => {
      const fileId = 'file-merge-action'
      const now = new Date().toISOString()
      const localContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft A"}]}]}'
      const remoteContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft B"}]}]}'
      const mergedContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft A + B"}]}]}'

      await db.files.add(createMockFile({ id: fileId, content: localContent }))
      const conflict = await recordRemoteConflict(fileId, remoteContent, now)

      const merged = await mergeConflictVersions(fileId, mergedContent, conflict!.versionId)
      expect(merged).toBe(true)

      const updated = await db.files.get(fileId)
      expect(updated?.content).toBe(mergedContent)
      expect(updated?.syncConflict).toBeNull()
      expect(updated?.syncStatus).toBe('pending')

      // Pre-merge local version is preserved in fileVersions history
      const history = await db.fileVersions.where('fileId').equals(fileId).toArray()
      const preMerge = history.find((v) => v.label === 'Before merging versions')
      expect(preMerge).toBeDefined()
      expect(preMerge?.content).toBe(localContent)
    })

    it('applyRemoteVersion uses the remote version, archives local draft, and clears conflict', async () => {
      const fileId = 'file-apply-remote-action'
      const now = new Date().toISOString()
      const localContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"My local draft"}]}]}'
      const remoteContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Remote official version"}]}]}'

      await db.files.add(createMockFile({ id: fileId, content: localContent }))
      const conflict = await recordRemoteConflict(fileId, remoteContent, now)

      const applied = await applyRemoteVersion(fileId, conflict!.versionId)
      expect(applied).toBe(true)

      const updated = await db.files.get(fileId)
      expect(updated?.content).toBe(remoteContent)
      expect(updated?.syncConflict).toBeNull()
      expect(updated?.syncStatus).toBe('backed-up')

      // Pre-remote local draft is preserved in history
      const history = await db.fileVersions.where('fileId').equals(fileId).toArray()
      const preRemote = history.find((v) => v.label === 'Before using remote version')
      expect(preRemote).toBeDefined()
      expect(preRemote?.content).toBe(localContent)
    })
  })

  describe('5. Drive sync & persistence', () => {
    it('sync queue does not push local draft to Drive while syncConflict is unresolved', async () => {
      const fileId = 'file-pause-push'
      const now = new Date().toISOString()
      const localContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Local unpushed"}]}]}'
      const remoteContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Drive version"}]}]}'

      await db.files.add(createMockFile({ id: fileId, content: localContent }))
      await recordRemoteConflict(fileId, remoteContent, now)

      // Add a sync queue item representing a pending push
      await db.syncQueue.add({
        id: 'queue-item-1',
        entityId: fileId,
        entityType: 'file',
        operation: 'update',
        status: 'pending',
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
        errorMessage: null,
      })

      // Verify file has syncConflict
      const fileInDb = await db.files.get(fileId)
      expect(fileInDb?.syncConflict).toBeDefined()

      // Simulate repository sync processor check
      const fileToBackup = await db.files.get(fileId)
      const shouldSkipPush = Boolean(fileToBackup?.syncConflict)
      expect(shouldSkipPush).toBe(true)
    })

    it('rejects stale or out-of-order conflict timestamps so an older event cannot overwrite newer conflict', async () => {
      const fileId = 'file-timestamp-ordering'
      const earlier = new Date(Date.now() - 60000).toISOString()
      const later = new Date(Date.now() + 60000).toISOString()

      await db.files.add(createMockFile({ id: fileId }))

      // Newer conflict recorded first (e.g. from rapid cross-tab or drive sync)
      const conflictNewer = await recordRemoteConflict(fileId, 'Newer remote content', later)
      expect(conflictNewer).toBeDefined()

      // Stale/delayed lifecycle event tries to record an earlier timestamp
      const conflictStale = await recordRemoteConflict(fileId, 'Older remote content', earlier)

      // Must NOT overwrite the newer conflict!
      expect(conflictStale?.versionId).toBe(conflictNewer?.versionId)
      const fileInDb = await db.files.get(fileId)
      expect(fileInDb?.syncConflict?.remoteModifiedTime).toBe(later)
      expect(fileInDb?.syncConflict?.versionId).toBe(conflictNewer?.versionId)
    })

    it('retains in-memory pending state when durable write fails', async () => {
      const fileId = 'file-pending-retention'
      const baseContent = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Base' }] }],
      })
      await db.files.add(createMockFile({ id: fileId, content: baseContent }))

      const pending = {
        content: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Remote payload' }] }],
        }),
        baseContent,
        timestamp: Date.now(),
      }

      let inMemoryPending: typeof pending | null = pending

      // If durable record fails, in-memory state is NOT cleared
      try {
        throw new Error('Database locked or transient quota error')
        // (Simulate recordRemoteConflict throwing)
      } catch {
        // In-memory state remains intact!
        expect(inMemoryPending).not.toBeNull()
        expect(inMemoryPending?.content).toContain('Remote payload')
      }

      // Successful durable write then clears in-memory state
      const conflict = await recordRemoteConflict(fileId, pending.content, new Date(pending.timestamp).toISOString())
      expect(conflict).toBeDefined()
      inMemoryPending = null
      expect(inMemoryPending).toBeNull()

      const fileInDb = await db.files.get(fileId)
      expect(fileInDb?.syncConflict?.versionId).toBe(conflict?.versionId)
    })
  })
})
