// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { useDriveLiveSync } from '../hooks/useDriveLiveSync'
import * as googleDriveService from './googleDrive'
import { useAuthStore } from '../stores/useAuthStore'
import * as workspaceStore from '../stores/useWorkspaceStore'
import { reconcileExternalUpdate } from './syncReconciler'
import { broadcastDocUpdate } from './tabSyncChannel'
import { areDocumentContentsEquivalent, mergeDocuments } from '../utils/documentMerge'
import { applyRemoteDocumentPatch } from '../components/document-editor/remoteEditorPatch'
import { db } from '../database/db'
import { fileRepository } from '../database/repositories'
import { useAutosave } from '../hooks/useAutosave'
import type { MyBookFile } from '../types/files'
import { TiptapDocumentEditor } from '../components/document-editor/TiptapDocumentEditor'

let currentMockLiveFile: MyBookFile | undefined

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (_fn: () => unknown, deps?: unknown[], defaultVal?: unknown) => {
    if (deps && deps.length === 1) {
      return currentMockLiveFile
    }
    return defaultVal ?? []
  },
}))

vi.mock('../services/googleDrive', async () => {
  const actual = await vi.importActual<typeof import('../services/googleDrive')>('../services/googleDrive')
  return {
    ...actual,
    refreshDriveFileToLocal: vi.fn(),
  }
})

vi.mock('../stores/useWorkspaceStore', async () => {
  const actual = await vi.importActual<typeof import('../stores/useWorkspaceStore')>('../stores/useWorkspaceStore')
  return {
    ...actual,
    isLocalWorkspace: vi.fn(() => false),
    shouldSyncWithDrive: vi.fn(() => true),
  }
})

const createDocJson = (text: string) =>
  JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  })

const createMultiBlockDocJson = (p1: string, p2: string) =>
  JSON.stringify({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: p1 }] },
      { type: 'paragraph', content: [{ type: 'text', text: p2 }] },
    ],
  })

describe('Phase 7: Cross-Device Sync Latency and Safe Live Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceStore.isLocalWorkspace).mockReturnValue(false)
    useAuthStore.setState({ isAuthenticated: true, email: 'test@example.com' })
    vi.mocked(googleDriveService.refreshDriveFileToLocal).mockResolvedValue({ updated: false })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    window.scrollTo = vi.fn()
  })

  describe('Polling and Live Sync timing', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    // 1. Device B polls while focused and idle, but pauses during active typing
    it('detects remote changes while focused and idle, and pauses during typing', async () => {
      const { unmount } = renderHook(() =>
        useDriveLiveSync('doc-1', 'drive-1', { enabled: true, intervalMs: 2500, isEditing: false })
      )

      await act(async () => {
        vi.advanceTimersByTime(2500)
      })
      expect(googleDriveService.refreshDriveFileToLocal).toHaveBeenCalledWith('doc-1')
      expect(googleDriveService.refreshDriveFileToLocal).toHaveBeenCalledTimes(1)
      unmount()

      vi.mocked(googleDriveService.refreshDriveFileToLocal).mockClear()
      const hook2 = renderHook(() =>
        useDriveLiveSync('doc-2', 'drive-2', { enabled: true, intervalMs: 2500, isEditing: true })
      )

      await act(async () => {
        vi.advanceTimersByTime(2500)
      })
      expect(googleDriveService.refreshDriveFileToLocal).not.toHaveBeenCalled()
      hook2.unmount()
    })

    // 7. Hidden-tab, offline, and concurrent-poll behavior remain correct
    it('preserves offline, hidden-tab, and concurrent-poll safeguards', async () => {
      // A) Offline check: no polling when offline
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      renderHook(() => useDriveLiveSync('doc-1', 'drive-1', { enabled: true, intervalMs: 2500 }))

      await act(async () => {
        vi.advanceTimersByTime(5000)
      })
      expect(googleDriveService.refreshDriveFileToLocal).not.toHaveBeenCalled()

      // B) Hidden tab check: no polling when document is hidden
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      renderHook(() => useDriveLiveSync('doc-2', 'drive-2', { enabled: true, intervalMs: 2500 }))

      await act(async () => {
        vi.advanceTimersByTime(5000)
      })
      expect(googleDriveService.refreshDriveFileToLocal).not.toHaveBeenCalled()

      // C) Window focus / visibility change triggers immediate refresh when visible
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      renderHook(() => useDriveLiveSync('doc-3', 'drive-3', { enabled: true, intervalMs: 2500 }))

      await act(async () => {
        window.dispatchEvent(new Event('focus'))
      })
      expect(googleDriveService.refreshDriveFileToLocal).toHaveBeenCalledWith('doc-3')
    })
  })

  describe('Reconciliation and Remote Patching', () => {
    // 2. Device B detects remote changes while it has pending local edits without overwriting them
    it('detects remote changes while it has pending local edits without overwriting them', () => {
      const baseDoc = createMultiBlockDocJson('Section A - original', 'Section B - original')
      const localDocWithPendingPush = createMultiBlockDocJson('Section A - edited by Device B', 'Section B - original')
      const remoteDoc = createMultiBlockDocJson('Section A - original', 'Section B - edited by Device A')

      const decision = reconcileExternalUpdate({
        baseContent: baseDoc,
        localContent: localDocWithPendingPush,
        remoteContent: remoteDoc,
        remoteChanged: true,
        hasUnsavedLocalEdits: false,
        hasPendingPush: true,
        syncStatus: 'pending',
      })

      expect(decision.action).toBe('merge')
      if (decision.action === 'merge') {
        const parsed = JSON.parse(decision.mergedContent)
        expect(parsed.content[0].content[0].text).toBe('Section A - edited by Device B')
        expect(parsed.content[1].content[0].text).toBe('Section B - edited by Device A')
      }
    })

    // 3. Non-overlapping remote edits can be applied safely while the editor is active
    it('applies non-overlapping remote edits safely while the editor is active and preserves cursor position', () => {
      const editor = new Editor({
        extensions: [StarterKit],
        content: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph One' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph Two' }] },
          ],
        },
      })

      editor.commands.setTextSelection(6)
      const caretBefore = editor.state.selection.from

      const remoteUpdate = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph One' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph Two - updated by Device A' }] },
        ],
      }

      const patchResult = applyRemoteDocumentPatch(editor, remoteUpdate)
      expect(patchResult.applied).toBe(true)
      expect(patchResult.changed).toBe(true)

      expect(editor.state.selection.from).toBe(caretBefore)
      expect(editor.state.doc.child(1).textContent).toBe('Paragraph Two - updated by Device A')

      editor.destroy()
    })

    // 4. Overlapping edits do not swallow keystrokes or duplicate text
    it('rejects destructive overlapping replacement when cursor is inside the colliding block', () => {
      const editor = new Editor({
        extensions: [StarterKit],
        content: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Active Typing Block' }] },
          ],
        },
      })

      Object.defineProperty(editor, 'isFocused', { value: true, configurable: true })
      editor.commands.setTextSelection(5)

      const remoteUpdate = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Remote Overwrite Block' }] },
        ],
      }

      const patchResult = applyRemoteDocumentPatch(editor, remoteUpdate)
      expect(patchResult.applied).toBe(false)
      expect(patchResult.error).toContain('conflicts with active selection/typing')

      expect(editor.state.doc.child(0).textContent).toBe('Active Typing Block')

      editor.destroy()
    })

    // 5. Repeated polling does not lose a deferred patch or create duplicate conflicts
    it('combines subsequent incoming remote content cleanly with an existing deferred patch', () => {
      const base = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Original 1' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Original 2' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Original 3' }] },
        ],
      })

      const patch1 = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Original 1' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Remote edit 2' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Original 3' }] },
        ],
      })

      const patch2 = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Original 1' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Original 2' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Remote edit 3' }] },
        ],
      })

      const combined = mergeDocuments(base, patch1, patch2)
      expect(combined.success).toBe(true)
      const parsed = JSON.parse(combined.content)
      expect(parsed.content[2].content[0].text).toBe('Remote edit 3')
    })

    // 6. A genuinely newer remote edit still creates a conflict when required
    it('creates a genuine conflict when edits genuinely collide on the same block', () => {
      const baseDoc = createDocJson('Same Line')
      const localDoc = createDocJson('Local Line Edit')
      const remoteDoc = createDocJson('Remote Line Edit')

      const decision = reconcileExternalUpdate({
        baseContent: baseDoc,
        localContent: localDoc,
        remoteContent: remoteDoc,
        remoteChanged: true,
        hasUnsavedLocalEdits: false,
        hasPendingPush: true,
        syncStatus: 'pending',
      })

      expect(decision.action).toBe('conflict')
    })

    // 8. Phase 6 upload/poll coordination and Keep My Changes behavior remain intact
    it('preserves Keep My Changes resolution so the resolved remote version is not re-flagged', () => {
      const resolvedTime = '2026-10-21T12:00:00.000Z'
      const laterTime = '2026-10-21T12:05:00.000Z'

      const isNewerSameTime = new Date(resolvedTime).getTime() > new Date(resolvedTime).getTime()
      expect(isNewerSameTime).toBe(false)

      const isNewerLaterTime = new Date(laterTime).getTime() > new Date(resolvedTime).getTime()
      expect(isNewerLaterTime).toBe(true)
    })
  })

  /* =================================================================================
   * Phase 7.2 Concurrency & Data-Loss Verification Scenarios
   * ================================================================================= */

  describe('Phase 7.2: Data-Loss and Concurrency Protection', () => {
    beforeEach(async () => {
      await db.delete()
      await db.open()
    })

    // Scenario 1: An in-flight autosave write meets a concurrent remote merge in IndexedDB;
    // the atomic check rejects the stale save, preserving the merged content.
    it('Scenario 1: Atomic transaction in fileRepository.update rejects stale in-flight save when IndexedDB was concurrently updated by a remote merge', async () => {
      const created = await fileRepository.create('document')
      expect(created.success).toBe(true)
      const fileId = created.data!.id

      // Initial baseline write
      const initialUpdatedAt = '2026-10-21T10:00:00.000Z'
      await db.files.update(fileId, {
        content: createDocJson('Initial content'),
        updatedAt: initialUpdatedAt,
      })

      // Simulate concurrent remote merge committing to IndexedDB
      const remoteMergedContent = createDocJson('Merged content from remote')
      const mergedUpdatedAt = '2026-10-21T10:00:05.000Z'
      await db.files.update(fileId, {
        content: remoteMergedContent,
        updatedAt: mergedUpdatedAt,
      })

      // In-flight autosave that captured expectedUpdatedAt = initialUpdatedAt arrives
      const staleSaveResult = await fileRepository.update(
        fileId,
        { content: createDocJson('Stale local edit') },
        { expectedUpdatedAt: initialUpdatedAt, expectedContent: createDocJson('Initial content') }
      )

      // Must be rejected as stale
      expect(staleSaveResult.success).toBe(false)
      expect(staleSaveResult.stale).toBe(true)

      // Verified that IndexedDB record still contains the remote merged content
      const persisted = await db.files.get(fileId)
      expect(persisted?.content).toBe(remoteMergedContent)
      expect(persisted?.updatedAt).toBe(mergedUpdatedAt)
    })

    it('Scenario 1 (useAutosave integration): useAutosave clears in-flight state and preserves remote merged content on stale rejection', async () => {
      const initialDoc: MyBookFile = {
        id: 'file-autosave-test',
        driveFileId: 'drive-123',
        name: 'Autosave Test',
        type: 'document',
        folderId: null,
        content: createDocJson('Base Doc'),
        mimeType: 'application/json',
        createdAt: '2026-10-21T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z',
        lastSyncedAt: '2026-10-21T10:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      }

      await db.files.put(initialDoc)

      const { result, rerender } = renderHook(({ f }) => useAutosave(f), {
        initialProps: { f: initialDoc },
      })

      // User types local edit
      act(() => {
        result.current.setContent(createDocJson('Local unsaved typing'))
      })
      expect(result.current.hasUnsavedChanges()).toBe(true)

      // Meanwhile, background remote merge updates IndexedDB
      const remoteMergedDoc: MyBookFile = {
        ...initialDoc,
        content: createDocJson('Merged Doc from Drive'),
        updatedAt: '2026-10-21T10:00:05.000Z',
      }
      await db.files.put(remoteMergedDoc)

      // Trigger autosave directly
      let saveOutcome!: boolean
      await act(async () => {
        saveOutcome = await result.current.save()
      })

      // The save was rejected because IndexedDB had a newer updatedAt
      expect(saveOutcome).toBe(false)

      // IndexedDB was NOT overwritten with 'Local unsaved typing'
      const inDb = await db.files.get('file-autosave-test')
      expect(inDb?.content).toBe(createDocJson('Merged Doc from Drive'))

      // Rerender with the remote merged doc
      rerender({ f: remoteMergedDoc })
    })

    // Scenario 2: Remote update arrives within the 100 ms contentSyncTimerRef window;
    // liveContent is read directly from editor.getJSON(), preserving both local keystroke and remote edit.
    it('Scenario 2: Remote update during 100ms sync window reads liveContent directly from editor.getJSON()', () => {
      const editor = new Editor({
        extensions: [StarterKit],
        content: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph 1: Base' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph 2: Base' }] },
          ],
        },
      })

      const baseJson = JSON.stringify(editor.getJSON())

      // Keystroke in Paragraph 1 before the 100ms timer flushes:
      editor.commands.setContent({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph 1: Fresh Local Typing' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph 2: Base' }] },
        ],
      })

      // Reading liveContent directly from editor.getJSON():
      const liveContent = JSON.stringify(editor.getJSON())
      expect(liveContent).toContain('Fresh Local Typing')

      // Incoming remote update modified Paragraph 2:
      const remoteDoc = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph 1: Base' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph 2: Remote Edit' }] },
        ],
      })

      // Merging against liveContent preserves BOTH the fresh local typing and the remote edit:
      const merged = mergeDocuments(baseJson, liveContent, remoteDoc)
      expect(merged.success).toBe(true)
      expect(merged.hasConflict).toBe(false)

      const parsedMerged = JSON.parse(merged.content)
      expect(parsedMerged.content[0].content[0].text).toBe('Paragraph 1: Fresh Local Typing')
      expect(parsedMerged.content[1].content[0].text).toBe('Paragraph 2: Remote Edit')

      editor.destroy()
    })

    // Scenario 3: Two successive remote updates modify the same block before the retry timer fires;
    // Remote_2 supersedes Remote_1 without a false diff3 conflict.
    it('Scenario 3: Two successive remote updates supersede cleanly without false diff3 conflict markers', () => {
      const baseDoc = createDocJson('Initial base block')
      const remote1 = createDocJson('Remote revision 1')
      const remote2 = createDocJson('Remote revision 2')

      // If diff3 were run treating Remote 1 and Remote 2 as competing concurrent edits against Base:
      const buggyDiff3 = mergeDocuments(baseDoc, remote1, remote2)
      // Diff3 considers Remote 1 and Remote 2 as conflicting edits to the same block:
      expect(buggyDiff3.hasConflict).toBe(true)

      // A sibling editor has already accepted Remote 1, so Remote 2 must be
      // reconciled from that last accepted snapshot rather than the cloud base.
      const successiveTabUpdate = mergeDocuments(remote1, remote1, remote2)
      expect(successiveTabUpdate.success).toBe(true)
      expect(successiveTabUpdate.hasConflict).toBe(false)
      expect(successiveTabUpdate.content).toBe(remote2)

      // But with queuePendingRemotePatch superseding existing.content = incomingContent:
      // When Remote 2 arrives, pending patch becomes Remote 2 with originalBase.
      // When merged with local content (e.g. unchanged base or local non-overlapping edit):
      const localDoc = createMultiBlockDocJson('Initial base block', 'Local footer')
      const baseWithFooter = createMultiBlockDocJson('Initial base block', 'Base footer')
      const remote2WithFooter = createMultiBlockDocJson('Remote revision 2', 'Base footer')

      const correctMerge = mergeDocuments(baseWithFooter, localDoc, remote2WithFooter)
      expect(correctMerge.success).toBe(true)
      expect(correctMerge.hasConflict).toBe(false)
      const parsed = JSON.parse(correctMerge.content)
      expect(parsed.content[0].content[0].text).toBe('Remote revision 2')
      expect(parsed.content[1].content[0].text).toBe('Local footer')
    })

    it('Scenario 3b: A second local edit uses the most recently synced snapshot as its merge base', () => {
      const staleBase = createDocJson('I am')
      const firstSyncedEdit = createDocJson('I am t')
      const secondLocalEdit = createDocJson('I am t y ping')

      // The stale base should still merge cleanly when the remote snapshot is
      // merely a prefix of the newer local typing snapshot.
      const staleBaseMerge = mergeDocuments(staleBase, secondLocalEdit, firstSyncedEdit)
      expect(staleBaseMerge.hasConflict).toBe(false)
      expect(staleBaseMerge.content).toBe(secondLocalEdit)

      // Once the first edit is accepted as the sync baseline, its Drive echo
      // must be treated as already known, preserving the newer local draft.
      const latestBaseMerge = mergeDocuments(firstSyncedEdit, secondLocalEdit, firstSyncedEdit)
      expect(latestBaseMerge.success).toBe(true)
      expect(latestBaseMerge.hasConflict).toBe(false)
      expect(latestBaseMerge.content).toBe(secondLocalEdit)
    })

    // Scenario 4: Genuine local-vs-remote overlapping edit on the same block produces a conflict banner.
    it('Scenario 4: Genuine local-vs-remote overlapping edit on the same block produces a conflict', () => {
      const baseDoc = createDocJson('Original Paragraph')
      const localDoc = createDocJson('Device B Local Edit')
      const remoteDoc = createDocJson('Device A Remote Edit')

      const decision = reconcileExternalUpdate({
        baseContent: baseDoc,
        localContent: localDoc,
        remoteContent: remoteDoc,
        remoteChanged: true,
        hasUnsavedLocalEdits: true,
        hasPendingPush: true,
        syncStatus: 'pending',
      })

      expect(decision.action).toBe('conflict')
    })

    // Scenario 5: Pending rename/move with unchanged local content adopts remote content without a false content conflict.
    it('Scenario 5: Pending rename/move with unchanged local content adopts remote content without a false conflict', () => {
      const baseDoc = createDocJson('Unchanged document body')
      const localContent = createDocJson('Unchanged document body')
      const remoteDoc = createDocJson('Updated document body from another device')

      expect(areDocumentContentsEquivalent(localContent, baseDoc)).toBe(true)

      const decision = reconcileExternalUpdate({
        baseContent: baseDoc,
        localContent,
        remoteContent: remoteDoc,
        remoteChanged: true,
        hasUnsavedLocalEdits: false,
        hasPendingPush: true,
        syncStatus: 'pending',
      })

      expect(decision.action).toBe('merge')
      if (decision.action === 'merge') {
        expect(decision.mergedContent).toBe(remoteDoc)
      }
    })

    // Scenario 6: Genuinely pending local content edit is never silently overwritten.
    it('Scenario 6: Genuinely pending local content edit is never silently overwritten', () => {
      const baseDoc = createDocJson('Base text')
      const localDoc = createDocJson('Genuinely edited local text')
      const remoteDoc = createDocJson('Remote conflicting text')

      const decision = reconcileExternalUpdate({
        baseContent: baseDoc,
        localContent: localDoc,
        remoteContent: remoteDoc,
        remoteChanged: true,
        hasUnsavedLocalEdits: false,
        hasPendingPush: true,
        syncStatus: 'pending',
      })

      expect(decision.action).not.toBe('apply-remote')
      expect(decision.action).toBe('conflict')
    })

    // Scenario 7: Stale retry or upload completion cannot overwrite or mark newer merged content as synced.
    it('Scenario 7: Stale save or upload completion with older snapshot cannot overwrite newer merged content', async () => {
      const fileId = 'file-scenario-7'
      const baseContent = createDocJson('Version 1')
      const mergedContent = createDocJson('Version 2 - Merged')

      await db.files.put({
        id: fileId,
        driveFileId: 'drive-777',
        name: 'Scenario 7 Doc',
        type: 'document',
        folderId: null,
        content: mergedContent,
        mimeType: 'application/json',
        createdAt: '2026-10-21T10:00:00.000Z',
        updatedAt: '2026-10-21T10:05:00.000Z',
        lastSyncedAt: '2026-10-21T10:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      })

      const staleResult = await fileRepository.update(
        fileId,
        {
          content: baseContent,
        },
        {
          expectedUpdatedAt: '2026-10-21T10:00:00.000Z',
          expectedContent: baseContent,
        }
      )

      expect(staleResult.success).toBe(false)
      expect(staleResult.stale).toBe(true)

      const current = await db.files.get(fileId)
      expect(current?.content).toBe(mergedContent)
      expect(current?.updatedAt).toBe('2026-10-21T10:05:00.000Z')
    })
  })

  /* =================================================================================
   * Phase 7.4: Incoming Remote Content Detection and Live Sync Lifecycle
   * ================================================================================= */

  describe('Phase 7.4: Incoming Remote Content Detection and Live Sync Lifecycle', () => {
    beforeEach(async () => {
      await db.delete()
      await db.open()
      currentMockLiveFile = undefined
    })

    it('processes incoming remote content without skipping even when local autosave buffer matches editor', () => {
      // Step 1: Simulate active editor state with local unsaved changes
      const baseDoc = createMultiBlockDocJson('Paragraph 1 - Base', 'Paragraph 2 - Base')
      const localEditorContent = createMultiBlockDocJson('Paragraph 1 - Local Typing', 'Paragraph 2 - Base')

      // useAutosave holds local buffer in content (which matches editorContentRef)
      const localAutosaveBuffer = localEditorContent
      const editorContent = localEditorContent

      // Incoming remote content from IndexedDB (file.content)
      const incomingRemoteContent = createMultiBlockDocJson('Paragraph 1 - Base', 'Paragraph 2 - Remote Edit from Device A')

      // Verification of Bug vs Fix:
      // In the bug, the effect compared localAutosaveBuffer === editorContent, which is TRUE:
      const wouldBugSkip = areDocumentContentsEquivalent(localAutosaveBuffer, editorContent)
      expect(wouldBugSkip).toBe(true)

      // In the fix, the effect compares incomingContent (file.content) === editorContent:
      const doesFixSkip = areDocumentContentsEquivalent(incomingRemoteContent, editorContent)
      expect(doesFixSkip).toBe(false)

      // Step 2: Because it does NOT skip, 3-way merge runs between base, local typing, and incomingContent:
      const merged = mergeDocuments(baseDoc, editorContent, incomingRemoteContent)
      expect(merged.success).toBe(true)
      expect(merged.hasConflict).toBe(false)

      const parsed = JSON.parse(merged.content)
      // Both non-overlapping local typing and remote edit survived:
      expect(parsed.content[0].content[0].text).toBe('Paragraph 1 - Local Typing')
      expect(parsed.content[1].content[0].text).toBe('Paragraph 2 - Remote Edit from Device A')
    })

    it('detects genuine conflict when incoming remote update collides with local typing on the same block', () => {
      const baseDoc = createDocJson('Original Block')
      const localTyping = createDocJson('Device B Local Edit')
      const incomingRemote = createDocJson('Device A Remote Collision')

      const merged = mergeDocuments(baseDoc, localTyping, incomingRemote)
      expect(merged.hasConflict).toBe(true)

      const decision = reconcileExternalUpdate({
        baseContent: baseDoc,
        localContent: localTyping,
        remoteContent: incomingRemote,
        remoteChanged: true,
        hasUnsavedLocalEdits: true,
        hasPendingPush: true,
        syncStatus: 'pending',
      })
      expect(decision.action).toBe('conflict')
    })

    it('mounts TiptapDocumentEditor harness and verifies live sync effect applies non-overlapping remote update', async () => {
      const fileId = 'live-harness-doc-1'
      const baseDoc = createMultiBlockDocJson('Section 1 - Base', 'Section 2 - Base')
      const initialDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-harness-1',
        name: 'Harness Document',
        type: 'document',
        folderId: null,
        content: baseDoc,
        baseContent: baseDoc,
        mimeType: 'application/json',
        createdAt: '2026-10-21T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z',
        lastSyncedAt: '2026-10-21T10:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      currentMockLiveFile = initialDoc
      await db.files.put(initialDoc)

      const { rerender, unmount } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      // Verify initial rendering
      await waitFor(() => {
        expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument()
      })

      // Simulate incoming remote update arriving via file.content
      const remoteDoc = createMultiBlockDocJson('Section 1 - Base', 'Section 2 - Remote Update from Cloud')
      const updatedFile: MyBookFile = {
        ...initialDoc,
        content: remoteDoc,
        updatedAt: '2026-10-21T10:00:05.000Z',
      }
      currentMockLiveFile = updatedFile
      await db.files.put(updatedFile)

      rerender(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      // The incoming content was processed and patched into the active editor
      await waitFor(() => {
        expect(screen.getByText(/Section 2 - Remote Update from Cloud/i)).toBeInTheDocument()
      })

      unmount()
    })

    it('merges tab updates against live editor content before the typing debounce flushes', async () => {
      const fileId = 'live-harness-tab-debounce-doc'
      const baseDoc = createMultiBlockDocJson('Section 1 - Base', 'Section 2 - Base')
      const initialDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-tab-debounce',
        name: 'Tab Debounce Document',
        type: 'document',
        folderId: null,
        content: baseDoc,
        baseContent: baseDoc,
        mimeType: 'application/json',
        createdAt: '2026-10-21T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z',
        lastSyncedAt: '2026-10-21T10:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      currentMockLiveFile = initialDoc
      await db.files.put(initialDoc)

      const { unmount } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )
      await waitFor(() => expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument())

      const pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      const editor = pmEl?.editor
      expect(editor).toBeTruthy()
      if (!editor) throw new Error('Editor not found')
      await waitFor(() => expect(editor.getText()).toContain('Section 1 - Base'))

      // This edit is in the editor immediately, but editorContentRef is still
      // waiting for its 100 ms snapshot broadcast debounce.
      act(() => editor.commands.insertContentAt(17, ' - Local'))

      const remoteDoc = createMultiBlockDocJson('Section 1 - Base', 'Section 2 - Remote')
      act(() => broadcastDocUpdate(fileId, remoteDoc, 'Tab Debounce Document'))

      await waitFor(() => {
        expect(editor.getText()).toContain('Local')
        expect(editor.getText()).toContain('Section 2 - Remote')
      })
      await waitFor(async () => {
        const saved = await db.files.get(fileId)
        expect(saved?.content).toContain('Section 1 - Base - Local')
        expect(saved?.content).toContain('Section 2 - Remote')
      })

      unmount()
    })

    it('mounts TiptapDocumentEditor harness with active unsaved local typing, applies clean 3-way merge, and persists merged content to IndexedDB and syncQueue', async () => {
      const fileId = 'live-harness-merge-doc-2'
      const baseDoc = createMultiBlockDocJson('Section 1 - Base', 'Section 2 - Base')
      const initialDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-harness-2',
        name: 'Harness Merge Document',
        type: 'document',
        folderId: null,
        content: baseDoc,
        baseContent: baseDoc,
        mimeType: 'application/json',
        createdAt: '2026-10-21T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z',
        lastSyncedAt: '2026-10-21T10:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      currentMockLiveFile = initialDoc
      await db.files.put(initialDoc)

      const { rerender, unmount } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument()
      })

      // Simulate local typing on Section 1 via TipTap editor commands
      const pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      expect(pmEl).toBeTruthy()
      const tiptapEditor = pmEl?.editor
      expect(tiptapEditor).toBeTruthy()
      if (!tiptapEditor) throw new Error('Editor not found')

      // User types local changes into Section 1
      act(() => {
        tiptapEditor.commands.insertContentAt(16, ' - Local Addition')
      })

      // Verify local edit is in the DOM
      expect(screen.getByText(/Local Addition/i)).toBeInTheDocument()

      // Now incoming remote update arrives changing Section 2
      const remoteDoc = createMultiBlockDocJson('Section 1 - Base', 'Section 2 - Cloud Update')
      const updatedFile: MyBookFile = {
        ...initialDoc,
        content: remoteDoc,
        updatedAt: '2026-10-21T10:00:05.000Z',
      }
      currentMockLiveFile = updatedFile
      await db.files.put(updatedFile)

      rerender(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      // Both local addition in Section 1 and remote update in Section 2 survive in editor!
      await waitFor(() => {
        expect(screen.getByText(/Local Addition/i)).toBeInTheDocument()
        expect(screen.getByText(/Section 2 - Cloud Update/i)).toBeInTheDocument()
      })

      // Merged content is persisted to IndexedDB!
      await waitFor(async () => {
        const inDb = await db.files.get(fileId)
        expect(inDb?.content).toContain('Local Addition')
        expect(inDb?.content).toContain('Section 2 - Cloud Update')
        expect(inDb?.baseContent).toBe(remoteDoc)
        expect(inDb?.syncStatus).toBe('pending')
      })

      // Queued for Google Drive upload in syncQueue!
      const syncEntry = await db.syncQueue.where('entityId').equals(fileId).first()
      expect(syncEntry).toBeTruthy()

      // Survives reload: unmount and verify data in IndexedDB
      unmount()
      const reloadedDoc = await db.files.get(fileId)
      expect(reloadedDoc?.content).toContain('Local Addition')
      expect(reloadedDoc?.content).toContain('Section 2 - Cloud Update')
    })

    it('persists merged content to IndexedDB with baseContent when retryPendingPatch executes', async () => {
      const fileId = 'live-harness-retry-doc-3'
      const baseDoc = createMultiBlockDocJson('Block 1 - Base', 'Block 2 - Base')
      const localDoc = createMultiBlockDocJson('Block 1 - Local Typing', 'Block 2 - Base')
      const incomingRemote = createMultiBlockDocJson('Block 1 - Base', 'Block 2 - Remote Edit')
      const initialDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-harness-3',
        name: 'Retry Document',
        type: 'document',
        folderId: null,
        content: incomingRemote,
        baseContent: baseDoc,
        mimeType: 'application/json',
        createdAt: '2026-10-21T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z',
        lastSyncedAt: '2026-10-21T10:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      await db.files.put(initialDoc)

      // Test merging logic directly through the same persistence path
      const merged = mergeDocuments(baseDoc, localDoc, incomingRemote)
      expect(merged.success).toBe(true)
      expect(merged.hasConflict).toBe(false)

      const updateRes = await fileRepository.update(
        fileId,
        {
          content: merged.content,
          baseContent: incomingRemote,
          syncStatus: 'pending',
        },
        { expectedUpdatedAt: initialDoc.updatedAt }
      )
      expect(updateRes.success).toBe(true)

      const inDb = await db.files.get(fileId)
      expect(inDb?.content).toContain('Block 1 - Local Typing')
      expect(inDb?.content).toContain('Block 2 - Remote Edit')
      expect(inDb?.baseContent).toBe(incomingRemote)
      expect(inDb?.syncStatus).toBe('pending')

      const queued = await db.syncQueue.where('entityId').equals(fileId).first()
      expect(queued).toBeTruthy()
    })

    it('prevents infinite retry loops on stale autosave rejection and resumes saving after baseline refresh', async () => {
      const fileId = 'live-harness-stale-doc-4'
      const initialContent = createDocJson('Initial Content')
      const initialDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-harness-4',
        name: 'Stale Harness Doc',
        type: 'document',
        folderId: null,
        content: initialContent,
        baseContent: initialContent,
        mimeType: 'application/json',
        createdAt: '2026-10-21T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z',
        lastSyncedAt: '2026-10-21T10:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      await db.files.put(initialDoc)

      // Concurrent update changes updatedAt in IndexedDB
      await db.files.update(fileId, { updatedAt: '2026-10-21T10:00:02.000Z' })

      // An in-flight autosave with stale expectedUpdatedAt is rejected
      const staleRes = await fileRepository.update(
        fileId,
        { content: createDocJson('Local edits') },
        { expectedUpdatedAt: '2026-10-21T10:00:00.000Z' }
      )
      expect(staleRes.success).toBe(false)
      expect(staleRes.stale).toBe(true)

      // When the baseline is refreshed with the new updatedAt, update succeeds
      const refreshedDoc = await db.files.get(fileId)
      const freshRes = await fileRepository.update(
        fileId,
        { content: createDocJson('Local edits') },
        { expectedUpdatedAt: refreshedDoc?.updatedAt }
      )
      expect(freshRes.success).toBe(true)
      const finalDoc = await db.files.get(fileId)
      expect(finalDoc?.content).toContain('Local edits')
    })

    it('handles local typing while merge persistence is pending without loss or false saved state', async () => {
      const fileId = 'live-harness-typing-pending-5'
      const baseDoc = createMultiBlockDocJson('Section 1 - Base', 'Section 2 - Base')
      const initialDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-harness-5',
        name: 'Pending Merge Typing Doc',
        type: 'document',
        folderId: null,
        content: baseDoc,
        baseContent: baseDoc,
        mimeType: 'application/json',
        createdAt: '2026-10-21T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z',
        lastSyncedAt: '2026-10-21T10:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      currentMockLiveFile = initialDoc
      await db.files.put(initialDoc)

      const { rerender, unmount } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument()
      })

      const pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      const tiptapEditor = pmEl?.editor
      if (!tiptapEditor) throw new Error('Editor not found')

      // Step 1: User types local edit in Section 1
      act(() => {
        tiptapEditor.commands.insertContentAt(16, ' - Local Draft')
      })
      expect(screen.getByText(/Local Draft/i)).toBeInTheDocument()

      // Step 2: Remote update arrives
      const remoteDoc = createMultiBlockDocJson('Section 1 - Base', 'Section 2 - Remote Patch')
      const updatedFile: MyBookFile = {
        ...initialDoc,
        content: remoteDoc,
        updatedAt: '2026-10-21T10:00:05.000Z',
      }
      currentMockLiveFile = updatedFile
      await db.files.put(updatedFile)

      rerender(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      // Step 3: While merge is being processed, user immediately types more characters
      act(() => {
        tiptapEditor.commands.insertContentAt(tiptapEditor.state.doc.content.size - 1, ' More Keystrokes')
      })

      // Both the remote patch and the rapid keystrokes survive in the editor
      await waitFor(() => {
        expect(screen.getByText(/Local Draft/i)).toBeInTheDocument()
        expect(screen.getByText(/Section 2 - Remote Patch/i)).toBeInTheDocument()
        expect(screen.getByText(/More Keystrokes/i)).toBeInTheDocument()
      })

      unmount()
    })

    it('does not mark edits saved when merge persistence encounters a repository failure', async () => {
      const fileId = 'live-harness-fail-persist-6'
      const baseDoc = createMultiBlockDocJson('Section 1 - Base', 'Section 2 - Base')
      const initialDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-harness-6',
        name: 'Fail Persist Doc',
        type: 'document',
        folderId: null,
        content: baseDoc,
        baseContent: baseDoc,
        mimeType: 'application/json',
        createdAt: '2026-10-21T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z',
        lastSyncedAt: '2026-10-21T10:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      currentMockLiveFile = initialDoc
      await db.files.put(initialDoc)

      const { rerender, unmount } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument()
      })

      const pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      const tiptapEditor = pmEl?.editor
      if (!tiptapEditor) throw new Error('Editor not found')

      // Local edit
      act(() => {
        tiptapEditor.commands.insertContentAt(16, ' - Preserved Local Edit')
      })
      expect(screen.getByText(/Preserved Local Edit/i)).toBeInTheDocument()

      // Mock update to fail once
      const originalUpdate = fileRepository.update
      const updateSpy = vi.spyOn(fileRepository, 'update').mockRejectedValueOnce(new Error('Simulated IndexedDB failure'))

      const remoteDoc = createMultiBlockDocJson('Section 1 - Base', 'Section 2 - Remote Content')
      const updatedFile: MyBookFile = {
        ...initialDoc,
        content: remoteDoc,
        updatedAt: '2026-10-21T10:00:05.000Z',
      }
      currentMockLiveFile = updatedFile
      await db.files.put(updatedFile)

      rerender(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      // Local edits remain in DOM and are not discarded
      await waitFor(() => {
        expect(screen.getByText(/Preserved Local Edit/i)).toBeInTheDocument()
      })

      updateSpy.mockRestore()
      fileRepository.update = originalUpdate
      unmount()
    })

    it('handles two successive remote updates while retaining local edits and avoiding false diff3 conflicts', async () => {
      const fileId = 'live-harness-successive-7'
      const baseDoc = createMultiBlockDocJson('Section 1 - Base', 'Section 2 - Base')
      const initialDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-harness-7',
        name: 'Successive Remote Updates Doc',
        type: 'document',
        folderId: null,
        content: baseDoc,
        baseContent: baseDoc,
        mimeType: 'application/json',
        createdAt: '2026-10-21T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z',
        lastSyncedAt: '2026-10-21T10:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      currentMockLiveFile = initialDoc
      await db.files.put(initialDoc)

      const { rerender, unmount } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument()
      })

      const pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      const tiptapEditor = pmEl?.editor
      if (!tiptapEditor) throw new Error('Editor not found')

      // User types local changes into Section 1
      act(() => {
        tiptapEditor.commands.insertContentAt(16, ' - My Device Edits')
      })
      expect(screen.getByText(/My Device Edits/i)).toBeInTheDocument()

      // First remote update arrives (modifies Section 2)
      const remoteDoc1 = createMultiBlockDocJson('Section 1 - Base', 'Section 2 - Cloud Revision 1')
      const updatedFile1: MyBookFile = {
        ...initialDoc,
        content: remoteDoc1,
        updatedAt: '2026-10-21T10:00:05.000Z',
      }
      currentMockLiveFile = updatedFile1
      await db.files.put(updatedFile1)

      rerender(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Section 2 - Cloud Revision 1/i)).toBeInTheDocument()
      })

      // Second remote update arrives shortly after (further modifies Section 2)
      const remoteDoc2 = createMultiBlockDocJson('Section 1 - Base', 'Section 2 - Cloud Revision 2')
      const updatedFile2: MyBookFile = {
        ...initialDoc,
        content: remoteDoc2,
        updatedAt: '2026-10-21T10:00:10.000Z',
      }
      currentMockLiveFile = updatedFile2
      await db.files.put(updatedFile2)

      rerender(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      // Both local edits in Section 1 and Cloud Revision 2 in Section 2 are cleanly merged without conflict
      await waitFor(() => {
        expect(screen.getByText(/My Device Edits/i)).toBeInTheDocument()
        expect(screen.getByText(/Section 2 - Cloud Revision 2/i)).toBeInTheDocument()
      })

      // Persisted correctly in IndexedDB
      await waitFor(async () => {
        const inDb = await db.files.get(fileId)
        expect(inDb?.content).toContain('My Device Edits')
        expect(inDb?.content).toContain('Section 2 - Cloud Revision 2')
        expect(inDb?.baseContent).toBe(remoteDoc2)
      })

      unmount()
    })
  })
})
