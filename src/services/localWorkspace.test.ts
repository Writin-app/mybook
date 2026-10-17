import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../database/db'
import {
  cleanDocumentName,
  documentMarkdown,
  isAttachmentDirectoryName,
  sanitizeFileName,
  scanAndHydrateLocalWorkspace,
} from './localWorkspace'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

describe('localWorkspace service', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    useWorkspaceStore.setState({ mode: 'local' })
  })

  it('sanitizes illegal file system characters safely', () => {
    expect(sanitizeFileName('My Document: Chapter 1 / Draft *?')).toBe('My Document_ Chapter 1 _ Draft __')
    expect(sanitizeFileName('')).toBe('Untitled')
  })

  it('cleans document file extensions properly', () => {
    expect(cleanDocumentName('Holiday.mybook.md')).toBe('Holiday')
    expect(cleanDocumentName('Notes.md')).toBe('Notes')
    expect(cleanDocumentName('Budget.xlsx')).toBe('Budget')
    expect(cleanDocumentName('12345.content.json')).toBe('12345')
  })

  it('converts document content to portable markdown with documentId metadata', () => {
    const markdown = documentMarkdown({
      id: 'doc-uuid-123',
      name: 'Meeting',
      content: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Discussion points' }] }],
      }),
    })
    expect(markdown).toContain('Discussion points')
    expect(markdown).toContain('document_id: "doc-uuid-123"')
    expect(markdown).toContain('title: "Meeting"')
  })

  it('converts empty document to clean frontmatter without automatic # Untitled heading', () => {
    const markdown = documentMarkdown({
      id: 'doc-empty-456',
      name: 'Untitled',
      content: '',
    })
    expect(markdown).toContain('title: "Untitled"')
    expect(markdown).toContain('document_id: "doc-empty-456"')
    expect(markdown).not.toContain('# Untitled')
  })

  it('identifies attachment folder names correctly', () => {
    expect(isAttachmentDirectoryName('Notes_attachments')).toBe(true)
    expect(isAttachmentDirectoryName('Notes-attachments')).toBe(true)
    expect(isAttachmentDirectoryName('Notes.attachments')).toBe(true)
    expect(isAttachmentDirectoryName('NormalFolder')).toBe(false)
  })

  it('scans mock directory handle, ignores attachment folders, and restores files to database', async () => {
    const fileEntries = new Map<string, FileSystemHandle>([
      [
        'Shopping.md',
        {
          kind: 'file',
          name: 'Shopping.md',
          getFile: async () => ({
            text: async () => '# Shopping\n\n- [ ] Milk\n- [ ] Apples',
            lastModified: Date.now(),
          }),
        } as unknown as FileSystemHandle,
      ],
      [
        'Finance.xlsx',
        {
          kind: 'file',
          name: 'Finance.xlsx',
          getFile: async () => ({
            text: async () => 'mock-xlsx-data',
            lastModified: Date.now(),
          }),
        } as unknown as FileSystemHandle,
      ],
    ])

    const mockRootHandle = {
      kind: 'directory',
      name: 'MockRoot',
      getDirectoryHandle: vi.fn().mockRejectedValue(new Error('No Writin folder')),
      entries: async function* () {
        for (const entry of fileEntries.entries()) {
          yield entry
        }
      },
    } as unknown as FileSystemDirectoryHandle

    const { discoveredCount, restoredCount } = await scanAndHydrateLocalWorkspace(mockRootHandle)
    expect(discoveredCount).toBe(2)
    expect(restoredCount).toBe(2)

    const files = await db.files.toArray()
    expect(files.length).toBe(2)
    const shoppingFile = files.find((f) => f.name === 'Shopping')
    expect(shoppingFile).toBeDefined()
    expect(shoppingFile?.type).toBe('document')
    expect(shoppingFile?.workspaceType).toBe('local')
  })

  it('nests files into a subfolder named after vault if selected folder has different name', async () => {
    const mockSubdirHandle = {
      kind: 'directory',
      name: 'Writin',
    } as unknown as FileSystemDirectoryHandle

    const mockRootHandle = {
      kind: 'directory',
      name: 'test',
      getDirectoryHandle: vi.fn().mockImplementation(async (name, options) => {
        if (name === 'Writin' && options?.create) {
          return mockSubdirHandle
        }
        throw new Error('Not found')
      }),
    } as unknown as FileSystemDirectoryHandle

    const { getWorkspaceEffectiveDirectory } = await import('./localWorkspace')
    const effective = await getWorkspaceEffectiveDirectory(mockRootHandle, true)
    expect(effective).toBe(mockSubdirHandle)
    expect(mockRootHandle.getDirectoryHandle).toHaveBeenCalledWith('Writin', { create: true })
  })

  it('detects duplicated files on disk with same frontmatter ID but different filenames as new items', async () => {
    // 1. Initial file in db
    const originalFile = {
      id: 'doc-original-id',
      driveFileId: null,
      workspaceType: 'drive' as const,
      name: 'Notes',
      type: 'document' as const,
      folderId: null,
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hello"}]}]}',
      mimeType: 'application/x-mybook-document' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: null,
      syncStatus: 'backed-up' as const,
      isDeleted: false,
    }
    await db.files.add(originalFile)

    // 2. Mock directory with "Notes.md" AND duplicate "Notes copy.md" having same document_id
    const fileEntries = new Map<string, FileSystemHandle>([
      [
        'Notes.md',
        {
          kind: 'file',
          name: 'Notes.md',
          getFile: async () => ({
            text: async () => '---\ndocument_id: "doc-original-id"\ntitle: "Notes"\n---\n\nhello',
            lastModified: Date.now(),
          }),
        } as unknown as FileSystemHandle,
      ],
      [
        'Notes copy.md',
        {
          kind: 'file',
          name: 'Notes copy.md',
          getFile: async () => ({
            text: async () => '---\ndocument_id: "doc-original-id"\ntitle: "Notes copy"\n---\n\nhello copy',
            lastModified: Date.now(),
          }),
        } as unknown as FileSystemHandle,
      ],
    ])

    const mockRootHandle = {
      kind: 'directory',
      name: 'Writin',
      getDirectoryHandle: vi.fn().mockRejectedValue(new Error('No legacy folder')),
      entries: async function* () {
        for (const entry of fileEntries.entries()) {
          yield entry
        }
      },
    } as unknown as FileSystemDirectoryHandle

    useWorkspaceStore.setState({ mode: 'drive' })
    const { discoveredCount, restoredCount } = await scanAndHydrateLocalWorkspace(mockRootHandle, { targetWorkspaceType: 'drive' })
    expect(discoveredCount).toBe(2)
    expect(restoredCount).toBe(1) // 1 new duplicated file restored

    const allFiles = await db.files.filter((f) => !f.isDeleted).toArray()
    expect(allFiles.length).toBe(2)
    const duplicateDoc = allFiles.find((f) => f.name === 'Notes copy')
    expect(duplicateDoc).toBeDefined()
    expect(duplicateDoc?.id).not.toBe(originalFile.id)
  })

  it('triggers mass deletion guard when 0 files found on disk, preserving cloud/db files', async () => {
    // 1. Setup existing folder and files in db
    const folder = {
      id: 'folder-cloud-safe',
      driveFolderId: 'drive-f-1',
      workspaceType: 'drive' as const,
      name: 'CloudFolder',
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    }
    const file = {
      id: 'file-cloud-safe',
      driveFileId: 'drive-file-1',
      workspaceType: 'drive' as const,
      name: 'CloudNotes',
      type: 'document' as const,
      folderId: folder.id,
      content: '{"type":"doc","content":[]}',
      mimeType: 'application/x-mybook-document' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: null,
      syncStatus: 'backed-up' as const,
      isDeleted: false,
    }
    await db.folders.add(folder)
    await db.files.add(file)

    // 2. Mock an empty directory on disk (user deleted the folder in Finder)
    const mockEmptyRootHandle = {
      kind: 'directory',
      name: 'Writin',
      getDirectoryHandle: vi.fn().mockRejectedValue(new Error('No subfolder')),
      entries: async function* () {
        // 0 files
      },
    } as unknown as FileSystemDirectoryHandle

    useWorkspaceStore.setState({ mode: 'drive', isMirrorFolderMissing: false })
    const { deletedCount } = await scanAndHydrateLocalWorkspace(mockEmptyRootHandle, { targetWorkspaceType: 'drive' })
    expect(deletedCount).toBe(0)

    // DB files must NOT be deleted
    const dbFiles = await db.files.filter((f) => !f.isDeleted).toArray()
    expect(dbFiles.length).toBe(1)
    expect(dbFiles[0]?.id).toBe(file.id)

    // Mirror folder must be marked missing
    expect(useWorkspaceStore.getState().isMirrorFolderMissing).toBe(true)

    // No delete operations in syncQueue
    const syncItems = await db.syncQueue.toArray()
    expect(syncItems.some((s) => s.operation === 'delete')).toBe(false)
  })

  it('detects when an individual file is deleted from a directory with other files', async () => {
    const fileRemaining = {
      id: 'file-remaining',
      driveFileId: 'drive-f-remain',
      workspaceType: 'drive' as const,
      name: 'KeepMe',
      type: 'document' as const,
      folderId: null,
      content: '{"type":"doc","content":[]}',
      mimeType: 'application/x-mybook-document' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: null,
      syncStatus: 'backed-up' as const,
      isDeleted: false,
    }
    const fileDeleted = {
      id: 'file-deleted',
      driveFileId: 'drive-f-del',
      workspaceType: 'drive' as const,
      name: 'DeleteMe',
      type: 'document' as const,
      folderId: null,
      content: '{"type":"doc","content":[]}',
      mimeType: 'application/x-mybook-document' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: null,
      syncStatus: 'backed-up' as const,
      isDeleted: false,
    }
    await db.files.add(fileRemaining)
    await db.files.add(fileDeleted)

    const fileEntries = new Map<string, FileSystemHandle>([
      [
        'KeepMe.md',
        {
          kind: 'file',
          name: 'KeepMe.md',
          getFile: async () => ({
            text: async () => '---\ndocument_id: "file-remaining"\ntitle: "KeepMe"\n---\n\nhello',
            lastModified: Date.now(),
          }),
        } as unknown as FileSystemHandle,
      ],
    ])

    const mockRootHandle = {
      kind: 'directory',
      name: 'Writin',
      getDirectoryHandle: vi.fn().mockRejectedValue(new Error('No subfolder')),
      entries: async function* () {
        for (const entry of fileEntries.entries()) {
          yield entry
        }
      },
    } as unknown as FileSystemDirectoryHandle

    useWorkspaceStore.setState({ mode: 'drive', isMirrorFolderMissing: false })
    const { deletedCount } = await scanAndHydrateLocalWorkspace(mockRootHandle, { targetWorkspaceType: 'drive' })
    expect(deletedCount).toBe(1)

    const activeFiles = await db.files.filter((f) => !f.isDeleted).toArray()
    expect(activeFiles.length).toBe(1)
    expect(activeFiles[0]?.id).toBe('file-remaining')

    const dbDeletedFile = await db.files.get('file-deleted')
    expect(dbDeletedFile?.isDeleted).toBe(true)

    const syncItems = await db.syncQueue.toArray()
    expect(syncItems.some((s) => s.entityId === 'file-deleted' && s.operation === 'delete')).toBe(true)
  })

  it('checks device directory handle validity and detects missing/deleted folder', async () => {
    const { checkDeviceDirectoryHandleValid, isMissingDirectoryError } = await import('./localWorkspace')

    // Mock a handle that throws NotFoundError when reading entries
    const deadHandle = {
      kind: 'directory',
      name: 'DeletedFolder',
      queryPermission: async () => 'granted' as PermissionState,
      requestPermission: async () => 'granted' as PermissionState,
      entries: () => ({
        next: async () => {
          throw new DOMException('Directory was deleted', 'NotFoundError')
        },
      }),
    } as unknown as FileSystemDirectoryHandle

    const result = await checkDeviceDirectoryHandleValid(deadHandle)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('NotFoundError')
    expect(isMissingDirectoryError(new DOMException('Directory deleted', 'NotFoundError'))).toBe(true)
    expect(isMissingDirectoryError(new DOMException('Permission denied', 'NotAllowedError'))).toBe(false)
  })

  it('keeps directory handle valid when permission state is prompt across sessions', async () => {
    const { checkDeviceDirectoryHandleValid } = await import('./localWorkspace')

    const promptHandle = {
      kind: 'directory',
      name: 'ExistingFolder',
      queryPermission: async () => 'prompt' as PermissionState,
      requestPermission: async () => 'granted' as PermissionState,
      entries: () => ({
        next: async () => ({ done: true, value: undefined }),
      }),
    } as unknown as FileSystemDirectoryHandle

    const result = await checkDeviceDirectoryHandleValid(promptHandle)
    expect(result.valid).toBe(true)
    expect(result.needsPermission).toBe(true)
  })

  it('updates existing file in-place and preserves driveFileId when file is renamed on disk', async () => {
    const originalFile = {
      id: 'doc-renamed-id',
      driveFileId: 'drive-file-rename-1',
      workspaceType: 'drive' as const,
      name: 'Original Name',
      type: 'document' as const,
      folderId: null,
      content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'original content' }] }] }),
      mimeType: 'application/x-mybook-document',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      syncStatus: 'backed-up' as const,
      isDeleted: false,
    }
    await db.files.add(originalFile)

    const fileEntries = new Map<string, FileSystemHandle>([
      [
        'New Renamed Name.md',
        {
          kind: 'file',
          name: 'New Renamed Name.md',
          getFile: async () => ({
            text: async () => '---\ndocument_id: "doc-renamed-id"\ntitle: "New Renamed Name"\n---\n\nupdated content',
            lastModified: Date.now(),
          }),
        } as unknown as FileSystemHandle,
      ],
    ])

    const mockRootHandle = {
      kind: 'directory',
      name: 'Writin',
      getDirectoryHandle: vi.fn().mockRejectedValue(new Error('No legacy folder')),
      entries: async function* () {
        for (const entry of fileEntries.entries()) {
          yield entry
        }
      },
    } as unknown as FileSystemDirectoryHandle

    useWorkspaceStore.setState({ mode: 'drive' })
    const { discoveredCount, restoredCount, deletedCount } = await scanAndHydrateLocalWorkspace(mockRootHandle, { targetWorkspaceType: 'drive' })
    expect(discoveredCount).toBe(1)
    expect(restoredCount).toBe(0) // Updated in place, not created as a new restored item
    expect(deletedCount).toBe(0)

    const allFiles = await db.files.filter((f) => !f.isDeleted).toArray()
    expect(allFiles.length).toBe(1)
    expect(allFiles[0]?.id).toBe('doc-renamed-id')
    expect(allFiles[0]?.name).toBe('New Renamed Name')
    expect(allFiles[0]?.driveFileId).toBe('drive-file-rename-1')

    const syncItems = await db.syncQueue.toArray()
    const updateSync = syncItems.find((s) => s.entityId === 'doc-renamed-id' && s.operation === 'update')
    expect(updateSync).toBeDefined()
  })

  it('extractAndSaveAttachments prunes unreferenced media and removes directory when all media is deleted', async () => {
    const { extractAndSaveAttachments } = await import('./localWorkspace')

    const removedFiles: string[] = []
    const removedEntries: string[] = []
    const writtenFiles = new Map<string, Uint8Array>()

    const mockAttachmentsDir = {
      kind: 'directory',
      name: 'TestDoc_attachments',
      getFileHandle: vi.fn().mockImplementation(async (name: string) => ({
        kind: 'file',
        name,
        createWritable: async () => ({
          write: async (data: Uint8Array) => {
            writtenFiles.set(name, data)
          },
          close: async () => {},
        }),
      })),
      removeEntry: vi.fn().mockImplementation(async (name: string) => {
        removedFiles.push(name)
        writtenFiles.delete(name)
      }),
      entries: async function* () {
        for (const name of ['media_1.png', 'media_2.png']) {
          yield [name, { kind: 'file', name } as FileSystemHandle]
        }
      },
    }

    const mockDocDir = {
      kind: 'directory',
      name: 'root',
      getDirectoryHandle: vi.fn().mockImplementation(async (name: string) => {
        if (name === 'TestDoc_attachments') return mockAttachmentsDir
        throw new Error('Not found')
      }),
      removeEntry: vi.fn().mockImplementation(async (name: string) => {
        removedEntries.push(name)
      }),
    } as unknown as FileSystemDirectoryHandle

    // Document with only media_1 remaining (media_2 was deleted)
    const docWithOnlyMedia1: import('@tiptap/core').JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'imageBlock',
          attrs: { src: './TestDoc_attachments/media_1.png' },
        },
      ],
    }

    await extractAndSaveAttachments(mockDocDir, 'TestDoc', docWithOnlyMedia1)
    expect(removedFiles).toContain('media_2.png')
    expect(removedEntries.length).toBe(0) // Directory kept because media_1 remains

    // Document with 0 media (media_1 also deleted)
    const emptyDoc: import('@tiptap/core').JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'no images left' }],
        },
      ],
    }

    await extractAndSaveAttachments(mockDocDir, 'TestDoc', emptyDoc)
    expect(removedEntries).toContain('TestDoc_attachments')
  })

  it('preserves IndexedDB notes and does not mark them deleted when no physical device handle is active', async () => {
    const { scanAndHydrateLocalWorkspace } = await import('./localWorkspace')
    const localNote = {
      id: 'android-local-note',
      driveFileId: null,
      workspaceType: 'local' as const,
      name: 'Android Offline Note',
      type: 'document' as const,
      folderId: null,
      content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'offline' }] }] }),
      mimeType: 'application/x-mybook-document',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: null,
      syncStatus: 'local' as const,
      isDeleted: false,
    }
    await db.files.add(localNote)

    // Run scan without a physical directory handle (e.g. mobile/Android or private mode)
    const result = await scanAndHydrateLocalWorkspace(null, { targetWorkspaceType: 'local' })

    expect(result.deletedCount).toBe(0)
    const saved = await db.files.get('android-local-note')
    expect(saved).toBeDefined()
    expect(saved?.isDeleted).toBe(false)
  })

  it('does not overwrite file content or name from disk when the file has active unsaved local edits', async () => {
    const { registerUnsavedEditsProbe } = await import('./localEditState')
    const fileId = 'active-edit-doc'
    const unregister = registerUnsavedEditsProbe(fileId, () => true)

    try {
      const activeFile = {
        id: fileId,
        driveFileId: null,
        workspaceType: 'local' as const,
        name: 'In Progress Title',
        type: 'document' as const,
        folderId: null,
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'new text' }] }] }),
        mimeType: 'application/x-mybook-document',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSyncedAt: null,
        syncStatus: 'local' as const,
        isDeleted: false,
      }
      await db.files.add(activeFile)

      const fileEntries = new Map<string, FileSystemHandle>([
        [
          'In Progress Title.md',
          {
            kind: 'file',
            name: 'In Progress Title.md',
            getFile: async () => ({
              text: async () => '---\nmybook_version: 1\ntype: document\ndocument_id: "active-edit-doc"\n---\n\nold stale text on disk',
              lastModified: Date.now() - 5000,
            }),
          } as unknown as FileSystemHandle,
        ],
      ])

      const mockRootHandle = {
        kind: 'directory',
        name: 'MockRoot',
        getDirectoryHandle: vi.fn().mockRejectedValue(new Error('No Writin folder')),
        entries: async function* () {
          for (const entry of fileEntries.entries()) {
            yield entry
          }
        },
      } as unknown as FileSystemDirectoryHandle

      await scanAndHydrateLocalWorkspace(mockRootHandle, { targetWorkspaceType: 'local' })

      const saved = await db.files.get(fileId)
      expect(saved?.name).toBe('In Progress Title')
      expect(saved?.content).toContain('new text')
      expect(saved?.content).not.toContain('old stale text on disk')
    } finally {
      unregister()
    }
  })
})
