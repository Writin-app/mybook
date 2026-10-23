// @vitest-environment jsdom
import { Editor, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../database/db'
import { keepLocalVersion, recordRemoteConflict } from '../../services/syncConflicts'
import { mergeDocuments } from '../../utils/documentMerge'
import { applyRemoteDocumentPatch } from './remoteEditorPatch'

describe('Phase 3B: Failed Remote Update Recovery', () => {
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

  it('preserves local draft and records recoverable conflict when patch fails', async () => {
    const fileId = 'test-file-1'
    const now = new Date().toISOString()
    await db.files.add({
      id: fileId,
      name: 'Test Doc',
      type: 'document',
      content: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Local draft content' }] }],
      }),
      folderId: null,
      driveFileId: null,
      workspaceType: 'local',
      mimeType: 'application/json',
      lastSyncedAt: null,
      syncStatus: 'local',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    const editor = createTestEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Local draft content' }] }],
    })

    // User selects text and has active focus
    editor.commands.setTextSelection({ from: 1, to: 10 })
    editor.view.focus()

    // Remote update directly collides with the active selection
    const remoteContent = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Conflicting remote content' }] }],
    })

    const patchRes = applyRemoteDocumentPatch(editor, remoteContent)
    expect(patchRes.applied).toBe(false)
    expect(patchRes.error).toBeDefined()

    // Editor local draft is 100% preserved
    expect(editor.getText()).toBe('Local draft content')

    // Record recoverable conflict in database
    const conflict = await recordRemoteConflict(fileId, remoteContent, now)
    expect(conflict).toBeDefined()

    // Verify database stores the remote version without dropping it
    const updatedFile = await db.files.get(fileId)
    expect(updatedFile?.syncConflict?.versionId).toBe(conflict?.versionId)

    const savedVersion = await db.fileVersions.get(conflict!.versionId)
    expect(savedVersion).toBeDefined()
    expect(savedVersion?.content).toBe(remoteContent)
    expect(savedVersion?.label).toBe('Remote version (not applied)')

    editor.destroy()
  })

  it('retries pending remote update after local typing finishes and applies cleanly', () => {
    const baseContent = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sentence One. Sentence Two.' }] }],
    })

    const editor = createTestEditor(JSON.parse(baseContent) as JSONContent)

    // User is actively typing at the end of the sentence
    editor.commands.setTextSelection(28)
    editor.commands.insertContent(' Local edit.')
    expect(editor.getText()).toBe('Sentence One. Sentence Two. Local edit.')

    // Incoming remote update modified Sentence One
    const remoteContent = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Remote One. Sentence Two.' }] }],
    })

    // Simulate retaining the pending remote update during active typing
    const pending = {
      content: remoteContent,
      baseContent,
      timestamp: Date.now(),
    }

    // Now user pauses typing and local autosave triggers retry:
    // 3-way merge is computed against the latest local content
    const currentLocalContent = JSON.stringify(editor.getJSON())
    const merged = mergeDocuments(pending.baseContent, currentLocalContent, pending.content)
    expect(merged.success).toBe(true)
    expect(merged.hasConflict).toBe(false)

    // Retry patch applies merged content non-destructively
    const retryRes = applyRemoteDocumentPatch(editor, merged.content)
    expect(retryRes.applied).toBe(true)

    // Both remote and local work are preserved!
    expect(editor.getText()).toBe('Remote One. Sentence Two. Local edit.')

    editor.destroy()
  })

  it('persists pending update to database when user switches documents without resolving', async () => {
    const fileId = 'test-file-switch'
    const now = new Date().toISOString()
    await db.files.add({
      id: fileId,
      name: 'Document To Switch',
      type: 'document',
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft before switch"}]}]}',
      folderId: null,
      driveFileId: null,
      workspaceType: 'local',
      mimeType: 'application/json',
      lastSyncedAt: null,
      syncStatus: 'local',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    // Unresolved pending remote update exists when document is unmounted
    const pendingRemoteContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Unapplied remote edit"}]}]}'
    const conflict = await recordRemoteConflict(fileId, pendingRemoteContent, now)
    expect(conflict).toBeDefined()

    // File in database now has syncConflict flag retained across sessions
    const fileInDb = await db.files.get(fileId)
    expect(fileInDb?.syncConflict).toBeDefined()
    expect(fileInDb?.syncConflict?.remoteModifiedTime).toBe(now)

    // Remote content is queryable from fileVersions
    const versionInDb = await db.fileVersions.get(fileInDb!.syncConflict!.versionId)
    expect(versionInDb?.content).toBe(pendingRemoteContent)
  })

  it('clears conflict state cleanly when user chooses to keep local version', async () => {
    const fileId = 'test-file-resolve'
    const now = new Date().toISOString()
    const localContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"My preferred draft"}]}]}'
    const remoteContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Remote alternate"}]}]}'

    await db.files.add({
      id: fileId,
      name: 'Resolve Doc',
      type: 'document',
      content: localContent,
      folderId: null,
      driveFileId: null,
      workspaceType: 'local',
      mimeType: 'application/json',
      lastSyncedAt: null,
      syncStatus: 'local',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    const conflict = await recordRemoteConflict(fileId, remoteContent, now)
    expect(conflict).toBeDefined()

    // User chooses "Keep my version"
    const kept = await keepLocalVersion(fileId, conflict!.versionId)
    expect(kept).toBe(true)

    // Conflict flag is cleared on file
    const fileAfterKeep = await db.files.get(fileId)
    expect(fileAfterKeep?.syncConflict).toBeNull()
    // Local content remains intact
    expect(fileAfterKeep?.content).toBe(localContent)
  })

  it('does not duplicate conflict versions when same remote timestamp is recorded repeatedly', async () => {
    const fileId = 'test-file-dup'
    const now = new Date().toISOString()
    const content = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Remote A"}]}]}'

    await db.files.add({
      id: fileId,
      name: 'Duplicate Test Doc',
      type: 'document',
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Local A"}]}]}',
      folderId: null,
      driveFileId: null,
      workspaceType: 'local',
      mimeType: 'application/json',
      lastSyncedAt: null,
      syncStatus: 'local',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    const firstConflict = await recordRemoteConflict(fileId, content, now)
    const secondConflict = await recordRemoteConflict(fileId, content, now)

    // Must return the existing conflict and not insert duplicate versions
    expect(firstConflict?.versionId).toBe(secondConflict?.versionId)

    const allVersions = await db.fileVersions.where('fileId').equals(fileId).toArray()
    expect(allVersions.length).toBe(1)
  })
})
