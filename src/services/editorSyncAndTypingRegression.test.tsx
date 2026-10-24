// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { Editor } from '@tiptap/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { db } from '../database/db'
import { TiptapDocumentEditor } from '../components/document-editor/TiptapDocumentEditor'
import { mergeDocuments } from '../utils/documentMerge'
import { createConflictedCopyFile } from './syncConflicts'
import { broadcastDocUpdate } from './tabSyncChannel'
import type { MyBookFile } from '../types/files'
import * as workspaceStore from '../stores/useWorkspaceStore'
import { useAuthStore } from '../stores/useAuthStore'

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
    refreshDriveFileToLocal: vi.fn().mockResolvedValue({ updated: false }),
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

describe('Editor Syncing and Conflict Resolution Regression Suite', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(workspaceStore.isLocalWorkspace).mockReturnValue(false)
    useAuthStore.setState({ isAuthenticated: true, email: 'user@example.com' })
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
    if (typeof Range !== 'undefined' && !Range.prototype.getClientRects) {
      Range.prototype.getClientRects = () => [] as unknown as DOMRectList
      Range.prototype.getBoundingClientRect = () => ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      })
    }
    window.scrollTo = vi.fn()
    await db.files.clear()
    await db.fileVersions.clear()
    await db.syncQueue.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Typing Performance & Character Stability', () => {
    it('does not duplicate characters or spaces when merging typing progressions', () => {
      const base = createDocJson('Hello')
      const local = createDocJson('Hello world')
      const remoteEarlier = createDocJson('Hello wor')

      const result = mergeDocuments(base, local, remoteEarlier)
      expect(result.hasConflict).toBe(false)
      const parsed = JSON.parse(result.content)
      expect(parsed.content[0].content[0].text).toBe('Hello world')
    })

    it('does not duplicate characters when an incremental edit occurs on an initially empty base', () => {
      const base = createDocJson('')
      const local = createDocJson('typing in progress')
      const remoteEarlier = createDocJson('typing in')

      const result = mergeDocuments(base, local, remoteEarlier)
      expect(result.hasConflict).toBe(false)
      const parsed = JSON.parse(result.content)
      expect(parsed.content[0].content[0].text).toBe('typing in progress')
    })

    it('preserves continuous typing without false conflict banners or active caret collision', async () => {
      const fileId = 'continuous-typing-test'
      const initialDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-1',
        name: 'Typing Test',
        type: 'document',
        folderId: null,
        content: createDocJson('Starting text'),
        baseContent: createDocJson('Starting text'),
        mimeType: 'application/json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
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

      await waitFor(() => {
        expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument()
      })

      const pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      const editor = pmEl?.editor
      expect(editor).toBeTruthy()
      if (!editor) throw new Error('Editor not found')

      // Simulate rapid continuous typing
      act(() => {
        editor.commands.focus()
        editor.commands.insertContent(' and continuous words without pause')
      })

      expect(editor.getText()).toContain('Starting text and continuous words without pause')

      // Simulate autosave completing in IndexedDB and Dexie emitting updated file
      const updatedSaved: MyBookFile = {
        ...initialDoc,
        content: createDocJson('Starting text and continuous words without pause'),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      }
      currentMockLiveFile = updatedSaved
      await db.files.put(updatedSaved)

      // User keeps typing right after save finishes
      act(() => {
        editor.commands.insertContent(' - extra sentence.')
      })

      // Wait a moment for any debounced hooks
      await new Promise((r) => setTimeout(r, 200))

      // Conflict banner must NEVER appear during single-user typing
      expect(screen.queryByText(/conflict/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Remote changes conflict/i)).not.toBeInTheDocument()
      expect(editor.getText()).toBe('Starting text and continuous words without pause - extra sentence.')

      unmount()
    })
  })

  describe('Cross-Tab Split-Screen Smoothness', () => {
    it('applies clean non-overlapping updates across tabs without caret reset or character doubling', async () => {
      const fileId = 'split-screen-sync-test'
      const baseContent = createMultiBlockDocJson('Section 1 - Tab 1 Area', 'Section 2 - Tab 2 Area')
      const fileDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-split',
        name: 'Split Screen Document',
        type: 'document',
        folderId: null,
        content: baseContent,
        baseContent: baseContent,
        mimeType: 'application/json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      currentMockLiveFile = fileDoc
      await db.files.put(fileDoc)

      const { unmount } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument()
      })

      const pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      const editor = pmEl?.editor
      expect(editor).toBeTruthy()
      if (!editor) throw new Error('Editor not found')

      // Local Tab edits Section 1
      act(() => {
        editor.commands.insertContentAt(23, ' [Edited Locally]')
      })

      expect(editor.getText()).toContain('Section 1 - Tab 1 Area [Edited Locally]')

      // Incoming broadcast arrives from Tab 2 modifying Section 2
      const remoteTabDoc = createMultiBlockDocJson('Section 1 - Tab 1 Area', 'Section 2 - Tab 2 Area [Edited in Tab 2]')
      act(() => {
        broadcastDocUpdate(fileId, remoteTabDoc, 'Split Screen Document')
      })

      // Both edits survive cleanly without duplicating text or crashing
      await waitFor(() => {
        expect(editor.getText()).toContain('Section 1 - Tab 1 Area [Edited Locally]')
        expect(editor.getText()).toContain('Section 2 - Tab 2 Area [Edited in Tab 2]')
      })

      expect(screen.queryByText(/conflict/i)).not.toBeInTheDocument()
      unmount()
    })
  })

  describe('Google Drive Vault Conflict Handling (Option A - Obsidian Pattern)', () => {
    it('creates companion conflicted copy file and preserves active typing without interruption', async () => {
      const fileId = 'vault-conflict-test'
      const baseContent = createDocJson('Original baseline note content')
      const localEdits = createDocJson('Original baseline note content with important local edits')
      const fileDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-vault-1',
        name: 'My Project Plan',
        type: 'document',
        folderId: null,
        content: localEdits,
        baseContent,
        mimeType: 'application/json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSyncedAt: '2026-10-03T10:00:00.000Z',
        syncStatus: 'pending',
        isDeleted: false,
      }
      currentMockLiveFile = fileDoc
      await db.files.put(fileDoc)

      const { unmount } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument()
      })

      const pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      const editor = pmEl?.editor
      expect(editor).toBeTruthy()
      if (!editor) throw new Error('Editor not found')

      // User continues typing in the active editor
      act(() => {
        editor.commands.focus()
        editor.commands.insertContent(' [more live work]')
      })

      // In the background, Google Drive detects a conflicting remote edit and triggers Option A
      const remoteDriveContent = createDocJson('Conflicting text edited concurrently on another device')
      const remoteModifiedTime = '2026-10-03T12:00:00.000Z'
      const conflictedCopy = await createConflictedCopyFile(fileId, remoteDriveContent, remoteModifiedTime)

      expect(conflictedCopy).not.toBeNull()
      expect(conflictedCopy?.name).toBe('My Project Plan (Conflicted copy 2026-10-03)')
      expect(conflictedCopy?.content).toBe(remoteDriveContent)

      // Active editor is NOT overwritten and continues to contain local work
      expect(editor.getText()).toContain('Original baseline note content with important local edits [more live work]')

      // Conflicted copy exists independently in database
      const savedCopy = await db.files.get(conflictedCopy!.id)
      expect(savedCopy).toBeDefined()
      expect(savedCopy?.content).toBe(remoteDriveContent)

      unmount()
    })
  })
})
