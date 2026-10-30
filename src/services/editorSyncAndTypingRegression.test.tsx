// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { Editor } from '@tiptap/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, act, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { db } from '../database/db'
import { fileRepository } from '../database/repositories'
import { TiptapDocumentEditor } from '../components/document-editor/TiptapDocumentEditor'
import { mergeDocuments } from '../utils/documentMerge'
import { createConflictedCopyFile } from './syncConflicts'
import { broadcastDocUpdate } from './tabSyncChannel'
import type { MyBookFile } from '../types/files'
import * as workspaceStore from '../stores/useWorkspaceStore'
import { useAuthStore } from '../stores/useAuthStore'

let currentMockLiveFile: MyBookFile | undefined
const mockLiveFilesById = new Map<string, MyBookFile>()

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (_fn: () => unknown, deps?: unknown[], defaultVal?: unknown) => {
    if (deps && deps.length === 1) {
      const depKey = deps[0]
      if (typeof depKey === 'string' && mockLiveFilesById.has(depKey)) {
        return mockLiveFilesById.get(depKey)
      }
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
    mockLiveFilesById.clear()
    await db.files.clear()
    await db.fileVersions.clear()
    await db.syncQueue.clear()
  })

  afterEach(async () => {
    cleanup()
    mockLiveFilesById.clear()
    vi.restoreAllMocks()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
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

      await waitFor(() => expect(editor.getText()).toBe('Starting text'))

      const initialDocument = editor.state.doc.toJSON()
      const transactionSpy = vi.fn()
      editor.on('transaction', transactionSpy)
      expect(pmEl).toHaveAttribute('spellcheck', 'true')
      expect(pmEl).toHaveAttribute('autocorrect', 'off')
      expect(pmEl).toHaveAttribute('autocapitalize', 'sentences')
      expect(pmEl).toHaveAttribute('aria-label', 'Document content')
      expect(pmEl).toHaveClass('tiptap', 'min-h-[65vh]', 'outline-none')
      expect(pmEl?.querySelector('[spellcheck="false"]')).toBeNull()
      expect(editor.state.doc.toJSON()).toEqual(initialDocument)
      expect(transactionSpy).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Writing Assistant' }))
      expect(await screen.findByRole('heading', { name: 'Writing Assistant' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('tab', { name: 'Actions' }))
      expect(screen.getByRole('heading', { name: 'Proofread' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('tab', { name: 'Overview' }))
      vi.mocked(workspaceStore.shouldSyncWithDrive).mockReturnValue(false)
      fireEvent.change(screen.getByRole('combobox', { name: 'Document writing language' }), { target: { value: 'en-IN' } })
      await waitFor(async () => expect((await db.files.get(fileId))?.writingLanguage).toBe('en-IN'))
      expect((await db.files.get(fileId))?.updatedAt).toBe(initialDoc.updatedAt)
      expect(editor.state.doc.toJSON()).toEqual(initialDocument)
      expect(transactionSpy).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(editor.getText()).toBe('Starting text')
      expect(editor.state.doc.toJSON()).toEqual(initialDocument)
      expect((document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null)?.editor).toBe(editor)
      expect(transactionSpy).not.toHaveBeenCalled()
      editor.off('transaction', transactionSpy)

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

    it('updates live immediately in a focused-but-idle editor when sibling tab types', async () => {
      const fileId = 'split-idle-focus-sync-test'
      const baseContent = createDocJson('Paragraph 1')
      const fileDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-split-idle',
        name: 'Idle Focus Document',
        type: 'document',
        folderId: null,
        content: baseContent,
        baseContent,
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

      // Editor is focused (e.g. user clicked inside), but idle (no typing in progress)
      act(() => {
        Object.defineProperty(editor, 'isFocused', { value: true, configurable: true })
      })
      expect(editor.isFocused).toBe(true)

      // Incoming broadcast arrives from Tab 2 typing in this document
      const remoteTabDoc = createDocJson('Paragraph 1 - typed from Pane B')
      act(() => {
        broadcastDocUpdate(fileId, remoteTabDoc, 'Idle Focus Document', 'other-tab-instance')
      })

      // The focused editor MUST reflect Pane B's update live without navigating away or reopening
      await waitFor(() => {
        expect(editor.getText()).toBe('Paragraph 1 - typed from Pane B')
      })

      expect(screen.queryByText(/conflict/i)).not.toBeInTheDocument()
      unmount()
    })

    it('defers remote patch during active typing burst and applies cleanly after typing pause', async () => {
      const fileId = 'split-active-typing-defer-test'
      const baseContent = createMultiBlockDocJson('Section 1 - Area', 'Section 2 - Area')
      const fileDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-split-defer',
        name: 'Defer Test Document',
        type: 'document',
        folderId: null,
        content: baseContent,
        baseContent,
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

      // User in this tab is actively typing in Section 1
      act(() => {
        Object.defineProperty(editor, 'isFocused', { value: true, configurable: true })
        editor.commands.insertContentAt(17, ' [typing active]')
      })

      // In the middle of typing, a remote broadcast from Tab 2 arrives for Section 2
      const remoteTabDoc = createMultiBlockDocJson('Section 1 - Area', 'Section 2 - Area [remote Tab 2]')
      act(() => {
        broadcastDocUpdate(fileId, remoteTabDoc, 'Defer Test Document', 'other-tab-instance')
      })

      // The active editor must NOT lose local keystrokes immediately
      expect(editor.getText()).toContain('[typing active]')

      // Both local and remote updates merge cleanly without conflicts
      await waitFor(() => {
        expect(editor.getText()).toContain('Section 1 - Area [typing active]')
        expect(editor.getText()).toContain('Section 2 - Area [remote Tab 2]')
      })

      expect(screen.queryByText(/conflict/i)).not.toBeInTheDocument()
      unmount()
    })
  })

  describe('Google Drive Vault Conflict Handling (Conflicted Copy Pattern)', () => {
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

  describe('Editor Hydration and Empty-Content Persistence Race', () => {
    /**
     * Regression: Editor initialises with an internal empty paragraph. Extension
     * or ProseMirror plugin transactions that fire before the document is loaded
     * must not cause the empty state to be persisted over the real content.
     */
    it('does not overwrite IndexedDB with empty paragraph when extensions fire transactions before hydration', async () => {
      const fileId = 'hydration-race-test'
      const initialContent = createDocJson('Starting text')
      const fileDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-hydration',
        name: 'Hydration Doc',
        type: 'document',
        folderId: null,
        content: initialContent,
        baseContent: initialContent,
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

      // Wait for the editor to fully hydrate with real content
      const pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      const editor = pmEl?.editor
      if (editor) {
        await waitFor(() => expect(editor.getText()).toBe('Starting text'), { timeout: 3000 })
      }

      // Wait longer than both the contentSyncTimer (100 ms) and the autosave
      // debounce (250 ms) to give any misfired empty-content save the time to land.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 500))
      })

      // IndexedDB must still contain the original content — not an empty paragraph
      const saved = await db.files.get(fileId)
      expect(saved).toBeDefined()
      const savedDoc = JSON.parse(saved!.content)
      // The saved content must contain the original text — never an empty paragraph
      const text = savedDoc?.content?.[0]?.content?.[0]?.text ?? ''
      expect(text).toBe('Starting text')

      unmount()
    })

    it('opens an existing document and displays its content correctly', async () => {
      const fileId = 'open-existing-content-test'
      const initialContent = createDocJson('My existing document text')
      const fileDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-existing',
        name: 'Existing Doc',
        type: 'document',
        folderId: null,
        content: initialContent,
        baseContent: initialContent,
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

      await waitFor(() => expect(editor.getText()).toBe('My existing document text'))

      // DB content must be untouched
      const saved = await db.files.get(fileId)
      expect(JSON.parse(saved!.content)).toEqual(JSON.parse(initialContent))

      unmount()
    })

    it('saves a legitimate user edit made immediately after the document opens', async () => {
      const fileId = 'immediate-edit-after-open-test'
      const initialContent = createDocJson('Initial content')
      const fileDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-immediate',
        name: 'Immediate Edit Doc',
        type: 'document',
        folderId: null,
        content: initialContent,
        baseContent: initialContent,
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

      // Wait for hydration to complete
      await waitFor(() => expect(editor.getText()).toBe('Initial content'))

      // Simulate user typing immediately after the document opens
      act(() => {
        editor.commands.focus()
        editor.commands.insertContent(' – added right away')
      })

      // Wait for contentSyncTimer (100 ms) + autosave debounce (250 ms) + persistence
      await waitFor(async () => {
        const saved = await db.files.get(fileId)
        const savedText = JSON.parse(saved?.content ?? '{}')?.content?.[0]?.content?.[0]?.text ?? ''
        expect(savedText).toContain('Initial content – added right away')
      }, { timeout: 3000 })

      unmount()
    })

    it('preserves an intentionally empty document as valid', async () => {
      const fileId = 'intentional-empty-doc-test'
      const emptyDocJson = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
      const fileDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-empty',
        name: 'Empty Doc',
        type: 'document',
        folderId: null,
        content: emptyDocJson,
        baseContent: emptyDocJson,
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

      // Wait for any post-mount timers
      await act(async () => {
        await new Promise((r) => setTimeout(r, 500))
      })

      // The empty document must not cause any spurious re-writes
      const saved = await db.files.get(fileId)
      expect(saved).toBeDefined()
      // The empty structure should remain intact (no unexpected content added)
      const savedDoc = JSON.parse(saved!.content)
      expect(savedDoc.type).toBe('doc')
      expect(savedDoc.content).toHaveLength(1)
      expect(savedDoc.content[0].type).toBe('paragraph')

      unmount()
    })

    it('does not persist stale empty-editor content when switching documents rapidly', async () => {
      const fileIdA = 'switch-doc-a'
      const fileIdB = 'switch-doc-b'
      const contentA = createDocJson('Document A content')
      const contentB = createDocJson('Document B content')

      const docA: MyBookFile = {
        id: fileIdA,
        driveFileId: 'drive-a',
        name: 'Doc A',
        type: 'document',
        folderId: null,
        content: contentA,
        baseContent: contentA,
        mimeType: 'application/json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      const docB: MyBookFile = {
        id: fileIdB,
        driveFileId: 'drive-b',
        name: 'Doc B',
        type: 'document',
        folderId: null,
        content: contentB,
        baseContent: contentB,
        mimeType: 'application/json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'backed-up',
        isDeleted: false,
      }

      await db.files.put(docA)
      await db.files.put(docB)

      // Open Doc A
      currentMockLiveFile = docA
      const { unmount: unmountA } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileIdA} />
        </MemoryRouter>
      )
      await waitFor(() => expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument())
      unmountA()

      cleanup()

      // Open Doc B immediately after
      currentMockLiveFile = docB
      const { unmount: unmountB } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileIdB} />
        </MemoryRouter>
      )
      await waitFor(() => expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument())

      const pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      const editor = pmEl?.editor
      if (editor) {
        await waitFor(() => expect(editor.getText()).toBe('Document B content'))
      }

      await act(async () => {
        await new Promise((r) => setTimeout(r, 500))
      })

      // Doc A must not have been overwritten with empty content
      const savedA = await db.files.get(fileIdA)
      if (savedA) {
        const docAText = JSON.parse(savedA.content)?.content?.[0]?.content?.[0]?.text ?? ''
        expect(docAText).toBe('Document A content')
      }

      // Doc B must have correct content
      const savedB = await db.files.get(fileIdB)
      expect(savedB).toBeDefined()
      const docBText = JSON.parse(savedB!.content)?.content?.[0]?.content?.[0]?.text ?? ''
      expect(docBText).toBe('Document B content')

      unmountB()
    })

    it('persists pending edits when editor is closed/unmounted during pending debounce', async () => {
      const fileId = 'close-pending-debounce-test'
      const initialContent = createDocJson('Original doc text')
      const fileDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-close-debounce',
        name: 'Close Debounce Doc',
        type: 'document',
        folderId: null,
        content: initialContent,
        baseContent: initialContent,
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

      await waitFor(() => expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument())
      const pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      const editor = pmEl?.editor
      expect(editor).toBeTruthy()
      await waitFor(() => expect(editor!.getText()).toBe('Original doc text'))

      // Type an edit
      act(() => {
        editor!.commands.focus()
        editor!.commands.insertContent(' with quick addition')
      })

      // Unmount immediately without waiting for the 250ms debounce
      unmount()

      // The unmount flush in useAutosave / TiptapDocumentEditor must have saved the edit
      await waitFor(async () => {
        const saved = await db.files.get(fileId)
        const savedText = JSON.parse(saved?.content ?? '{}')?.content?.[0]?.content?.[0]?.text ?? ''
        expect(savedText).toBe('Original doc text with quick addition')
      }, { timeout: 3000 })
    })

    it('prevents stale callbacks from an old unmounted editor from writing into a new document', async () => {
      const fileIdA = 'stale-cb-doc-a'
      const fileIdB = 'stale-cb-doc-b'
      const contentA = createDocJson('Doc A original')
      const contentB = createDocJson('Doc B original')

      const docA: MyBookFile = {
        id: fileIdA,
        driveFileId: 'drive-stale-a',
        name: 'Doc A',
        type: 'document',
        folderId: null,
        content: contentA,
        baseContent: contentA,
        mimeType: 'application/json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      const docB: MyBookFile = {
        id: fileIdB,
        driveFileId: 'drive-stale-b',
        name: 'Doc B',
        type: 'document',
        folderId: null,
        content: contentB,
        baseContent: contentB,
        mimeType: 'application/json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'backed-up',
        isDeleted: false,
      }

      await db.files.put(docA)
      await db.files.put(docB)

      currentMockLiveFile = docA
      const { unmount: unmountA } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileIdA} />
        </MemoryRouter>
      )

      await waitFor(() => expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument())
      const pmElA = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      const editorA = pmElA?.editor
      await waitFor(() => expect(editorA?.getText()).toBe('Doc A original'))

      // Type into A
      act(() => {
        editorA?.commands.insertContent(' edit in A')
      })

      // Unmount A and mount B immediately
      unmountA()
      currentMockLiveFile = docB

      const { unmount: unmountB } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileIdB} />
        </MemoryRouter>
      )

      await waitFor(() => expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument())
      const pmElB = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      const editorB = pmElB?.editor
      await waitFor(() => expect(editorB?.getText()).toBe('Doc B original'))

      // Wait for any trailing timers from A to expire
      await act(async () => {
        await new Promise((r) => setTimeout(r, 400))
      })

      // Doc B in DB must still be Doc B original, not corrupted by Doc A
      const savedB = await db.files.get(fileIdB)
      expect(savedB).toBeDefined()
      const savedBText = JSON.parse(savedB!.content)?.content?.[0]?.content?.[0]?.text ?? ''
      expect(savedBText).toBe('Doc B original')

      unmountB()
    })

    it('isolates two documents open simultaneously in split view without cross-persistence', async () => {
      const fileId1 = 'split-view-doc-1'
      const fileId2 = 'split-view-doc-2'
      const content1 = createDocJson('Left Pane Content')
      const content2 = createDocJson('Right Pane Content')

      const doc1: MyBookFile = {
        id: fileId1,
        driveFileId: 'drive-split-1',
        name: 'Left Pane Doc',
        type: 'document',
        folderId: null,
        content: content1,
        baseContent: content1,
        mimeType: 'application/json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      const doc2: MyBookFile = {
        id: fileId2,
        driveFileId: 'drive-split-2',
        name: 'Right Pane Doc',
        type: 'document',
        folderId: null,
        content: content2,
        baseContent: content2,
        mimeType: 'application/json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'backed-up',
        isDeleted: false,
      }

      await db.files.put(doc1)
      await db.files.put(doc2)

      mockLiveFilesById.set(fileId1, doc1)
      mockLiveFilesById.set(fileId2, doc2)

      const { unmount } = render(
        <MemoryRouter>
          <div data-testid="split-container">
            <TiptapDocumentEditor fileId={fileId1} />
            <TiptapDocumentEditor fileId={fileId2} />
          </div>
        </MemoryRouter>
      )

      await waitFor(() => {
        const pmEls = document.querySelectorAll('.ProseMirror')
        expect(pmEls.length).toBe(2)
      })

      const pmEls = document.querySelectorAll('.ProseMirror') as NodeListOf<HTMLElement & { editor?: Editor }>
      const editor1 = pmEls[0]?.editor
      const editor2 = pmEls[1]?.editor
      expect(editor1).toBeTruthy()
      expect(editor2).toBeTruthy()

      await waitFor(() => {
        expect(editor1!.getText()).toBe('Left Pane Content')
        expect(editor2!.getText()).toBe('Right Pane Content')
      })

      // Type in left editor
      act(() => {
        editor1!.commands.focus()
        editor1!.commands.insertContent(' [Left Edited]')
      })

      // Wait for debounce + save
      await waitFor(async () => {
        const saved1 = await db.files.get(fileId1)
        const saved1Text = JSON.parse(saved1?.content ?? '{}')?.content?.[0]?.content?.[0]?.text ?? ''
        expect(saved1Text).toBe('Left Pane Content [Left Edited]')
      }, { timeout: 3000 })

      // Right editor content in DB must be untouched
      const saved2 = await db.files.get(fileId2)
      const saved2Text = JSON.parse(saved2?.content ?? '{}')?.content?.[0]?.content?.[0]?.text ?? ''
      expect(saved2Text).toBe('Right Pane Content')

      unmount()
    })

    it('reopens a saved document and preserves the persisted content across editor instances', async () => {
      const fileId = 'reopen-saved-doc-test'
      const initialContent = createDocJson('Initial note version')
      const fileDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-reopen-test',
        name: 'Reopen Doc',
        type: 'document',
        folderId: null,
        content: initialContent,
        baseContent: initialContent,
        mimeType: 'application/json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      currentMockLiveFile = fileDoc
      await db.files.put(fileDoc)

      // First open
      const { unmount: unmount1 } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      await waitFor(() => expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument())
      let pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      let editor = pmEl?.editor
      await waitFor(() => expect(editor?.getText()).toBe('Initial note version'))

      // Edit and save
      act(() => {
        editor?.commands.focus()
        editor?.commands.insertContent(' with revisions')
      })

      await waitFor(async () => {
        const saved = await db.files.get(fileId)
        const savedText = JSON.parse(saved?.content ?? '{}')?.content?.[0]?.content?.[0]?.text ?? ''
        expect(savedText).toBe('Initial note version with revisions')
      }, { timeout: 3000 })

      unmount1()

      // Update mock live file to reflect saved DB state
      const updatedFile = (await db.files.get(fileId))!
      currentMockLiveFile = updatedFile

      // Second open: reopen the document
      const { unmount: unmount2 } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      await waitFor(() => expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument())
      pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      editor = pmEl?.editor
      await waitFor(() => expect(editor?.getText()).toBe('Initial note version with revisions'))

      // Verify DB remains intact after reopening
      await act(async () => {
        await new Promise((r) => setTimeout(r, 400))
      })
      const finalSaved = await db.files.get(fileId)
      const finalSavedText = JSON.parse(finalSaved?.content ?? '{}')?.content?.[0]?.content?.[0]?.text ?? ''
      expect(finalSavedText).toBe('Initial note version with revisions')

      unmount2()
    })

    it('programmatic hydration does not trigger unintended persistence or overwrite', async () => {
      const fileId = 'prog-hydration-test'
      const initialContent = createDocJson('Starting content')
      const fileDoc: MyBookFile = {
        id: fileId,
        driveFileId: 'drive-prog-hydration',
        name: 'Hydration Persistence Test',
        type: 'document',
        folderId: null,
        content: initialContent,
        baseContent: initialContent,
        mimeType: 'application/json',
        createdAt: '2026-10-30T10:00:00.000Z',
        updatedAt: '2026-10-30T10:00:00.000Z',
        lastSyncedAt: '2026-10-30T10:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      }
      currentMockLiveFile = fileDoc
      await db.files.put(fileDoc)

      const updateSpy = vi.spyOn(fileRepository, 'update')

      const { unmount } = render(
        <MemoryRouter>
          <TiptapDocumentEditor fileId={fileId} />
        </MemoryRouter>
      )

      await waitFor(() => expect(screen.getByLabelText(/Page title/i)).toBeInTheDocument())
      const pmEl = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
      const editor = pmEl?.editor
      await waitFor(() => expect(editor?.getText()).toBe('Starting content'))

      // Wait beyond the debounce and content sync timers
      await act(async () => {
        await new Promise((r) => setTimeout(r, 500))
      })

      // Pure hydration of existing content without user edits must not trigger repository updates
      expect(updateSpy).not.toHaveBeenCalled()

      // The DB document must retain its original content and updatedAt
      const dbDoc = await db.files.get(fileId)
      expect(dbDoc?.content).toBe(initialContent)
      expect(dbDoc?.updatedAt).toBe('2026-10-30T10:00:00.000Z')

      unmount()
    })
  })
})
