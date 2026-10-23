import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../database/db'
import { useAuthStore } from '../stores/useAuthStore'
import { registerUnsavedEditsProbe } from './localEditState'
import {
  backupDocumentToDrive,
  classifyDriveTrashMetadata,
  createVisibleFolder,
  ensureMyBookDriveFolder,
  findDriveRootFolderByName,
  importDriveFoldersToLocal,
  importDriveFilesToLocal,
  listExistingDriveVaults,
  listTrashedMyBookDriveFiles,
  listTrashedMyBookDriveFolders,
  listVisibleFoldersByName,
  permanentlyDeleteDriveFile,
  refreshDriveFileToLocal,
  updateDriveFolder,
  updateDriveFile,
} from './googleDrive'

vi.mock('../database/repositories', () => ({
}))

vi.mock('../utils/xlsx', () => ({
  importXlsxToWorkbook: vi.fn().mockResolvedValue({
    success: true,
    data: {
      id: 'imported-workbook',
      name: 'Imported workbook',
      sheets: [],
      activeSheetId: null,
    },
  }),
}))

vi.mock('../database/db', () => ({
  db: {
    files: {
      toArray: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      get: vi.fn(),
      filter: vi.fn(),
    },
    fileVersions: {
      add: vi.fn(),
      get: vi.fn(),
    },
    folders: {
      toArray: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      get: vi.fn(),
    },
    syncQueue: {
      filter: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
    },
    settings: {
      get: vi.fn(),
      put: vi.fn(),
    },
    transaction: vi.fn(async (...args: unknown[]) => {
      const callback = args.at(-1)
      if (typeof callback === 'function') await callback()
    }),
  },
}))

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}))

const mockedSettings = vi.mocked(db.settings)
const mockedFiles = vi.mocked(db.files)
const mockedFolders = vi.mocked(db.folders)
const mockedSyncQueue = vi.mocked(db.syncQueue)
const mockedGetState = vi.mocked(useAuthStore.getState)

function mockUnresolvedSyncQueue(items: unknown[] = []) {
  mockedSyncQueue.filter.mockImplementation(((predicate: (item: unknown) => boolean) => ({
    toArray: vi.fn().mockResolvedValue(items.filter(predicate)),
    first: vi.fn().mockResolvedValue(items.find(predicate)),
    modify: vi.fn().mockResolvedValue(undefined),
  })) as never)
}

function mockEmptyFileFilter() {
  mockedFiles.filter.mockReturnValue({
    modify: vi.fn().mockResolvedValue(undefined),
  } as never)
}

function stubDriveFetch(fetchMock: (url: string, init?: RequestInit) => unknown) {
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    const match = /\/files\/(mybook-root|stored-folder)\?fields=id,name,mimeType,trashed$/.exec(String(url))
    if (match && !init?.method) {
      return Promise.resolve({ ok: true, json: async () => ({ id: match[1], name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }) })
    }
    return fetchMock(url, init)
  }))
}

describe('googleDrive helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetState.mockReturnValue({ getAccessToken: () => Promise.resolve('token') } as never)
    mockedFiles.get.mockResolvedValue(undefined)
    vi.mocked(db.fileVersions.get).mockResolvedValue(undefined)
    mockedFolders.get.mockResolvedValue(undefined)
    mockUnresolvedSyncQueue()
    mockEmptyFileFilter()
    vi.stubGlobal('navigator', { onLine: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lists visible folders by name', async () => {
    const json = vi.fn().mockResolvedValue({ files: [{ id: '1', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] })
    stubDriveFetch(vi.fn().mockResolvedValue({ ok: true, json }))

    const folders = await listVisibleFoldersByName('MyBook')

    expect(folders).toHaveLength(1)
    expect(folders[0]?.id).toBe('1')
  })

  it('suggests only marked vaults and legacy names from the Drive root', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        files: [
          { id: 'app-vault', name: 'Projects', mimeType: 'application/vnd.google-apps.folder', appProperties: { writin_vault: 'true' } },
          { id: 'legacy-vault', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' },
        ],
      }),
    })
    stubDriveFetch(fetchMock)

    await expect(listExistingDriveVaults()).resolves.toEqual([
      { id: 'app-vault', name: 'Projects' },
      { id: 'legacy-vault', name: 'Writin' },
    ])
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get('q')).toContain("'root' in parents")
  })

  it('matches root folder names without case or surrounding-space differences', async () => {
    stubDriveFetch(vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        files: [{ id: 'folder-1', name: 'Team Notes', mimeType: 'application/vnd.google-apps.folder' }],
      }),
    }))

    await expect(findDriveRootFolderByName(' team notes ')).resolves.toEqual({ id: 'folder-1', name: 'Team Notes' })
  })

  it('creates the Writin folder when one is not stored or found', async () => {
    mockedSettings.get.mockResolvedValue({ success: true, data: { key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' } })
    mockedSettings.put.mockResolvedValue('google-drive.mybook-folder-id')
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 'folder-1', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }) }))

    const result = await ensureMyBookDriveFolder()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.created).toBe(true)
      expect(result.folderId).toBe('folder-1')
    }
    expect(mockedSettings.put).toHaveBeenCalled()
  })

  it('validates and reuses a stored folder id', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'stored-folder', updatedAt: '2026-07-24T00:00:00.000Z' })
    stubDriveFetch(vi.fn())
    const result = await ensureMyBookDriveFolder()

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/files/stored-folder?'), expect.any(Object))
    expect(result).toEqual({ success: true, folderId: 'stored-folder', folderName: 'Writin', created: false })
  })

  it('returns a friendly offline error when the network is unavailable', async () => {
    stubDriveFetch(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    vi.stubGlobal('navigator', { onLine: false })

    await expect(createVisibleFolder('MyBook')).rejects.toThrow(/offline/i)
  })

  it('permanently deletes a Drive item with files.delete', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: vi.fn() })
    stubDriveFetch(fetchMock)

    await expect(permanentlyDeleteDriveFile('drive-file')).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith('https://www.googleapis.com/drive/v3/files/drive-file', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token' },
    })
  })

  it('treats an already-missing Drive item as permanent-delete success', async () => {
    stubDriveFetch(vi.fn().mockResolvedValue({ ok: false, status: 404, json: vi.fn().mockResolvedValue({ error: { message: 'File not found' } }) }))

    await expect(permanentlyDeleteDriveFile('missing-drive-file')).resolves.toBeUndefined()
  })

  it('keeps permission failures retryable for permanent Drive delete callers', async () => {
    stubDriveFetch(vi.fn().mockResolvedValue({ ok: false, status: 403, json: vi.fn().mockResolvedValue({ error: { message: 'insufficient permissions' } }) }))

    await expect(permanentlyDeleteDriveFile('drive-file')).rejects.toThrow('insufficient permissions')
  })

  it('lists trashed Mybook file metadata with explicit trash and parent fields', async () => {
    const json = vi.fn().mockResolvedValue({
      files: [{
        id: 'drive-file',
        name: 'Notes.mybook.md',
        mimeType: 'text/markdown',
        parents: ['drive-folder'],
        trashed: true,
        explicitlyTrashed: true,
        appProperties: { custom: 'value' },
        modifiedTime: '2026-09-05T00:00:00.000Z',
      }],
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json })
    stubDriveFetch(fetchMock)

    const files = await listTrashedMyBookDriveFiles('drive-folder')

    expect(files).toEqual([{
      id: 'drive-file',
      name: 'Notes.mybook.md',
      mimeType: 'text/markdown',
      parents: ['drive-folder'],
      trashed: true,
      explicitlyTrashed: true,
      appProperties: { custom: 'value' },
      modifiedTime: '2026-09-05T00:00:00.000Z',
      mybookFolderId: null,
    }])
    expect(decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))).toContain("mimeType!='application/vnd.google-apps.folder' and trashed=true")
    expect(decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))).toContain('explicitlyTrashed')
    expect(decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))).toContain('appProperties')
    expect(decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))).toContain('parents')
  })

  it('lists trashed folder metadata and recovers appProperties mybookFolderId', async () => {
    const json = vi.fn().mockResolvedValue({
      files: [
        {
          id: 'drive-folder-a',
          name: 'Projects',
          mimeType: 'application/vnd.google-apps.folder',
          parents: ['mybook-root'],
          trashed: true,
          explicitlyTrashed: true,
          appProperties: { mybookFolderId: 'folder_abc' },
        },
        {
          id: 'drive-folder-b',
          name: 'Budget',
          mimeType: 'application/vnd.google-apps.folder',
          parents: ['drive-folder-a'],
          trashed: true,
          explicitlyTrashed: false,
        },
      ],
    })
    stubDriveFetch(vi.fn().mockResolvedValue({ ok: true, json }))

    const folders = await listTrashedMyBookDriveFolders('mybook-root')

    expect(folders[0]).toMatchObject({
      id: 'drive-folder-a',
      explicitlyTrashed: true,
      mybookFolderId: 'folder_abc',
    })
    expect(folders[1]).toMatchObject({
      id: 'drive-folder-b',
      explicitlyTrashed: false,
      mybookFolderId: null,
    })
  })

  it('classifies independent trash roots and recursive trash descendants', () => {
    const classified = classifyDriveTrashMetadata([
      { id: 'drive-a', name: 'A', mimeType: 'application/vnd.google-apps.folder', parents: ['root'], trashed: true, explicitlyTrashed: true },
      { id: 'drive-b', name: 'B', mimeType: 'application/vnd.google-apps.folder', parents: ['drive-a'], trashed: true, explicitlyTrashed: false },
      { id: 'drive-c', name: 'C', mimeType: 'application/vnd.google-apps.folder', parents: ['drive-a'], trashed: true, explicitlyTrashed: true },
    ])

    expect(classified.find((item) => item.id === 'drive-a')).toMatchObject({
      classification: 'independent-trash-root',
      trashedByAncestorDriveId: null,
    })
    expect(classified.find((item) => item.id === 'drive-b')).toMatchObject({
      classification: 'recursive-trash-descendant',
      trashedByAncestorDriveId: 'drive-a',
    })
    expect(classified.find((item) => item.id === 'drive-c')).toMatchObject({
      classification: 'independent-trash-root',
      trashedByAncestorDriveId: null,
    })
  })

  it('models parent restore while preserving independently trashed descendants', () => {
    const classified = classifyDriveTrashMetadata([
      { id: 'projects', name: 'Projects', mimeType: 'application/vnd.google-apps.folder', parents: ['root'], trashed: true, explicitlyTrashed: true },
      { id: 'notes', name: 'Notes', mimeType: 'text/markdown', parents: ['projects'], trashed: true, explicitlyTrashed: true },
      { id: 'budget', name: 'Budget', mimeType: 'text/markdown', parents: ['projects'], trashed: true, explicitlyTrashed: false },
      { id: 'assets', name: 'Assets', mimeType: 'application/vnd.google-apps.folder', parents: ['projects'], trashed: true, explicitlyTrashed: false },
    ])

    const restoredWithProjects = classified
      .filter((item) => item.id === 'projects' || item.trashedByAncestorDriveId === 'projects')
      .map((item) => item.id)
      .sort()
    const remainsTrashed = classified
      .filter((item) => item.id !== 'projects' && item.trashedByAncestorDriveId !== 'projects')
      .map((item) => item.id)

    expect(restoredWithProjects).toEqual(['assets', 'budget', 'projects'])
    expect(remainsTrashed).toEqual(['notes'])
  })

  it('classifies multiple nested recursive descendants under the explicit trash root', () => {
    const classified = classifyDriveTrashMetadata([
      { id: 'a', name: 'A', mimeType: 'application/vnd.google-apps.folder', parents: ['root'], trashed: true, explicitlyTrashed: true },
      { id: 'b', name: 'B', mimeType: 'application/vnd.google-apps.folder', parents: ['a'], trashed: true, explicitlyTrashed: false },
      { id: 'c', name: 'C', mimeType: 'application/vnd.google-apps.folder', parents: ['b'], trashed: true, explicitlyTrashed: false },
      { id: 'file', name: 'File', mimeType: 'text/markdown', parents: ['c'], trashed: true, explicitlyTrashed: false },
    ])

    expect(classified.filter((item) => item.id !== 'a').map((item) => item.trashedByAncestorDriveId)).toEqual(['a', 'a', 'a'])
  })

  it('keeps nested independently trashed folders as their own trash roots', () => {
    const classified = classifyDriveTrashMetadata([
      { id: 'a', name: 'A', mimeType: 'application/vnd.google-apps.folder', parents: ['root'], trashed: true, explicitlyTrashed: true },
      { id: 'b', name: 'B', mimeType: 'application/vnd.google-apps.folder', parents: ['a'], trashed: true, explicitlyTrashed: true },
      { id: 'c', name: 'C', mimeType: 'application/vnd.google-apps.folder', parents: ['b'], trashed: true, explicitlyTrashed: false },
    ])

    expect(classified.find((item) => item.id === 'b')).toMatchObject({
      classification: 'independent-trash-root',
      trashedByAncestorDriveId: null,
    })
    expect(classified.find((item) => item.id === 'c')).toMatchObject({
      classification: 'recursive-trash-descendant',
      trashedByAncestorDriveId: 'b',
    })
  })

  it('demonstrates trashed mybook markdown can flow through the existing download path when Drive returns media', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'trashed-doc', name: 'Deleted.mybook.md', mimeType: 'text/markdown', parents: ['mybook-root'], modifiedTime: '2026-09-05T00:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ndocument_id: "doc-deleted"\ntitle: "Deleted"\n---\n\nDeleted content') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
    stubDriveFetch(fetchMock)

    await importDriveFilesToLocal()

    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('alt=media'))).toBe(true)
    expect(mockedFiles.add).toHaveBeenCalledWith(expect.objectContaining({
      id: 'doc-deleted',
      driveFileId: 'trashed-doc',
    }))
  })

  it('imports Drive files into local storage without creating duplicates', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'doc-1', name: 'Drive Note', mimeType: 'application/x-mybook-document' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.add).toHaveBeenCalledWith(expect.objectContaining({
      driveFileId: 'doc-1',
      name: 'Drive Note',
      isDeleted: false,
    }))
  })

  it('merges an imported Drive file into an existing local file with the same name', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'local-note',
      driveFileId: null,
      name: 'Drive Note',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: false,
    }])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'doc-1', name: 'Drive Note.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\ntitle: Drive Note\n---\n\nHello') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.add).not.toHaveBeenCalled()
    expect(mockedFiles.update).toHaveBeenCalledWith('local-note', expect.objectContaining({
      driveFileId: 'doc-1',
      name: 'Drive Note',
      syncStatus: 'backed-up',
      isDeleted: false,
    }))
  })

  it('skips content download and local rewrite when Drive import only confirms an unchanged existing document', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'local-note',
      driveFileId: 'doc-1',
      workspaceType: 'drive',
      name: 'Drive Note',
      type: 'document',
      folderId: null,
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      mimeType: 'text/markdown',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    }])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'doc-1', name: 'Drive Note.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T09:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
    stubDriveFetch(fetchMock)

    await importDriveFilesToLocal()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('alt=media'))).toBe(false)
    expect(mockedFiles.update).not.toHaveBeenCalledWith('local-note', expect.anything())
  })

  it('skips content download and local rewrite when Drive import only confirms an unchanged existing spreadsheet', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'sheet-1',
      driveFileId: 'drive-sheet',
      workspaceType: 'drive',
      name: 'Budget',
      type: 'spreadsheet',
      folderId: null,
      content: '{"id":"sheet-1","sheets":[]}',
      mimeType: 'application/x-mybook-spreadsheet',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    }])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-sheet', name: 'Budget.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', modifiedTime: '2026-08-22T09:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
    stubDriveFetch(fetchMock)

    await importDriveFilesToLocal()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('alt=media'))).toBe(false)
    expect(mockedFiles.update).not.toHaveBeenCalledWith('sheet-1', expect.anything())
  })

  it('downloads and imports a Drive-changed document for an older returning device', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'local-note',
      driveFileId: 'doc-1',
      name: 'Drive Note',
      type: 'document',
      folderId: null,
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Old"}]}]}',
      mimeType: 'text/markdown',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    }])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'doc-1', name: 'Drive Note.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ntitle: "Drive Note"\n---\n\nNew content') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
    stubDriveFetch(fetchMock)

    await importDriveFilesToLocal()

    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('alt=media'))).toBe(true)
    expect(mockedFiles.update).toHaveBeenCalledWith('local-note', expect.objectContaining({
      content: expect.stringContaining('New content'),
      lastSyncedAt: '2026-08-22T10:00:00.000Z',
      syncStatus: 'backed-up',
    }))
  })

  it('downloads and imports a Drive-changed spreadsheet for an older returning device', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'sheet-1',
      driveFileId: 'drive-sheet',
      name: 'Budget',
      type: 'spreadsheet',
      folderId: null,
      content: '{"id":"old-workbook","sheets":[]}',
      mimeType: 'application/x-mybook-spreadsheet',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    }])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-sheet', name: 'Budget.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, blob: vi.fn().mockResolvedValue(new Blob(['xlsx'])) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
    stubDriveFetch(fetchMock)

    await importDriveFilesToLocal()

    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('alt=media'))).toBe(true)
    expect(mockedFiles.update).toHaveBeenCalledWith('sheet-1', expect.objectContaining({
      content: expect.stringContaining('imported-workbook'),
      lastSyncedAt: '2026-08-22T10:00:00.000Z',
      syncStatus: 'backed-up',
    }))
  })

  it.each(['pending', 'processing', 'failed'] as const)('keeps pending local file move, rename, and content when Drive import is stale and queue is %s', async (status) => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'file-1',
      driveFileId: 'drive-doc',
      workspaceType: 'drive',
      name: 'Project Plan',
      type: 'document',
      folderId: 'folder-b',
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"local draft"}]}]}',
      mimeType: 'text/markdown',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: status === 'failed' ? 'failed' : 'pending',
      isDeleted: false,
    }])
    mockUnresolvedSyncQueue([{
      id: 'queue-file',
      entityId: 'file-1',
      entityType: 'file',
      operation: 'update',
      status,
      retryCount: 0,
      createdAt: '2026-08-22T12:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      errorMessage: status === 'failed' ? 'temporary failure' : null,
    }])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-doc', name: 'Project.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T13:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.update).toHaveBeenCalledWith('file-1', {
      driveFileId: 'drive-doc',
      workspaceType: 'drive',
      type: 'document',
      mimeType: 'text/markdown',
    })
    expect(mockedFiles.update).not.toHaveBeenCalledWith('file-1', expect.objectContaining({
      name: 'Project',
      folderId: null,
      content: expect.stringContaining('stale drive'),
      isDeleted: false,
      syncStatus: 'backed-up',
      lastSyncedAt: '2026-08-22T13:00:00.000Z',
    }))
  })

  it('reconciles a completed file move when there is no unresolved local queue item', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'file-1',
      driveFileId: 'drive-doc',
      workspaceType: 'drive',
      name: 'Project Plan',
      type: 'document',
      folderId: 'folder-b',
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      mimeType: 'text/markdown',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    }])
    mockUnresolvedSyncQueue([{ id: 'completed', entityId: 'file-1', entityType: 'file', operation: 'update', status: 'completed', retryCount: 0, createdAt: '', updatedAt: '', errorMessage: null }])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-doc', name: 'Project.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T13:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ntitle: "Project"\n---\n\nDrive') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.update).toHaveBeenCalledWith('file-1', expect.objectContaining({
      name: 'Project',
      folderId: null,
      syncStatus: 'backed-up',
      lastSyncedAt: '2026-08-22T13:00:00.000Z',
    }))
  })

  it('keeps pending local file trash when Drive still lists the active file', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'file-1',
      driveFileId: 'drive-doc',
      workspaceType: 'drive',
      name: 'Deleted Note',
      type: 'document',
      folderId: null,
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      mimeType: 'text/markdown',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'pending',
      isDeleted: true,
    }])
    mockUnresolvedSyncQueue([{ id: 'queue-delete', entityId: 'file-1', entityType: 'file', operation: 'delete', status: 'pending', retryCount: 0, createdAt: '', updatedAt: '', errorMessage: null }])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-doc', name: 'Deleted Note.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T13:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.update).toHaveBeenCalledWith('file-1', {
      driveFileId: 'drive-doc',
      workspaceType: 'drive',
      type: 'document',
      mimeType: 'text/markdown',
    })
    expect(mockedFiles.update).not.toHaveBeenCalledWith('file-1', expect.objectContaining({ isDeleted: false }))
  })

  it('does not mark a missing Drive file deleted while a local file operation is unresolved', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'file-1',
      driveFileId: 'drive-doc',
      workspaceType: 'drive',
      name: 'Pending Note',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'text/markdown',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'pending',
      isDeleted: false,
    }])
    mockUnresolvedSyncQueue([{ id: 'queue-file', entityId: 'file-1', entityType: 'file', operation: 'update', status: 'pending', retryCount: 0, createdAt: '', updatedAt: '', errorMessage: null }])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.update).not.toHaveBeenCalledWith('file-1', expect.objectContaining({ isDeleted: true }))
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('keeps pending local folder move and rename when Drive folder import is stale', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([{
      id: 'folder-1',
      driveFolderId: 'drive-folder',
      workspaceType: 'drive',
      name: 'Project Plan',
      parentId: 'folder-b',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      isDeleted: false,
    }])
    mockUnresolvedSyncQueue([{ id: 'queue-folder', entityId: 'folder-1', entityType: 'folder', operation: 'update', status: 'pending', retryCount: 0, createdAt: '', updatedAt: '', errorMessage: null }])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-folder', name: 'Project', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    expect(mockedFolders.update).not.toHaveBeenCalledWith('folder-1', expect.objectContaining({
      name: 'Project',
      parentId: null,
      isDeleted: false,
    }))
  })

  it('reconciles completed folder move and rename when no local folder operation is unresolved', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([{
      id: 'folder-1',
      driveFolderId: 'drive-folder',
      workspaceType: 'drive',
      name: 'Project Plan',
      parentId: 'folder-b',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      isDeleted: false,
    }])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-folder', name: 'Project', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    expect(mockedFolders.update).toHaveBeenCalledWith('folder-1', expect.objectContaining({
      name: 'Project',
      parentId: null,
      driveFolderId: 'drive-folder',
      workspaceType: 'drive',
      isDeleted: false,
    }))
  })

  it('keeps pending local folder trash when Drive still lists the active folder', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([{
      id: 'folder-1',
      driveFolderId: 'drive-folder',
      workspaceType: 'drive',
      name: 'Archive',
      parentId: null,
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      isDeleted: true,
    }])
    mockUnresolvedSyncQueue([{ id: 'queue-folder-delete', entityId: 'folder-1', entityType: 'folder', operation: 'delete', status: 'failed', retryCount: 1, createdAt: '', updatedAt: '', errorMessage: 'temporary failure' }])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-folder', name: 'Archive', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    expect(mockedFolders.update).not.toHaveBeenCalledWith('folder-1', expect.objectContaining({ isDeleted: false }))
  })

  it('imports folder favorite status from Drive appProperties', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-folder-fav', name: 'FavFolder', mimeType: 'application/vnd.google-apps.folder', appProperties: { isFavorite: 'true' } }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    expect(mockedFolders.add).toHaveBeenCalledWith(expect.objectContaining({
      name: 'FavFolder',
      driveFolderId: 'drive-folder-fav',
      isFavorite: true,
    }))
  })

  it('imports nested folder hierarchy (Parent -> Child -> Grandchild) with accurate parentId and ID mapping', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])

    // Root children: 'Parent' (drive-p)
    // 'Parent' children: 'Child' (drive-c)
    // 'Child' children: 'Grandchild' (drive-gc)
    // 'Grandchild' children: none
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-p', name: 'Parent', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-c', name: 'Child', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-gc', name: 'Grandchild', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    expect(mockedFolders.add).toHaveBeenCalledTimes(3)
    const addedFolders = mockedFolders.add.mock.calls.map((call) => call[0] as { id: string; name: string; parentId: string | null; driveFolderId: string })
    const parentFolder = addedFolders.find((f) => f.name === 'Parent')!
    const childFolder = addedFolders.find((f) => f.name === 'Child')!
    const grandchildFolder = addedFolders.find((f) => f.name === 'Grandchild')!

    expect(parentFolder.parentId).toBeNull()
    expect(parentFolder.driveFolderId).toBe('drive-p')

    expect(childFolder.parentId).toBe(parentFolder.id)
    expect(childFolder.driveFolderId).toBe('drive-c')

    expect(grandchildFolder.parentId).toBe(childFolder.id)
    expect(grandchildFolder.driveFolderId).toBe('drive-gc')
  })

  it('is idempotent on repeated folder imports and does not duplicate records', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([{
      id: 'existing-parent-id',
      name: 'Existing Parent',
      parentId: null,
      driveFolderId: 'drive-p',
      workspaceType: 'drive',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      isDeleted: false,
    }])

    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-p', name: 'Existing Parent', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    expect(mockedFolders.add).not.toHaveBeenCalled()
  })

  it('prefers active folder over trashed folder when resolving by name and parent', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([
      {
        id: 'trashed-folder',
        name: 'Projects',
        parentId: null,
        driveFolderId: null,
        workspaceType: 'drive',
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
        isDeleted: true,
      },
      {
        id: 'active-folder',
        name: 'Projects',
        parentId: null,
        driveFolderId: null,
        workspaceType: 'drive',
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
        isDeleted: false,
      },
    ])

    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-projects', name: 'Projects', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    expect(mockedFolders.update).toHaveBeenCalledWith('active-folder', expect.objectContaining({
      driveFolderId: 'drive-projects',
      isDeleted: false,
    }))
    expect(mockedFolders.update).not.toHaveBeenCalledWith('trashed-folder', expect.anything())
  })

  it('prefers active folder regardless of record ordering in database', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    // Inverted ordering: active comes first, trashed comes second with later timestamp
    mockedFolders.toArray.mockResolvedValue([
      {
        id: 'active-folder',
        name: 'Projects',
        parentId: null,
        driveFolderId: null,
        workspaceType: 'drive',
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
        isDeleted: false,
      },
      {
        id: 'trashed-folder',
        name: 'Projects',
        parentId: null,
        driveFolderId: null,
        workspaceType: 'drive',
        createdAt: '2026-08-23T00:00:00.000Z',
        updatedAt: '2026-08-23T00:00:00.000Z',
        isDeleted: true,
      },
    ])

    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-projects', name: 'Projects', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    expect(mockedFolders.update).toHaveBeenCalledWith('active-folder', expect.objectContaining({
      driveFolderId: 'drive-projects',
      isDeleted: false,
    }))
    expect(mockedFolders.update).not.toHaveBeenCalledWith('trashed-folder', expect.anything())
  })

  it('resolves matching Drive ID correctly even if another folder has the same name', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([
      {
        id: 'folder-a',
        name: 'Work',
        parentId: null,
        driveFolderId: 'drive-work-a',
        workspaceType: 'drive',
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
        isDeleted: false,
      },
      {
        id: 'folder-b',
        name: 'Work',
        parentId: null,
        driveFolderId: 'drive-work-b',
        workspaceType: 'drive',
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
        isDeleted: false,
      },
    ])

    // Drive returns folder with ID drive-work-b
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-work-b', name: 'Work', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    // Should NOT create new folder
    expect(mockedFolders.add).not.toHaveBeenCalled()
  })

  it('does not resurrect a trashed folder when an unlinked same-name Drive folder is imported', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    // Only a trashed folder exists locally
    mockedFolders.toArray.mockResolvedValue([
      {
        id: 'trashed-only',
        name: 'Archive',
        parentId: null,
        driveFolderId: null,
        workspaceType: 'drive',
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
        isDeleted: true,
      },
    ])

    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-archive-new', name: 'Archive', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    // Must NOT resurrect trashed-only
    expect(mockedFolders.update).not.toHaveBeenCalledWith('trashed-only', expect.objectContaining({ isDeleted: false }))

    // Must create a new folder record instead
    expect(mockedFolders.add).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Archive',
      driveFolderId: 'drive-archive-new',
      isDeleted: false,
    }))
  })

  it('preserves files and folders with unresolved sync when remote parent folder is deleted in Drive', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([
      {
        id: 'folder-p',
        name: 'Parent',
        parentId: null,
        driveFolderId: 'drive-p',
        workspaceType: 'drive',
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
        isDeleted: false,
      },
    ])
    mockedFiles.toArray.mockResolvedValue([
      {
        id: 'file-with-pending-sync',
        name: 'Unsynced Note',
        folderId: 'folder-p',
        type: 'document',
        content: 'Unsynced local text',
        baseContent: '',
        mimeType: 'application/x-mybook-document',
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
        lastSyncedAt: null,
        syncStatus: 'pending',
        isDeleted: false,
      },
      {
        id: 'file-already-synced',
        name: 'Synced Note',
        folderId: 'folder-p',
        type: 'document',
        content: 'Synced text',
        baseContent: 'Synced text',
        mimeType: 'application/x-mybook-document',
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
        lastSyncedAt: '2026-08-22T00:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      },
    ])
    mockUnresolvedSyncQueue([
      {
        id: 'queue-file-1',
        entityId: 'file-with-pending-sync',
        entityType: 'file',
        operation: 'update',
        status: 'pending',
        retryCount: 0,
        createdAt: '',
        updatedAt: '',
        errorMessage: null,
      },
    ])

    // Remote Drive returns empty root folder (Parent was deleted on Drive)
    stubDriveFetch(vi.fn().mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    // Folder is marked deleted
    expect(mockedFolders.update).toHaveBeenCalledWith('folder-p', expect.objectContaining({ isDeleted: true }))

    // Synced file without pending work is deleted
    expect(mockedFiles.update).toHaveBeenCalledWith('file-already-synced', expect.objectContaining({ isDeleted: true }))

    // File with pending work is NOT deleted; instead, it is detached to root so it can still sync!
    expect(mockedFiles.update).toHaveBeenCalledWith('file-with-pending-sync', expect.objectContaining({ folderId: null }))
    expect(mockedFiles.update).not.toHaveBeenCalledWith('file-with-pending-sync', expect.objectContaining({ isDeleted: true }))
  })

  it('terminates safely without stack overflow when Drive folders contain circular references', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])

    // Circular: root -> A -> B -> A
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-a', name: 'Folder A', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-b', name: 'Folder B', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-a', name: 'Folder A', mimeType: 'application/vnd.google-apps.folder' }] }) }))

    await expect(importDriveFoldersToLocal()).resolves.toBeUndefined()
  })

  it('dynamically resolves or creates missing folders in importDriveFilesToLocal so files are not orphaned to root', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])

    // Root has child folder 'Nested' (drive-nested) which has child file 'doc-nested'
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }) // listChildFiles('mybook-root')
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-nested', name: 'Nested', mimeType: 'application/vnd.google-apps.folder' }] }) }) // listChildFolders('mybook-root')
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-file-1', name: 'Nested Doc', mimeType: 'application/x-mybook-document' }] }) }) // listChildFiles('drive-nested')
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Nested content"}]}]}') }) // file content
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })) // listChildFolders('drive-nested')

    await importDriveFilesToLocal()

    // Folder 'Nested' should have been created dynamically in walk
    expect(mockedFolders.add).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Nested',
      driveFolderId: 'drive-nested',
      parentId: null,
    }))

    const createdFolder = mockedFolders.add.mock.calls[0]?.[0] as { id: string }

    // File should have folderId set to the created folder id, NOT null!
    expect(mockedFiles.add).toHaveBeenCalledWith(expect.objectContaining({
      driveFileId: 'drive-file-1',
      name: 'Nested Doc',
      folderId: createdFolder.id,
    }))
  })

  it('moves a Drive file with addParents and removeParents', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ parents: ['old-parent'] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 'file-1', name: 'Notes.docx', parents: ['new-parent'] }) })
    stubDriveFetch(fetchMock)

    await updateDriveFile('file-1', { parentId: 'new-parent' })

    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('addParents=new-parent')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('removeParents=old-parent')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH', body: '{}' })
  })

  it('moves existing Drive-backed documents to their local folder during backup', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.get.mockResolvedValue({
      id: 'folder-1',
      driveFolderId: 'drive-folder',
      name: 'Projects',
      parentId: null,
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      isDeleted: false,
    })
    mockedFiles.get.mockResolvedValue({
      id: 'file-1',
      driveFileId: 'drive-doc',
      name: 'Notes',
      type: 'document',
      folderId: 'folder-1',
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      lastSyncedAt: '2026-08-29T00:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ parents: ['mybook-root'] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 'drive-doc', name: 'Notes.md', modifiedTime: '2026-08-29T10:00:00.000Z' }) })
    stubDriveFetch(fetchMock)

    const result = await backupDocumentToDrive({
      fileId: 'file-1',
      title: 'Notes',
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      folderId: 'folder-1',
    })

    expect(result.success).toBe(true)
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('addParents=drive-folder')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('removeParents=mybook-root')
  })

  it('backs up database blocks through the existing MyBook Markdown upload flow', async () => {
    const content = JSON.stringify({
      type: 'doc',
      content: [{
        type: 'databaseBlock',
        attrs: {
          version: 1,
          id: 'db_drive',
          title: 'Drive Tasks',
          columns: [
            { id: 'col_name', name: 'Name', type: 'text' },
            { id: 'col_date', name: 'Due', type: 'date' },
            {
              id: 'col_select',
              name: 'Priority',
              type: 'select',
              options: [
                { id: 'opt_high', label: 'Urgent 😀', color: 'red' },
                { id: 'opt_low', label: 'Low नमस्ते', color: 'orange' },
              ],
            },
            {
              id: 'col_status',
              name: 'Status',
              type: 'status',
              options: [
                { id: 'opt_todo', label: 'Not started', color: 'gray' },
                { id: 'opt_review', label: 'Review مرحبا', color: 'purple' },
                { id: 'opt_done', label: 'Done', color: 'green' },
              ],
            },
            { id: 'col_done', name: 'Done', type: 'checkbox' },
            { id: 'col_number', name: 'Estimate', type: 'number' },
          ],
          rows: [
            { id: 'row_3', values: { col_name: 'QA', col_number: 3, col_select: 'opt_low', col_status: 'opt_review', col_date: '2026-09-20' } },
            { id: 'row_1', values: { col_name: 'Homepage', col_number: -12.5, col_select: 'opt_high', col_status: 'opt_done', col_date: '2026-09-04', col_done: true } },
            { id: 'row_2', values: { col_name: 'Mobile', col_status: 'opt_todo' } },
          ],
          viewState: {
            sort: { columnId: 'col_date', direction: 'desc' },
            filters: [
              { id: 'filter_priority', columnId: 'col_select', operator: 'is', value: 'opt_high' },
              { id: 'filter_done', columnId: 'col_done', operator: 'isChecked' },
            ],
          },
        },
      }],
    })
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFiles.get.mockResolvedValue({
      id: 'file-1',
      driveFileId: null,
      name: 'Database Note',
      type: 'document',
      folderId: null,
      content,
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: false,
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ id: 'drive-doc', name: 'Database Note.md', modifiedTime: '2026-08-29T10:00:00.000Z' }) })
    stubDriveFetch(fetchMock)

    const result = await backupDocumentToDrive({
      fileId: 'file-1',
      title: 'Database Note',
      content,
      folderId: null,
    })

    expect(result.success).toBe(true)
    const uploadBody = fetchMock.mock.calls[0]?.[1]?.body as Blob
    const uploadText = await uploadBody.text()
    expect(uploadText).toContain('document_id: "file-1"')
    expect(uploadText).toContain(':::database')
    expect(uploadText).toContain('"id": "db_drive"')
    expect(uploadText).toContain('"type": "number"')
    expect(uploadText).toContain('"type": "select"')
    expect(uploadText).toContain('"type": "date"')
    expect(uploadText).toContain('"label": "Urgent 😀"')
    expect(uploadText).toContain('"label": "Low नमस्ते"')
    expect(uploadText).toContain('"label": "Review مرحبا"')
    expect(uploadText).toContain('"color": "orange"')
    expect(uploadText).toContain('"color": "purple"')
    expect(uploadText).toContain('"col_number": -12.5')
    expect(uploadText).toContain('"col_select": "opt_high"')
    expect(uploadText).toContain('"col_date": "2026-09-04"')
    expect(uploadText.indexOf('"id": "col_date"')).toBeLessThan(uploadText.indexOf('"id": "col_select"'))
    expect(uploadText.indexOf('"id": "col_done"')).toBeLessThan(uploadText.indexOf('"id": "col_number"'))
    expect(uploadText.indexOf('"id": "row_3"')).toBeLessThan(uploadText.indexOf('"id": "row_1"'))
    expect(uploadText.indexOf('"id": "row_1"')).toBeLessThan(uploadText.indexOf('"id": "row_2"'))
    expect(uploadText).toContain('"viewState"')
    expect(uploadText).toContain('"sort"')
    expect(uploadText).toContain('"columnId": "col_date"')
    expect(uploadText).toContain('"id": "filter_priority"')
    expect(uploadText).toContain('"value": "opt_high"')
  })

  it('does not mark a document synced when local content changes during upload', async () => {
    const beforeUpload = {
      id: 'file-1',
      driveFileId: 'drive-doc',
      name: 'Race Note',
      type: 'document' as const,
      folderId: null,
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Version A"}]}]}',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      lastSyncedAt: '2026-08-29T00:00:00.000Z',
      syncStatus: 'pending' as const,
      isDeleted: false,
    }
    const changedDuringUpload = {
      ...beforeUpload,
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Version B"}]}]}',
      updatedAt: '2026-08-29T00:01:00.000Z',
      syncStatus: 'pending' as const,
    }
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFiles.get
      .mockResolvedValueOnce(beforeUpload)
      .mockResolvedValueOnce(beforeUpload)
      .mockResolvedValueOnce(changedDuringUpload)
    stubDriveFetch(vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'drive-doc', name: 'Race Note.md', modifiedTime: '2026-08-29T10:00:00.000Z' }),
    }))

    const result = await backupDocumentToDrive({
      fileId: 'file-1',
      title: 'Race Note',
      content: beforeUpload.content,
      folderId: null,
    })

    expect(result.success).toBe(true)
    expect(mockedFiles.update).toHaveBeenLastCalledWith('file-1', expect.objectContaining({
      driveFileId: 'drive-doc',
      syncStatus: 'pending',
    }))
    expect(mockedFiles.update).not.toHaveBeenCalledWith('file-1', expect.objectContaining({
      syncStatus: 'backed-up',
      lastSyncedAt: '2026-08-29T10:00:00.000Z',
    }))
  })

  it('restores portable document IDs during a fresh Drive import', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [
        { id: 'drive-a', name: 'Document A.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' },
        { id: 'drive-b', name: 'Document B.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' },
      ] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ndocument_id: "doc-a"\ntitle: "Document A"\n---\n\nA') })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ndocument_id: "doc-b"\ntitle: "Document B"\n---\n\nB') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.add).toHaveBeenCalledWith(expect.objectContaining({
      id: 'doc-a',
      driveFileId: 'drive-a',
      name: 'Document A',
    }))
    expect(mockedFiles.add).toHaveBeenCalledWith(expect.objectContaining({
      id: 'doc-b',
      driveFileId: 'drive-b',
      name: 'Document B',
    }))
  })

  it('restores two linked documents with stable internal document link targets', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [
        { id: 'drive-a', name: 'Document A.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' },
        { id: 'drive-b', name: 'Document B.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' },
      ] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue([
        '---',
        'mybook_version: 1',
        'type: document',
        'document_id: "doc-a"',
        'title: "Document A"',
        '---',
        '',
        ':::document-link',
        '{',
        '  "targetId": "doc-b",',
        '  "label": "Document B"',
        '}',
        ':::',
      ].join('\n')) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ndocument_id: "doc-b"\ntitle: "Document B"\n---\n\nTarget') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    const addedById = new Map(mockedFiles.add.mock.calls.map((call) => [call[0].id, call[0]]))
    expect(addedById.get('doc-a')).toMatchObject({ driveFileId: 'drive-a', name: 'Document A' })
    expect(addedById.get('doc-b')).toMatchObject({ driveFileId: 'drive-b', name: 'Document B' })
    expect(JSON.parse(String(addedById.get('doc-a')?.content))).toMatchObject({
      type: 'doc',
      content: [{
        type: 'documentLink',
        attrs: {
          targetId: 'doc-b',
          label: 'Document B',
        },
      }],
    })
  })

  it('does not let a conflicting imported document_id overwrite an unrelated local file', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'doc-a',
      driveFileId: null,
      name: 'Existing Local',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: false,
    }])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-other', name: 'Different.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ndocument_id: "doc-a"\ntitle: "Different"\n---\n\nDifferent') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.update).not.toHaveBeenCalledWith('doc-a', expect.anything())
    const added = mockedFiles.add.mock.calls[0]?.[0]
    expect(added).toMatchObject({ driveFileId: 'drive-other', name: 'Different' })
    expect(added?.id).not.toBe('doc-a')
  })

  it('keeps existing Drive-mapped local identity ahead of imported document_id metadata', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'local-existing',
      driveFileId: 'drive-doc',
      name: 'Existing',
      type: 'document',
      folderId: null,
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    }])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-doc', name: 'Existing.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ndocument_id: "doc-from-file"\ntitle: "Existing"\n---\n\nUpdated') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.add).not.toHaveBeenCalled()
    expect(mockedFiles.update).toHaveBeenCalledWith('local-existing', expect.objectContaining({
      driveFileId: 'drive-doc',
      name: 'Existing',
    }))
  })

  it('keeps legacy Drive imports without document_id functional', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-legacy', name: 'Legacy.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ntitle: "Legacy"\n---\n\nLegacy body') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    const added = mockedFiles.add.mock.calls[0]?.[0]
    expect(added).toMatchObject({ driveFileId: 'drive-legacy', name: 'Legacy' })
    expect(added?.id).toBeTypeOf('string')
    expect(added?.id).not.toBe('')
  })

  it('imports file favorite status from Drive appProperties', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-fav-doc', name: 'FavDoc.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z', appProperties: { isFavorite: 'true' } }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ntitle: "FavDoc"\n---\n\nContent') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    const added = mockedFiles.add.mock.calls[0]?.[0]
    expect(added).toMatchObject({ driveFileId: 'drive-fav-doc', name: 'FavDoc', isFavorite: true })
  })

  it('imports database blocks from Drive markdown through the existing import flow', async () => {
    const markdown = [
      '---',
      'mybook_version: 1',
      'type: document',
      'title: "Database Note"',
      '---',
      '',
      ':::database',
      JSON.stringify({
        type: 'databaseBlock',
        attrs: {
          version: 1,
          id: 'db_import',
          title: 'Imported Tasks',
          columns: [
            { id: 'col_name', name: 'Name', type: 'text' },
            { id: 'col_date', name: 'Due', type: 'date' },
            {
              id: 'col_select',
              name: 'Priority',
              type: 'select',
              options: [
                { id: 'opt_high', label: 'Urgent 😀', color: 'red' },
                { id: 'opt_low', label: 'Low नमस्ते', color: 'orange' },
              ],
            },
            {
              id: 'col_status',
              name: 'Status',
              type: 'status',
              options: [
                { id: 'opt_review', label: 'Review مرحبا', color: 'purple' },
                { id: 'opt_done', label: 'Done', color: 'green' },
              ],
            },
            { id: 'col_done', name: 'Done', type: 'checkbox' },
            { id: 'col_number', name: 'Estimate', type: 'number' },
          ],
          rows: [
            { id: 'row_3', values: { col_name: 'QA', col_number: 3, col_select: 'opt_low', col_status: 'opt_review', col_date: '2026-09-20' } },
            { id: 'row_1', values: { col_name: 'Dashboard', col_number: 42, col_select: 'opt_high', col_status: 'opt_done', col_date: '2026-09-04', col_done: false } },
            { id: 'row_2', values: { col_name: 'Mobile' } },
          ],
          viewState: {
            sort: { columnId: 'col_date', direction: 'desc' },
            filters: [
              { id: 'filter_priority', columnId: 'col_select', operator: 'is', value: 'opt_high' },
              { id: 'filter_done', columnId: 'col_done', operator: 'isUnchecked' },
            ],
          },
        },
      }, null, 2),
      ':::',
    ].join('\n')
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'doc-1', name: 'Database Note.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue(markdown) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    const stored = mockedFiles.add.mock.calls[0]?.[0]?.content
    expect(stored).toBeTypeOf('string')
    expect(JSON.parse(String(stored))).toMatchObject({
      type: 'doc',
      content: [{
        type: 'databaseBlock',
        attrs: {
          id: 'db_import',
          columns: [
            { id: 'col_name', name: 'Name', type: 'text' },
            { id: 'col_date', name: 'Due', type: 'date' },
            {
              id: 'col_select',
              name: 'Priority',
              type: 'select',
              options: [
                { id: 'opt_high', label: 'Urgent 😀', color: 'red' },
                { id: 'opt_low', label: 'Low नमस्ते', color: 'orange' },
              ],
            },
            {
              id: 'col_status',
              name: 'Status',
              type: 'status',
              options: [
                { id: 'opt_review', label: 'Review مرحبا', color: 'purple' },
                { id: 'opt_done', label: 'Done', color: 'green' },
              ],
            },
            { id: 'col_done', name: 'Done', type: 'checkbox' },
            { id: 'col_number', name: 'Estimate', type: 'number' },
          ],
          rows: [
            { id: 'row_3', values: { col_name: 'QA', col_number: 3, col_select: 'opt_low', col_status: 'opt_review', col_date: '2026-09-20' } },
            { id: 'row_1', values: { col_name: 'Dashboard', col_number: 42, col_select: 'opt_high', col_status: 'opt_done', col_date: '2026-09-04', col_done: false } },
            { id: 'row_2', values: { col_name: 'Mobile' } },
          ],
          viewState: {
            sort: { columnId: 'col_date', direction: 'desc' },
            filters: [
              { id: 'filter_priority', columnId: 'col_select', operator: 'is', value: 'opt_high' },
              { id: 'filter_done', columnId: 'col_done', operator: 'isUnchecked' },
            ],
          },
        },
      }],
    })
  })

  it('moves Drive folders to the requested parent and removes old parents', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ parents: ['old-parent'] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 'folder-1', name: 'Projects', mimeType: 'application/vnd.google-apps.folder' }) })
    stubDriveFetch(fetchMock)

    await updateDriveFolder('folder-1', { parentId: 'mybook-root' })

    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('addParents=mybook-root')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('removeParents=old-parent')
  })

  it('backs up documents using .md extension while safely stripping legacy .mybook.md', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFiles.get.mockResolvedValue({
      id: 'file-1',
      name: 'Legacy.mybook.md',
      type: 'document',
      folderId: null,
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: false,
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'drive-doc', name: 'Legacy.md', modifiedTime: '2026-08-29T10:00:00.000Z' }),
    })
    stubDriveFetch(fetchMock)

    const result = await backupDocumentToDrive({
      fileId: 'file-1',
      title: 'Legacy.mybook.md',
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      folderId: null,
    })

    expect(result.success).toBe(true)
    const uploadBody = fetchMock.mock.calls[0]?.[1]?.body as Blob
    const uploadText = await uploadBody.text()
    expect(uploadText).toContain('"name":"Legacy.md"')
    expect(uploadText).not.toContain('"name":"Legacy.mybook.md"')
  })

  it('skips attachment directories and image/media files during importDriveFilesToLocal', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])

    // Drive has:
    // 1. Root folder discovery: Writin
    // 2. Root files: Doc1.md, image_rogue.png
    // 3. Doc1.md content fetch
    // 4. Root child folders: "Doc1_attachments" (should be skipped by walk)
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files: [
            { id: 'doc-1', name: 'Doc1.md', mimeType: 'text/markdown', modifiedTime: '2026-08-29T10:00:00.000Z' },
            { id: 'img-1', name: 'image_rogue.png', mimeType: 'image/png', modifiedTime: '2026-08-29T10:00:00.000Z' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue('---\ntitle: "Doc1"\n---\n\nhello'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files: [
            { id: 'att-folder-1', name: 'Doc1_attachments', mimeType: 'application/vnd.google-apps.folder' },
          ],
        }),
      }))

    await importDriveFilesToLocal()

    expect(mockedFiles.add).toHaveBeenCalledTimes(1)
    expect(mockedFiles.add).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Doc1',
      type: 'document',
    }))
    expect(mockedFiles.add).not.toHaveBeenCalledWith(expect.objectContaining({
      name: expect.stringContaining('image_rogue'),
    }))
  })

  it('hydrates relative attachment references into data URLs when importing markdown documents from Drive', async () => {
    stubDriveFetch(vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files: [
            { id: 'doc-1', name: 'Notes.md', mimeType: 'text/markdown', modifiedTime: '2026-08-29T10:00:00.000Z', parents: ['root-folder'] },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue('---\ntitle: "Notes"\n---\n\n![Diagram](./Notes_attachments/media_1.png)'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files: [
            { id: 'att-folder-1', name: 'Notes_attachments', mimeType: 'application/vnd.google-apps.folder' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files: [
            { id: 'img-file-1', name: 'media_1.png', mimeType: 'image/png' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ files: [] }),
      }))

    await importDriveFilesToLocal()

    expect(mockedFiles.add).toHaveBeenCalledTimes(1)
    const addedFile = mockedFiles.add.mock.calls[0]?.[0] as { content: string }
    expect(addedFile.content).toContain('data:image/png;base64,')
    expect(addedFile.content).not.toContain('./Notes_attachments/media_1.png')
  })

  it('imports all files and folders across multiple pages using nextPageToken', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files: [{ id: 'root-folder', name: 'Writin', mimeType: 'application/vnd.google-apps.folder' }],
        }),
      })
      // Page 1 of files
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files: [
            { id: 'doc-p1', name: 'DocPage1.md', mimeType: 'text/markdown', modifiedTime: '2026-08-29T10:00:00.000Z' },
          ],
          nextPageToken: 'token-page-2',
        }),
      })
      // Page 2 of files
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files: [
            { id: 'doc-p2', name: 'DocPage2.md', mimeType: 'text/markdown', modifiedTime: '2026-08-29T10:00:00.000Z' },
          ],
        }),
      })
      // Content of DocPage1
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue('# Doc Page 1'),
      })
      // Content of DocPage2
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue('# Doc Page 2'),
      })
      // Subfolders check
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ files: [] }),
      }))

    await importDriveFilesToLocal()

    expect(mockedFiles.add).toHaveBeenCalledWith(expect.objectContaining({
      name: 'DocPage1',
      driveFileId: 'doc-p1',
    }))
    expect(mockedFiles.add).toHaveBeenCalledWith(expect.objectContaining({
      name: 'DocPage2',
      driveFileId: 'doc-p2',
    }))
  })

  describe('refreshDriveFileToLocal', () => {
    it('returns updated: false when file has no driveFileId', async () => {
      mockedFiles.get.mockResolvedValueOnce({ id: 'local-1', driveFileId: null })
      const result = await refreshDriveFileToLocal('local-1')
      expect(result).toEqual({ updated: false })
    })

    it('skips fetching when drive file is not modified after lastSyncedAt', async () => {
      mockedFiles.get.mockResolvedValueOnce({
        id: 'local-1',
        driveFileId: 'drive-1',
        lastSyncedAt: '2026-10-03T12:00:00.000Z',
      })
      stubDriveFetch(vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'drive-1',
          name: 'MyDoc.md',
          modifiedTime: '2026-10-03T12:00:00.000Z',
          trashed: false,
        }),
      }))

      const result = await refreshDriveFileToLocal('local-1')
      expect(result).toEqual({ updated: false, modifiedTime: '2026-10-03T12:00:00.000Z' })
      expect(mockedFiles.update).not.toHaveBeenCalled()
    })

    it('refreshes document when drive file has newer content', async () => {
      mockedFiles.get.mockResolvedValue({
        id: 'local-1',
        driveFileId: 'drive-1',
        name: 'Old Title',
        type: 'document',
        content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Old"}]}]}',
        baseContent: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Old"}]}]}',
        syncStatus: 'backed-up',
        lastSyncedAt: '2026-10-03T11:00:00.000Z',
      })

      const fetchMock = vi.fn()
        // 1. getDriveFileStatus
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            id: 'drive-1',
            name: 'New Title.md',
            mimeType: 'text/markdown',
            modifiedTime: '2026-10-03T12:00:00.000Z',
            trashed: false,
          }),
        })
        // 2. getDriveFileContent
        .mockResolvedValueOnce({
          ok: true,
          text: vi.fn().mockResolvedValue('# New Title\n\nNew remote text'),
        })

      stubDriveFetch(fetchMock)

      const result = await refreshDriveFileToLocal('local-1')
      expect(result.updated).toBe(true)
      expect(result.modifiedTime).toBe('2026-10-03T12:00:00.000Z')
      expect(mockedFiles.update).toHaveBeenCalledWith('local-1', expect.objectContaining({
        name: 'New Title',
        lastSyncedAt: '2026-10-03T12:00:00.000Z',
        syncStatus: 'backed-up',
      }))
    })

    it('does not overwrite when local has pending sync status', async () => {
      mockedFiles.get.mockResolvedValue({
        id: 'local-1',
        driveFileId: 'drive-1',
        name: 'Old Title',
        type: 'document',
        syncStatus: 'pending',
        lastSyncedAt: '2026-10-03T11:00:00.000Z',
      })

      stubDriveFetch(vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'drive-1',
          name: 'New Title.md',
          modifiedTime: '2026-10-03T12:00:00.000Z',
          trashed: false,
        }),
      }))

      const result = await refreshDriveFileToLocal('local-1')
      expect(result.updated).toBe(false)
      expect(mockedFiles.update).not.toHaveBeenCalled()
    })

    const remoteFetch = () => vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'drive-1', name: 'Doc.md', mimeType: 'text/markdown', modifiedTime: '2026-10-03T12:00:00.000Z', trashed: false }),
      })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('# Doc\n\nRemote edit') })

    it('keeps local edits and records the remote version when both sides changed', async () => {
      mockedFiles.get.mockResolvedValue({
        id: 'local-1', driveFileId: 'drive-1', name: 'Doc', type: 'document', mimeType: 'application/x-mybook-document',
        content: 'local edit', baseContent: 'base', syncStatus: 'pending', lastSyncedAt: '2026-10-03T11:00:00.000Z',
      })
      stubDriveFetch(remoteFetch())

      const result = await refreshDriveFileToLocal('local-1')

      expect(result.updated).toBe(false)
      expect(db.fileVersions.add).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'local-1', source: 'drive', label: 'Remote version (not applied)' }))
      expect(mockedFiles.update).toHaveBeenCalledWith('local-1', { syncConflict: expect.objectContaining({ remoteModifiedTime: '2026-10-03T12:00:00.000Z' }) })
      expect(mockedFiles.update).not.toHaveBeenCalledWith('local-1', expect.objectContaining({ content: expect.anything() }))
    })

    it('defers conflict decisions while keystrokes are not saved yet', async () => {
      mockedFiles.get.mockResolvedValue({
        id: 'local-1', driveFileId: 'drive-1', name: 'Doc', type: 'document', mimeType: 'application/x-mybook-document',
        content: 'base', baseContent: 'base', syncStatus: 'backed-up', lastSyncedAt: '2026-10-03T11:00:00.000Z',
      })
      stubDriveFetch(remoteFetch())
      const unregister = registerUnsavedEditsProbe('local-1', () => true)

      const result = await refreshDriveFileToLocal('local-1')
      unregister()

      expect(result.updated).toBe(false)
      expect(mockedFiles.update).not.toHaveBeenCalledWith('local-1', { syncConflict: expect.anything() })
      expect(db.fileVersions.add).not.toHaveBeenCalled()
      expect(mockedFiles.update).not.toHaveBeenCalledWith('local-1', expect.objectContaining({ content: expect.anything() }))
    })

    it('does not raise the same conflict twice', async () => {
      mockedFiles.get.mockResolvedValue({
        id: 'local-1', driveFileId: 'drive-1', content: 'local edit', baseContent: 'base', syncStatus: 'pending',
        lastSyncedAt: '2026-10-03T11:00:00.000Z',
        syncConflict: { remoteModifiedTime: '2026-10-03T12:00:00.000Z', versionId: 'v1', detectedAt: '2026-10-03T12:00:01.000Z' },
      })
      stubDriveFetch(remoteFetch())

      await refreshDriveFileToLocal('local-1')

      expect(mockedFiles.update).not.toHaveBeenCalled()
    })

    it('clears a stored conflict when its saved remote version matches local content', async () => {
      const sameContent = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"same"}]}]}'
      mockedFiles.get.mockResolvedValue({
        id: 'local-1', driveFileId: 'drive-1', content: sameContent, baseContent: sameContent, syncStatus: 'backed-up',
        lastSyncedAt: '2026-10-03T11:00:00.000Z',
        syncConflict: { remoteModifiedTime: '2026-10-03T12:00:00.000Z', versionId: 'v1', detectedAt: '2026-10-03T12:00:01.000Z' },
      })
      vi.mocked(db.fileVersions.get).mockResolvedValue({ content: sameContent } as never)
      stubDriveFetch(remoteFetch())

      await refreshDriveFileToLocal('local-1')

      expect(mockedFiles.update).toHaveBeenCalledWith('local-1', {
        syncConflict: null,
        baseContent: sameContent,
        lastSyncedAt: '2026-10-03T12:00:00.000Z',
      })
    })

    it('queues an upload and saves pending syncStatus when 3-way merge succeeds', async () => {
      const baseJson = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph 1' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph 2' }] },
        ],
      })
      const localJson = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Local edited 1' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph 2' }] },
        ],
      })

      mockedFiles.get.mockResolvedValue({
        id: 'local-1',
        driveFileId: 'drive-1',
        name: 'Doc',
        type: 'document',
        mimeType: 'application/x-mybook-document',
        content: localJson,
        baseContent: baseJson,
        syncStatus: 'backed-up',
        lastSyncedAt: '2026-10-03T11:00:00.000Z',
      })

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            id: 'drive-1',
            name: 'Doc.md',
            mimeType: 'text/markdown',
            modifiedTime: '2026-10-03T12:00:00.000Z',
            trashed: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: vi.fn().mockResolvedValue('Paragraph 1\n\nRemote edited 2'),
        })

      stubDriveFetch(fetchMock)

      const result = await refreshDriveFileToLocal('local-1')
      expect(result.updated).toBe(true)
      expect(mockedFiles.update).toHaveBeenCalledWith('local-1', expect.objectContaining({
        syncStatus: 'pending',
      }))
      expect(mockedSyncQueue.add).toHaveBeenCalledWith(expect.objectContaining({
        entityId: 'local-1',
        entityType: 'file',
        operation: 'update',
        status: 'pending',
      }))
    })

    it('keeps local edits and queues an upload without marking backed-up when remote content is unchanged from base', async () => {
      const baseJson = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'base content' }] }],
      })
      const localJson = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'local changed' }] }],
      })

      mockedFiles.get.mockResolvedValue({
        id: 'local-1',
        driveFileId: 'drive-1',
        name: 'Doc',
        type: 'document',
        mimeType: 'application/x-mybook-document',
        content: localJson,
        baseContent: baseJson,
        syncStatus: 'backed-up',
        lastSyncedAt: '2026-10-03T11:00:00.000Z',
      })

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            id: 'drive-1',
            name: 'Doc.md',
            mimeType: 'text/markdown',
            modifiedTime: '2026-10-03T12:00:00.000Z',
            trashed: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: vi.fn().mockResolvedValue('base content'),
        })

      stubDriveFetch(fetchMock)

      const result = await refreshDriveFileToLocal('local-1')
      expect(result.updated).toBe(false)
      expect(mockedFiles.update).toHaveBeenCalledWith('local-1', expect.objectContaining({
        syncStatus: 'pending',
      }))
      expect(mockedFiles.update).not.toHaveBeenCalledWith('local-1', expect.objectContaining({
        syncStatus: 'backed-up',
      }))
      expect(mockedSyncQueue.add).toHaveBeenCalledWith(expect.objectContaining({
        entityId: 'local-1',
        entityType: 'file',
        operation: 'update',
        status: 'pending',
      }))
    })

    it('does not show a conflict when a second locally saved edit is pending and Drive still has the last synced version', async () => {
      const syncedJson = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'first edit already synced' }] }],
      })
      const secondEditJson = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'first edit already synced, now a second edit' }] }],
      })

      mockedFiles.get.mockResolvedValue({
        id: 'local-1',
        driveFileId: 'drive-1',
        name: 'Doc',
        type: 'document',
        mimeType: 'application/x-mybook-document',
        content: secondEditJson,
        baseContent: syncedJson,
        syncStatus: 'pending',
        lastSyncedAt: '2026-10-03T11:00:00.000Z',
      })

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            id: 'drive-1',
            name: 'Doc.md',
            mimeType: 'text/markdown',
            modifiedTime: '2026-10-03T12:00:00.000Z',
            trashed: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: vi.fn().mockResolvedValue('first edit already synced'),
        })
      stubDriveFetch(fetchMock)

      const result = await refreshDriveFileToLocal('local-1')

      expect(result.updated).toBe(false)
      expect(db.fileVersions.add).not.toHaveBeenCalled()
      expect(mockedFiles.update).not.toHaveBeenCalledWith('local-1', { syncConflict: expect.anything() })
      expect(mockedFiles.update).toHaveBeenCalledWith('local-1', expect.objectContaining({ syncStatus: 'pending' }))
      expect(mockedSyncQueue.add).toHaveBeenCalledWith(expect.objectContaining({
        entityId: 'local-1',
        entityType: 'file',
        operation: 'update',
        status: 'pending',
      }))
    })

    it('preserves pending local typing when initial remote upload is empty document without raising conflict on new document', async () => {
      const localJson = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello new document' }] }],
      })

      mockedFiles.get.mockResolvedValue({
        id: 'local-new',
        driveFileId: 'drive-new',
        name: 'Untitled',
        type: 'document',
        mimeType: 'application/x-mybook-document',
        content: localJson,
        baseContent: undefined,
        syncStatus: 'pending',
        lastSyncedAt: '2026-10-03T11:00:00.000Z',
      })

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            id: 'drive-new',
            name: 'Untitled.md',
            mimeType: 'text/markdown',
            modifiedTime: '2026-10-03T12:00:00.000Z',
            trashed: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: vi.fn().mockResolvedValue(''), // Initial empty markdown upload on Drive
        })

      stubDriveFetch(fetchMock)

      const result = await refreshDriveFileToLocal('local-new')

      expect(result.updated).toBe(false)
      // Must NOT record a conflict
      expect(db.fileVersions.add).not.toHaveBeenCalled()
      expect(mockedFiles.update).not.toHaveBeenCalledWith('local-new', expect.objectContaining({
        syncConflict: expect.anything(),
      }))
      // Must advance lastSyncedAt to remote's timestamp and preserve pending sync status
      expect(mockedFiles.update).toHaveBeenCalledWith('local-new', expect.objectContaining({
        lastSyncedAt: '2026-10-03T12:00:00.000Z',
        syncStatus: 'pending',
      }))
      // Must enqueue upload for the local edits
      expect(mockedSyncQueue.add).toHaveBeenCalledWith(expect.objectContaining({
        entityId: 'local-new',
        entityType: 'file',
        operation: 'update',
        status: 'pending',
      }))
    })

    it('does not create conflict records across repeated reconciliation cycles on newly created documents', async () => {
      mockedFiles.get.mockResolvedValue({
        id: 'local-new-2',
        driveFileId: 'drive-new-2',
        name: 'Untitled',
        type: 'document',
        mimeType: 'application/x-mybook-document',
        content: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Typing more...' }] }],
        }),
        baseContent: undefined,
        syncStatus: 'pending',
        lastSyncedAt: '2026-10-03T12:00:00.000Z',
      })

      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'drive-new-2',
          name: 'Untitled.md',
          mimeType: 'text/markdown',
          modifiedTime: '2026-10-03T12:00:00.000Z',
          trashed: false,
        }),
      })

      stubDriveFetch(fetchMock)

      const result = await refreshDriveFileToLocal('local-new-2')

      expect(result.updated).toBe(false)
      expect(db.fileVersions.add).not.toHaveBeenCalled()
      expect(mockedFiles.update).not.toHaveBeenCalled()
    })

    it('skips refresh when file is actively in backing-up state', async () => {
      mockedFiles.get.mockResolvedValue({
        id: 'local-backing-up',
        driveFileId: 'drive-backing-up',
        name: 'Untitled',
        type: 'document',
        mimeType: 'application/x-mybook-document',
        content: 'typing...',
        syncStatus: 'backing-up',
      })

      const result = await refreshDriveFileToLocal('local-backing-up')
      expect(result.updated).toBe(false)
      expect(db.fileVersions.add).not.toHaveBeenCalled()
    })

    it('waits for an active in-flight backup before refreshing, avoiding false conflicts from self-upload', async () => {
      let fileState = {
        id: 'file-race-1',
        driveFileId: 'drive-race-1',
        name: 'RaceDoc',
        type: 'document' as const,
        mimeType: 'application/x-mybook-document',
        content: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Uploaded text' }] }],
        }),
        baseContent: undefined,
        syncStatus: 'pending' as const,
        lastSyncedAt: '2026-10-03T10:00:00.000Z',
        folderId: null,
        isFavorite: false,
        isDeleted: false,
      }

      mockedFiles.get.mockImplementation(((id: string) => Promise.resolve(id === 'file-race-1' ? { ...fileState } : null)) as never)
      mockedFiles.update.mockImplementation(((id: string, patch: Record<string, unknown>) => {
        if (id === 'file-race-1') {
          fileState = { ...fileState, ...patch }
        }
        return Promise.resolve(1)
      }) as never)
      mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'folder-root', updatedAt: '2026-07-24T00:00:00.000Z' })
      mockedGetState.mockReturnValue({ getAccessToken: vi.fn().mockResolvedValue('test-token') } as never)

      let resolveUploadFetch!: (val: unknown) => void
      const uploadFetchPromise = new Promise((res) => { resolveUploadFetch = res })

      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('upload/drive/v3/files') || url.includes('uploadType=multipart')) {
          return uploadFetchPromise
        }
        if (url.includes('drive/v3/files/drive-race-1?alt=media')) {
          return Promise.resolve({
            ok: true,
            text: async () => '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Uploaded text"}]}]}',
          })
        }
        if (url.includes('drive/v3/files/drive-race-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 'drive-race-1',
              name: 'RaceDoc.md',
              mimeType: 'text/markdown',
              modifiedTime: '2026-10-03T12:00:00.000Z',
              trashed: false,
            }),
          })
        }
        if (url.includes('folder-root')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 'folder-root',
              name: 'Writin',
              mimeType: 'application/vnd.google-apps.folder',
              trashed: false,
            }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}), text: async () => '' })
      })
      stubDriveFetch(fetchMock)

      // 1. Initiate backup - this registers in backupFlights and stays unresolved
      const backupPromise = backupDocumentToDrive({
        fileId: 'file-race-1',
        title: 'RaceDoc',
        content: fileState.content,
        folderId: null,
      })

      // 2. Start refreshDriveFileToLocal while backup is still in flight
      let refreshDone = false
      const refreshPromise = refreshDriveFileToLocal('file-race-1').then((res) => {
        refreshDone = true
        return res
      })

      // Allow microtasks to run and verify refresh is suspended waiting for active backup
      await new Promise((res) => setTimeout(res, 20))
      expect(refreshDone).toBe(false)

      // 3. Resolve the backup upload fetch
      resolveUploadFetch({
        ok: true,
        json: async () => ({
          id: 'drive-race-1',
          name: 'RaceDoc.md',
          modifiedTime: '2026-10-03T12:00:00.000Z',
        }),
      })

      const backupResult = await backupPromise
      expect(backupResult.success).toBe(true)
      expect(fileState.syncStatus).toBe('backed-up')
      expect(fileState.lastSyncedAt).toBe('2026-10-03T12:00:00.000Z')

      // 4. Now refresh finishes because backup unblocked it
      const refreshResult = await refreshPromise
      expect(refreshDone).toBe(true)
      expect(refreshResult.updated).toBe(false)
      expect(refreshResult.modifiedTime).toBe('2026-10-03T12:00:00.000Z')
      expect(db.fileVersions.add).not.toHaveBeenCalled()
    })

    it('releases backupFlights coordination entry even when backup fails or rejects', async () => {
      const fileState = {
        id: 'file-fail-1',
        driveFileId: 'drive-fail-1',
        name: 'FailDoc',
        type: 'document' as const,
        mimeType: 'application/x-mybook-document',
        content: '{"type":"doc","content":[{"type":"paragraph"}]}',
        syncStatus: 'pending' as const,
        lastSyncedAt: '2026-10-03T10:00:00.000Z',
        folderId: null,
        isFavorite: false,
        isDeleted: false,
      }

      mockedFiles.get.mockImplementation(((id: string) => Promise.resolve(id === 'file-fail-1' ? { ...fileState } : null)) as never)
      mockedFiles.update.mockImplementation(((id: string, patch: Record<string, unknown>) => {
        if (id === 'file-fail-1') Object.assign(fileState, patch)
        return Promise.resolve(1)
      }) as never)
      mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'folder-root', updatedAt: '2026-07-24T00:00:00.000Z' })
      mockedGetState.mockReturnValue({ getAccessToken: vi.fn().mockResolvedValue('test-token') } as never)

      let rejectUploadFetch!: (err: Error) => void
      const uploadFetchPromise = new Promise((_, rej) => { rejectUploadFetch = rej })

      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('upload/drive/v3/files') || url.includes('uploadType=multipart')) {
          return uploadFetchPromise
        }
        if (url.includes('folder-root')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 'folder-root',
              name: 'Writin',
              mimeType: 'application/vnd.google-apps.folder',
              trashed: false,
            }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'drive-fail-1',
            name: 'FailDoc.md',
            mimeType: 'text/markdown',
            modifiedTime: '2026-10-03T10:00:00.000Z',
            trashed: false,
          }),
        })
      })
      stubDriveFetch(fetchMock)

      // Start backup
      const backupPromise = backupDocumentToDrive({
        fileId: 'file-fail-1',
        title: 'FailDoc',
        content: fileState.content,
        folderId: null,
      })

      // Start refresh while backup is in flight
      let refreshDone = false
      const refreshPromise = refreshDriveFileToLocal('file-fail-1').then((res) => {
        refreshDone = true
        return res
      })

      await new Promise((res) => setTimeout(res, 10))
      expect(refreshDone).toBe(false)

      // Reject the backup fetch
      rejectUploadFetch(new Error('Network disconnected'))

      const backupRes = await backupPromise
      expect(backupRes.success).toBe(false)

      // The refresh should catch the backup failure and proceed safely without throwing
      const refreshRes = await refreshPromise
      expect(refreshDone).toBe(true)
      expect(refreshRes.updated).toBe(false)

      // Verify coordination entry was released: a subsequent refresh runs without awaiting stale promise
      const subsequentRefresh = await refreshDriveFileToLocal('file-fail-1')
      expect(subsequentRefresh.updated).toBe(false)
    })
  })
})
