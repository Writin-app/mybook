import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from './db'
import { clearAccountDriveCache, fileRepository, folderRepository, nextFileName, onClearAccountDriveCache, processPendingDriveFolderSync, processPendingDriveSync, queueLocalItemsForDriveBackup, uniqueFileName } from './repositories'
import { backupDocumentToDrive, backupSpreadsheetToDrive, ensureMyBookDriveFolder, ensureVisibleFolderInParent, permanentlyDeleteDriveFile, restoreDriveFolder, trashDriveFolder } from '../services/googleDrive'
import { keepLocalVersion, recordRemoteConflict } from '../services/syncConflicts'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

vi.mock('../services/googleDrive', () => ({
  backupDocumentToDrive: vi.fn().mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: true }),
  backupSpreadsheetToDrive: vi.fn().mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: true }),
  ensureMyBookDriveFolder: vi.fn().mockResolvedValue({ success: false, error: 'offline' }),
  ensureVisibleFolderInParent: vi.fn(),
  permanentlyDeleteDriveFile: vi.fn(),
  restoreDriveFile: vi.fn(), restoreDriveFolder: vi.fn(), trashDriveFile: vi.fn(), trashDriveFolder: vi.fn(),
  updateDriveFolder: vi.fn(),
}))

describe('IndexedDB repositories', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(backupDocumentToDrive).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: true })
    vi.mocked(backupSpreadsheetToDrive).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: true })
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: false, error: 'offline' })
    vi.mocked(ensureVisibleFolderInParent).mockReset()
    await db.delete()
    await db.open()
    vi.stubGlobal('navigator', { onLine: false })
    useWorkspaceStore.setState({ mode: null })
  })

  it('creates, renames, deletes, and restores a file locally', async () => {
    const created = await fileRepository.create('document')
    expect(created.success).toBe(true)
    const id = created.data!.id
    expect((await fileRepository.update(id, { name: 'Meeting Notes' })).success).toBe(true)
    expect((await fileRepository.update(id, { content: 'local content' })).success).toBe(true)
    expect((await fileRepository.delete(id)).success).toBe(true)
    expect((await fileRepository.restore(id)).success).toBe(true)
    expect((await fileRepository.get(id)).data).toMatchObject({ name: 'Meeting Notes', content: 'local content', isDeleted: false })
  })

  it('creates files with unique default names in the same folder', async () => {
    const firstDocument = await fileRepository.create('document')
    const secondDocument = await fileRepository.create('document')
    const firstSpreadsheet = await fileRepository.create('spreadsheet')
    const secondSpreadsheet = await fileRepository.create('spreadsheet')

    expect(firstDocument.data?.name).toBe('Untitled')
    expect(secondDocument.data?.name).toBe('Untitled 2')
    expect(firstSpreadsheet.data?.name).toBe('Untitled Spreadsheet')
    expect(secondSpreadsheet.data?.name).toBe('Untitled Spreadsheet 2')

    const files = await fileRepository.list()
    expect(files.map((file) => file.name).sort()).toEqual([
      'Untitled',
      'Untitled 2',
      'Untitled Spreadsheet',
      'Untitled Spreadsheet 2',
    ])
  })

  it('checks file name availability and rejects renaming to duplicate name', async () => {
    const first = await fileRepository.create('document')
    const second = await fileRepository.create('document')
    await fileRepository.update(first.data!.id, { name: 'Quarterly Report' })

    // Name availability checks
    expect(await fileRepository.isNameAvailable('Quarterly Report', null)).toBe(false)
    expect(await fileRepository.isNameAvailable('quarterly report', null)).toBe(false)
    expect(await fileRepository.isNameAvailable('Quarterly Report', null, first.data!.id)).toBe(true)
    expect(await fileRepository.isNameAvailable('Different Report', null)).toBe(true)

    // Rejects renaming second to first's name
    const updateResult = await fileRepository.update(second.data!.id, { name: 'Quarterly Report' })
    expect(updateResult.success).toBe(false)
    expect(updateResult.error).toBe('A file with this name already exists here.')
  })

  it('generates unique file names using uniqueFileName and nextFileName', async () => {
    const first = await fileRepository.create('document')
    await fileRepository.update(first.data!.id, { name: 'Imported Doc' })

    expect(await uniqueFileName('Imported Doc', null)).toBe(false)
    expect(await uniqueFileName('Imported Doc', null, first.data!.id)).toBe(true)
    expect(await uniqueFileName('Unique Doc', null)).toBe(true)

    expect(await nextFileName('Imported Doc', null)).toBe('Imported Doc 2')
    expect(await nextFileName('Unique Doc', null)).toBe('Unique Doc')
  })

  it('creates nested folders and queues offline Drive work', async () => {
    const parent = await folderRepository.create('Projects')
    const child = await folderRepository.create('2026', parent.data!.id)
    expect(child.data?.parentId).toBe(parent.data?.id)
    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(2)
    await processPendingDriveFolderSync()
    expect((await db.syncQueue.toArray())[0]?.status).toBe('pending')
  })

  it('allows infinite nested folder creation beyond four levels without depth restriction', async () => {
    const l1 = await folderRepository.create('Level 1')
    const l2 = await folderRepository.create('Level 2', l1.data!.id)
    const l3 = await folderRepository.create('Level 3', l2.data!.id)
    const l4 = await folderRepository.create('Level 4', l3.data!.id)
    const l5 = await folderRepository.create('Level 5', l4.data!.id)
    const l6 = await folderRepository.create('Level 6', l5.data!.id)

    expect(l4.success).toBe(true)
    expect(l5.success).toBe(true)
    expect(l6.success).toBe(true)
    expect(l6.data?.parentId).toBe(l5.data?.id)

    // Verify moving deeply nested folders succeeds
    const anotherRoot = await folderRepository.create('Another Root')
    const moveResult = await folderRepository.update(l1.data!.id, { parentId: anotherRoot.data!.id })
    expect(moveResult.success).toBe(true)
  })

  it('does not queue Drive work for a local workspace', async () => {
    useWorkspaceStore.setState({ mode: 'local' })

    const file = await fileRepository.create('document')
    const folder = await folderRepository.create('Local folder')
    await fileRepository.update(file.data!.id, { content: '{"type":"doc","content":[{"type":"paragraph"}]}', folderId: folder.data!.id })

    expect(file.data?.syncStatus).toBe('local')
    expect((await db.files.get(file.data!.id))?.syncStatus).toBe('local')
    expect(await db.syncQueue.toArray()).toHaveLength(0)
    expect(ensureMyBookDriveFolder).not.toHaveBeenCalled()
  })

  it('hides cached Drive files and folders in local workspace mode', async () => {
    const now = new Date().toISOString()
    await db.folders.bulkAdd([
      { id: 'drive-folder', driveFolderId: 'drive-folder-id', name: 'Drive folder', parentId: null, createdAt: now, updatedAt: now, isDeleted: false },
      { id: 'local-folder', driveFolderId: null, workspaceType: 'local', name: 'Local folder', parentId: null, createdAt: now, updatedAt: now, isDeleted: false },
    ])
    await db.files.bulkAdd([
      { id: 'drive-file', driveFileId: 'drive-file-id', name: 'Drive file', type: 'document', folderId: null, content: '', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: now, syncStatus: 'backed-up', isDeleted: false },
      { id: 'local-file', driveFileId: null, workspaceType: 'local', name: 'Local file', type: 'document', folderId: null, content: '', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: null, syncStatus: 'local', isDeleted: false },
    ])

    useWorkspaceStore.setState({ mode: 'local' })

    expect((await fileRepository.list()).map((file) => file.id)).toEqual(['local-file'])
    expect((await folderRepository.list()).map((folder) => folder.id)).toEqual(['local-folder'])
    expect((await fileRepository.get('drive-file')).data).toBeUndefined()
    expect((await folderRepository.get('drive-folder')).data).toBeUndefined()
  })

  it('treats legacy unmarked rows as Drive workspace items', async () => {
    const now = new Date().toISOString()
    await db.files.add({ id: 'legacy-drive-file', driveFileId: 'drive-file-id', name: 'Drive file', type: 'document', folderId: null, content: '', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: now, syncStatus: 'backed-up', isDeleted: false })

    useWorkspaceStore.setState({ mode: 'drive' })

    expect((await fileRepository.list()).map((file) => file.id)).toEqual(['legacy-drive-file'])
  })

  it('does not wait for Drive sync before completing a local content update', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })
    const now = new Date().toISOString()
    await db.files.add({
      id: 'drive-file',
      driveFileId: null,
      workspaceType: 'drive',
      name: 'Drive file',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: false,
    })

    await expect(fileRepository.update('drive-file', { content: 'changed', syncStatus: 'pending' })).resolves.toEqual({ success: true })
    expect((await db.files.get('drive-file'))?.content).toBe('changed')
    expect((await db.syncQueue.toArray())).toHaveLength(1)
    await processPendingDriveFolderSync()
  })

  it('creates a Drive workspace file locally and queues before Drive work completes', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })

    const created = await fileRepository.create('document')

    expect(created.success).toBe(true)
    expect(created.data).toMatchObject({ name: 'Untitled', driveFileId: null, syncStatus: 'pending' })
    expect(await db.files.get(created.data!.id)).toMatchObject({ id: created.data!.id, name: 'Untitled' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'file', entityId: created.data!.id, operation: 'create' }])
    await processPendingDriveFolderSync()
  })

  it('deletes a Drive workspace file locally before slow Drive trash completes', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const now = new Date().toISOString()
    await db.files.add({
      id: 'drive-file',
      driveFileId: 'drive-file-id',
      workspaceType: 'drive',
      name: 'Drive file',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
      syncStatus: 'backed-up',
      isDeleted: false,
    })

    const deleted = await fileRepository.delete('drive-file')

    expect(deleted.success).toBe(true)
    expect(await db.files.get('drive-file')).toMatchObject({ isDeleted: true })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'file', entityId: 'drive-file', operation: 'delete' }])
    await processPendingDriveFolderSync()
  })

  it('renames a Drive workspace folder locally before slow Drive update completes', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const now = new Date().toISOString()
    await db.folders.add({
      id: 'folder-1',
      driveFolderId: 'drive-folder',
      workspaceType: 'drive',
      name: 'Projects',
      parentId: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })

    const renamed = await folderRepository.update('folder-1', { name: 'Projects 2026' })

    expect(renamed.success).toBe(true)
    expect(await db.folders.get('folder-1')).toMatchObject({ name: 'Projects 2026' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'folder', entityId: 'folder-1', operation: 'update' }])
    await processPendingDriveFolderSync()
  })

  it('queues local workspace files when switching to Drive backup', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const file = await fileRepository.create('document')
    const folder = await folderRepository.create('Local folder')
    expect(await db.syncQueue.toArray()).toHaveLength(0)

    useWorkspaceStore.setState({ mode: 'drive' })
    await queueLocalItemsForDriveBackup()

    expect((await db.files.get(file.data!.id))?.syncStatus).toBe('pending')
    expect((await db.syncQueue.toArray()).map((item) => `${item.entityType}:${item.entityId}`).sort()).toEqual([
      `file:${file.data!.id}`,
      `folder:${folder.data!.id}`,
    ])
  })

  it('queues nested Drive folder creation locally before Drive folder creation completes', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })
    vi.mocked(ensureVisibleFolderInParent)
      .mockResolvedValueOnce({ id: 'drive-parent', name: 'Projects', mimeType: 'application/vnd.google-apps.folder' })
      .mockResolvedValueOnce({ id: 'drive-child', name: '2026', mimeType: 'application/vnd.google-apps.folder' })

    const parent = await folderRepository.create('Projects')
    const child = await folderRepository.create('2026', parent.data!.id)

    expect(parent.data).toMatchObject({ name: 'Projects', driveFolderId: null })
    expect(child.data).toMatchObject({ name: '2026', parentId: parent.data!.id, driveFolderId: null })
    expect(await db.syncQueue.toArray()).toHaveLength(2)

    await processPendingDriveFolderSync()

    expect(ensureVisibleFolderInParent).toHaveBeenNthCalledWith(1, 'Projects', 'mybook-root')
    expect(ensureVisibleFolderInParent).toHaveBeenNthCalledWith(2, '2026', 'drive-parent')
    expect((await db.folders.get(child.data!.id))?.driveFolderId).toBe('drive-child')
  })

  it('moves a folder hierarchy to Trash and hides descendants from the active workspace', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const parent = (await folderRepository.create('Projects')).data!
    const child = (await folderRepository.create('Assets', parent.id)).data!
    const file = (await fileRepository.create('document', child.id)).data!

    const deleted = await folderRepository.delete(parent.id)

    expect(deleted.success).toBe(true)
    expect(await db.folders.get(parent.id)).toMatchObject({ isDeleted: true })
    expect(await db.folders.get(child.id)).toMatchObject({ isDeleted: true })
    expect(await db.files.get(file.id)).toMatchObject({ isDeleted: true })
    expect((await folderRepository.list()).map((folder) => folder.id)).toEqual([])
    expect((await fileRepository.list()).map((item) => item.id)).toEqual([])
    expect((await folderRepository.list(true)).map((folder) => folder.id).sort()).toEqual([child.id, parent.id].sort())
  })

  it('restores a trashed folder hierarchy to its original active parent', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const root = (await folderRepository.create('Work')).data!
    const parent = (await folderRepository.create('Projects', root.id)).data!
    const child = (await folderRepository.create('Assets', parent.id)).data!
    const file = (await fileRepository.create('document', child.id)).data!

    await folderRepository.delete(parent.id)
    const restored = await folderRepository.restore(parent.id)

    expect(restored.success).toBe(true)
    expect(await db.folders.get(parent.id)).toMatchObject({ isDeleted: false, parentId: root.id })
    expect(await db.folders.get(child.id)).toMatchObject({ isDeleted: false, parentId: parent.id })
    expect(await db.files.get(file.id)).toMatchObject({ isDeleted: false, folderId: child.id })
  })

  it('restores a folder to root when its original parent is missing', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const parent = (await folderRepository.create('Work')).data!
    const child = (await folderRepository.create('Projects', parent.id)).data!

    await folderRepository.delete(child.id)
    await db.folders.delete(parent.id)
    const restored = await folderRepository.restore(child.id)

    expect(restored.success).toBe(true)
    expect(await db.folders.get(child.id)).toMatchObject({ isDeleted: false, parentId: null })
  })

  it('restores a folder to root when its original parent remains trashed', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const parent = (await folderRepository.create('Work')).data!
    const child = (await folderRepository.create('Projects', parent.id)).data!

    await folderRepository.delete(parent.id)
    const restored = await folderRepository.restore(child.id)

    expect(restored.success).toBe(true)
    expect(await db.folders.get(parent.id)).toMatchObject({ isDeleted: true })
    expect(await db.folders.get(child.id)).toMatchObject({ isDeleted: false, parentId: null })
  })

  it('permanently deletes a trashed folder hierarchy locally', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const parent = (await folderRepository.create('Projects')).data!
    const child = (await folderRepository.create('Assets', parent.id)).data!
    const file = (await fileRepository.create('document', child.id)).data!
    await folderRepository.delete(parent.id)

    const deleted = await folderRepository.permanentlyDelete(parent.id)

    expect(deleted.success).toBe(true)
    expect(await db.folders.get(parent.id)).toBeUndefined()
    expect(await db.folders.get(child.id)).toBeUndefined()
    expect(await db.files.get(file.id)).toBeUndefined()
  })

  it('queues durable Drive file permanent delete before final local cleanup', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.files.add({
      id: 'file-1',
      driveFileId: 'drive-file-1',
      workspaceType: 'drive',
      name: 'Old notes',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
      syncStatus: 'backed-up',
      isDeleted: true,
    })

    const deleted = await fileRepository.permanentlyDelete('file-1')

    expect(deleted.success).toBe(true)
    expect(await db.files.get('file-1')).toMatchObject({ isDeleted: true, driveFileId: 'drive-file-1', syncStatus: 'pending' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'file', entityId: 'file-1', operation: 'permanent-delete' }])
    expect(permanentlyDeleteDriveFile).not.toHaveBeenCalled()
  })

  it('finalizes local file cleanup after Drive permanent delete succeeds', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.files.add({
      id: 'file-1',
      driveFileId: 'drive-file-1',
      workspaceType: 'drive',
      name: 'Old notes',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
      syncStatus: 'backed-up',
      isDeleted: true,
    })
    vi.mocked(permanentlyDeleteDriveFile).mockResolvedValue(undefined)

    await fileRepository.permanentlyDelete('file-1')
    await processPendingDriveFolderSync()

    expect(permanentlyDeleteDriveFile).toHaveBeenCalledWith('drive-file-1')
    expect(await db.files.get('file-1')).toBeUndefined()
    expect(await db.syncQueue.toArray()).toHaveLength(0)
  })

  it('keeps Drive file permanent delete retryable after transient failure', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.files.add({
      id: 'file-1',
      driveFileId: 'drive-file-1',
      workspaceType: 'drive',
      name: 'Old notes',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
      syncStatus: 'backed-up',
      isDeleted: true,
    })
    vi.mocked(permanentlyDeleteDriveFile).mockRejectedValue(new Error('temporary outage'))

    await fileRepository.permanentlyDelete('file-1')
    await processPendingDriveFolderSync()

    expect(await db.files.get('file-1')).toMatchObject({ isDeleted: true, syncStatus: 'failed', syncError: 'temporary outage' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'file', entityId: 'file-1', operation: 'permanent-delete', status: 'failed', errorMessage: 'temporary outage' }])
  })

  it('deletes local workspace files without queueing Drive permanent delete', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const file = (await fileRepository.create('document')).data!
    await fileRepository.delete(file.id)

    const deleted = await fileRepository.permanentlyDelete(file.id)

    expect(deleted.success).toBe(true)
    expect(await db.files.get(file.id)).toBeUndefined()
    expect(await db.syncQueue.toArray()).toHaveLength(0)
    expect(permanentlyDeleteDriveFile).not.toHaveBeenCalled()
  })

  it('queues only root Drive folder permanent delete before final subtree cleanup', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.folders.bulkAdd([
      { id: 'folder-parent', driveFolderId: 'drive-parent', workspaceType: 'drive', name: 'Projects', parentId: null, createdAt: now, updatedAt: now, isDeleted: true },
      { id: 'folder-child', driveFolderId: 'drive-child', workspaceType: 'drive', name: 'Assets', parentId: 'folder-parent', createdAt: now, updatedAt: now, isDeleted: true },
    ])
    await db.files.add({ id: 'file-child', driveFileId: 'drive-file-child', workspaceType: 'drive', name: 'Budget', type: 'document', folderId: 'folder-child', content: '', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: now, syncStatus: 'backed-up', isDeleted: true })

    const deleted = await folderRepository.permanentlyDelete('folder-parent')

    expect(deleted.success).toBe(true)
    expect(await db.folders.get('folder-parent')).toMatchObject({ isDeleted: true, driveFolderId: 'drive-parent' })
    expect(await db.folders.get('folder-child')).toMatchObject({ isDeleted: true, driveFolderId: 'drive-child' })
    expect(await db.files.get('file-child')).toMatchObject({ isDeleted: true, driveFileId: 'drive-file-child' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'folder', entityId: 'folder-parent', operation: 'permanent-delete' }])
    expect(permanentlyDeleteDriveFile).not.toHaveBeenCalled()
  })

  it('finalizes local folder subtree cleanup after root Drive hard delete succeeds', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.folders.bulkAdd([
      { id: 'folder-parent', driveFolderId: 'drive-parent', workspaceType: 'drive', name: 'Projects', parentId: null, createdAt: now, updatedAt: now, isDeleted: true },
      { id: 'folder-child', driveFolderId: 'drive-child', workspaceType: 'drive', name: 'Assets', parentId: 'folder-parent', createdAt: now, updatedAt: now, isDeleted: true },
    ])
    await db.files.add({ id: 'file-child', driveFileId: 'drive-file-child', workspaceType: 'drive', name: 'Budget', type: 'document', folderId: 'folder-child', content: '', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: now, syncStatus: 'backed-up', isDeleted: true })
    vi.mocked(permanentlyDeleteDriveFile).mockResolvedValue(undefined)

    await folderRepository.permanentlyDelete('folder-parent')
    await processPendingDriveFolderSync()

    expect(permanentlyDeleteDriveFile).toHaveBeenCalledTimes(1)
    expect(permanentlyDeleteDriveFile).toHaveBeenCalledWith('drive-parent')
    expect(await db.folders.get('folder-parent')).toBeUndefined()
    expect(await db.folders.get('folder-child')).toBeUndefined()
    expect(await db.files.get('file-child')).toBeUndefined()
    expect(await db.syncQueue.toArray()).toHaveLength(0)
  })

  it('keeps Drive folder permanent delete retryable after permission failure', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.folders.add({ id: 'folder-parent', driveFolderId: 'drive-parent', workspaceType: 'drive', name: 'Projects', parentId: null, createdAt: now, updatedAt: now, isDeleted: true })
    vi.mocked(permanentlyDeleteDriveFile).mockRejectedValue(new Error('insufficient permissions'))

    await folderRepository.permanentlyDelete('folder-parent')
    await processPendingDriveFolderSync()

    expect(await db.folders.get('folder-parent')).toMatchObject({ isDeleted: true, driveFolderId: 'drive-parent' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'folder', entityId: 'folder-parent', operation: 'permanent-delete', status: 'failed', errorMessage: 'insufficient permissions' }])
  })

  it('coalesces pending update and failed soft delete into permanent delete intent', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.files.add({ id: 'file-1', driveFileId: 'drive-file-1', workspaceType: 'drive', name: 'Old notes', type: 'document', folderId: null, content: 'draft', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: now, syncStatus: 'failed', syncError: 'soft delete failed', isDeleted: true })
    await db.syncQueue.add({ id: 'queue-1', entityId: 'file-1', entityType: 'file', operation: 'delete', status: 'failed', retryCount: 1, createdAt: now, updatedAt: now, errorMessage: 'soft delete failed' })

    const deleted = await fileRepository.permanentlyDelete('file-1')

    expect(deleted.success).toBe(true)
    expect(await db.syncQueue.toArray()).toMatchObject([{ id: 'queue-1', entityType: 'file', entityId: 'file-1', operation: 'permanent-delete', status: 'pending' }])
  })

  it('keeps Drive folder trash and restore local-first with queued sync operations', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.folders.add({
      id: 'folder-1',
      driveFolderId: 'drive-folder-1',
      workspaceType: 'drive',
      name: 'Projects',
      parentId: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })

    const deleted = await folderRepository.delete('folder-1')

    expect(deleted.success).toBe(true)
    expect(await db.folders.get('folder-1')).toMatchObject({ isDeleted: true, driveFolderId: 'drive-folder-1' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'folder', entityId: 'folder-1', operation: 'delete' }])
    expect(trashDriveFolder).not.toHaveBeenCalled()

    const restored = await folderRepository.restore('folder-1')

    expect(restored.success).toBe(true)
    expect(await db.folders.get('folder-1')).toMatchObject({ isDeleted: false, driveFolderId: 'drive-folder-1' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'folder', entityId: 'folder-1', operation: 'restore' }])
    expect(restoreDriveFolder).not.toHaveBeenCalled()
  })

  it('avoids duplicate names when duplicating files', async () => {
    const source = (await fileRepository.create('document')).data!
    await fileRepository.update(source.id, { name: 'Notes' })
    const first = await fileRepository.duplicate(source.id)
    const second = await fileRepository.duplicate(source.id)
    expect(first.data?.name).toBe('Notes 2')
    expect(second.data?.name).toBe('Notes 3')
  })

  it('favorites and unfavorites files without changing recency or queueing sync', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const file = (await fileRepository.create('document')).data!
    const originalUpdatedAt = (await db.files.get(file.id))!.updatedAt

    await expect(fileRepository.setFavorite(file.id, true)).resolves.toEqual({ success: true })
    expect(await db.files.get(file.id)).toMatchObject({ isFavorite: true, updatedAt: originalUpdatedAt })
    expect(await db.syncQueue.toArray()).toHaveLength(0)

    await expect(fileRepository.setFavorite(file.id, false)).resolves.toEqual({ success: true })
    expect(await db.files.get(file.id)).toMatchObject({ isFavorite: false, updatedAt: originalUpdatedAt })
    expect(await db.syncQueue.toArray()).toHaveLength(0)
  })

  it('favorites and unfavorites folders without changing recency or queueing sync', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const folder = (await folderRepository.create('Projects')).data!
    const originalUpdatedAt = (await db.folders.get(folder.id))!.updatedAt

    await expect(folderRepository.setFavorite(folder.id, true)).resolves.toEqual({ success: true })
    expect(await db.folders.get(folder.id)).toMatchObject({ isFavorite: true, updatedAt: originalUpdatedAt })
    expect(await db.syncQueue.toArray()).toHaveLength(0)

    await expect(folderRepository.setFavorite(folder.id, false)).resolves.toEqual({ success: true })
    expect(await db.folders.get(folder.id)).toMatchObject({ isFavorite: false, updatedAt: originalUpdatedAt })
    expect(await db.syncQueue.toArray()).toHaveLength(0)
  })

  it('keeps favorite file state through Trash and direct restore while active lists hide trashed items', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const file = (await fileRepository.create('document')).data!
    await fileRepository.setFavorite(file.id, true)

    await fileRepository.delete(file.id)

    expect((await fileRepository.list()).map((item) => item.id)).toEqual([])
    expect(await db.files.get(file.id)).toMatchObject({ isDeleted: true, isFavorite: true })

    await fileRepository.restore(file.id)

    expect(await db.files.get(file.id)).toMatchObject({ isDeleted: false, isFavorite: true })
    expect((await fileRepository.list()).map((item) => item.id)).toEqual([file.id])
  })

  it('keeps favorite folder state through Trash cascade and restore while active lists hide trashed items', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const folder = (await folderRepository.create('Projects')).data!
    const child = (await folderRepository.create('Assets', folder.id)).data!
    const file = (await fileRepository.create('document', child.id)).data!
    await folderRepository.setFavorite(folder.id, true)

    await folderRepository.delete(folder.id)

    expect((await fileRepository.list()).map((item) => item.id)).toEqual([])
    expect((await folderRepository.list()).map((item) => item.id)).toEqual([])
    expect(await db.folders.get(folder.id)).toMatchObject({ isDeleted: true, isFavorite: true })

    await folderRepository.restore(folder.id)

    expect(await db.folders.get(folder.id)).toMatchObject({ isDeleted: false, isFavorite: true })
    expect(await db.folders.get(child.id)).toMatchObject({ isDeleted: false })
    expect(await db.files.get(file.id)).toMatchObject({ isDeleted: false })
    expect((await folderRepository.list()).map((item) => item.id).sort()).toEqual([child.id, folder.id].sort())
  })

  it('does not let duplicated files inherit favorite state', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const source = (await fileRepository.create('document')).data!
    await fileRepository.setFavorite(source.id, true)

    const duplicated = await fileRepository.duplicate(source.id)

    expect(duplicated.success).toBe(true)
    expect(duplicated.data).toMatchObject({ isFavorite: false })
    expect(await db.files.get(source.id)).toMatchObject({ isFavorite: true })
  })

  it('does not cascade folder favorite state to descendants', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const folder = (await folderRepository.create('Projects')).data!
    const child = (await folderRepository.create('Assets', folder.id)).data!
    const file = (await fileRepository.create('document', folder.id)).data!

    await folderRepository.setFavorite(folder.id, true)

    expect(await db.folders.get(folder.id)).toMatchObject({ isFavorite: true })
    expect(await db.folders.get(child.id)).not.toMatchObject({ isFavorite: true })
    expect(await db.files.get(file.id)).not.toMatchObject({ isFavorite: true })
  })

  it('keeps Drive workspace favorite toggles local-first without Drive queue work', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = '2026-08-29T00:00:00.000Z'
    await db.files.add({
      id: 'drive-file',
      driveFileId: 'drive-file-id',
      workspaceType: 'drive',
      name: 'Drive notes',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
      syncStatus: 'backed-up',
      isDeleted: false,
    })
    await db.folders.add({
      id: 'drive-folder',
      driveFolderId: 'drive-folder-id',
      workspaceType: 'drive',
      name: 'Drive projects',
      parentId: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })

    await expect(fileRepository.setFavorite('drive-file', true)).resolves.toEqual({ success: true })
    await expect(folderRepository.setFavorite('drive-folder', true)).resolves.toEqual({ success: true })

    expect(await db.files.get('drive-file')).toMatchObject({ isFavorite: true, updatedAt: now })
    expect(await db.folders.get('drive-folder')).toMatchObject({ isFavorite: true, updatedAt: now })
    expect(await db.syncQueue.toArray()).toHaveLength(2)
  })

  it('lists one logical file when local duplicate records exist', async () => {
    const now = new Date().toISOString()
    await db.files.bulkAdd([
      {
        id: 'local-copy',
        driveFileId: null,
        name: 'Project Plan',
        type: 'document',
        folderId: null,
        content: 'local',
        mimeType: 'application/x-mybook-document',
        createdAt: now,
        updatedAt: '2026-08-22T08:00:00.000Z',
        lastSyncedAt: null,
        syncStatus: 'pending',
        isDeleted: false,
      },
      {
        id: 'synced-copy',
        driveFileId: 'drive-project-plan',
        name: 'Project Plan',
        type: 'document',
        folderId: null,
        content: 'synced',
        mimeType: 'application/x-mybook-document',
        createdAt: now,
        updatedAt: '2026-08-22T07:00:00.000Z',
        lastSyncedAt: '2026-08-22T07:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      },
    ])

    const files = await fileRepository.list()

    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ id: 'synced-copy', driveFileId: 'drive-project-plan' })
  })

  it('hides backup file extensions from app-visible names', async () => {
    const now = new Date().toISOString()
    await db.files.bulkAdd([
      {
        id: 'markdown-backup-name',
        driveFileId: 'drive-markdown',
        name: 'Meeting Notes.mybook.md',
        type: 'document',
        folderId: null,
        content: '',
        mimeType: 'application/x-mybook-document',
        createdAt: now,
        updatedAt: now,
        lastSyncedAt: now,
        syncStatus: 'backed-up',
        isDeleted: false,
      },
      {
        id: 'spreadsheet-backup-name',
        driveFileId: 'drive-sheet',
        name: 'Budget.xlsx',
        type: 'spreadsheet',
        folderId: null,
        content: '',
        mimeType: 'application/x-mybook-spreadsheet',
        createdAt: now,
        updatedAt: now,
        lastSyncedAt: now,
        syncStatus: 'backed-up',
        isDeleted: false,
      },
    ])

    const files = await fileRepository.list()
    const document = (await fileRepository.get('markdown-backup-name')).data

    expect(files.map((file) => file.name).sort()).toEqual(['Budget', 'Meeting Notes'])
    expect(document?.name).toBe('Meeting Notes')
  })

  it('clears Drive cached files, folders, sync queue, and Drive settings on account clear without affecting local items', async () => {
    const now = new Date().toISOString()
    const listenerMock = vi.fn()
    const unsubscribe = onClearAccountDriveCache(listenerMock)

    await db.folders.bulkAdd([
      { id: 'drive-folder-1', driveFolderId: 'drive-folder-id-1', workspaceType: 'drive', name: 'Cloud Folder', parentId: null, createdAt: now, updatedAt: now, isDeleted: false },
      { id: 'local-folder-1', driveFolderId: null, workspaceType: 'local', name: 'Local Folder', parentId: null, createdAt: now, updatedAt: now, isDeleted: false },
    ])
    await db.files.bulkAdd([
      { id: 'drive-file-1', driveFileId: 'drive-file-id-1', workspaceType: 'drive', name: 'Cloud Notes', type: 'document', folderId: null, content: '', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: now, syncStatus: 'backed-up', isDeleted: false },
      { id: 'local-file-1', driveFileId: null, workspaceType: 'local', name: 'Local Notes', type: 'document', folderId: null, content: '', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: null, syncStatus: 'local', isDeleted: false },
    ])
    await db.fileVersions.bulkAdd([
      { id: 'version-drive-1', fileId: 'drive-file-1', source: 'drive', name: 'Cloud Notes', content: '', mimeType: 'application/x-mybook-document', driveFileId: 'drive-file-id-1', driveModifiedTime: now, createdAt: now, label: 'Cloud backup' },
      { id: 'version-local-1', fileId: 'local-file-1', source: 'local', name: 'Local Notes', content: '', mimeType: 'application/x-mybook-document', driveFileId: null, driveModifiedTime: null, createdAt: now, label: 'Local save' },
    ])
    await db.syncQueue.add({
      id: 'queue-1',
      entityId: 'drive-file-1',
      entityType: 'file',
      operation: 'update',
      status: 'pending',
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      errorMessage: null,
    })
    await db.settings.bulkAdd([
      { key: 'google-drive.mybook-folder-id', value: 'folder-123', updatedAt: now },
      { key: 'google-drive.initial-sync-complete:user@example.com', value: true, updatedAt: now },
      { key: 'local-workspace.details', value: { name: 'My Local' }, updatedAt: now },
    ])

    await clearAccountDriveCache()

    expect(listenerMock).toHaveBeenCalledTimes(1)

    // Drive data should be removed
    expect(await db.files.get('drive-file-1')).toBeUndefined()
    expect(await db.folders.get('drive-folder-1')).toBeUndefined()
    expect(await db.fileVersions.get('version-drive-1')).toBeUndefined()
    expect(await db.syncQueue.toArray()).toHaveLength(0)
    expect(await db.settings.get('google-drive.mybook-folder-id')).toBeUndefined()
    expect(await db.settings.get('google-drive.initial-sync-complete:user@example.com')).toBeUndefined()

    // Local workspace data should be preserved
    expect(await db.files.get('local-file-1')).toBeDefined()
    expect(await db.folders.get('local-folder-1')).toBeDefined()
    expect(await db.fileVersions.get('version-local-1')).toBeDefined()
    expect((await db.settings.get('local-workspace.details'))?.value).toEqual({ name: 'My Local' })

    unsubscribe()
  })

  it('deletes old file on disk when renaming a document in Google Drive mode with mirror attached', async () => {
    const localWs = await import('../services/localWorkspace')
    const deleteLocalFileSpy = vi.spyOn(localWs, 'deleteLocalWorkspaceFile').mockResolvedValue()
    const writeLocalFileSpy = vi.spyOn(localWs, 'writeLocalWorkspaceFile').mockResolvedValue()
    vi.spyOn(localWs, 'getDeviceDirectoryHandle').mockResolvedValue({ kind: 'directory', name: 'Mirror' } as unknown as FileSystemDirectoryHandle)

    useWorkspaceStore.setState({ mode: 'drive' })

    const created = await fileRepository.create('document')
    expect(created.success).toBe(true)
    const fileId = created.data!.id

    await fileRepository.update(fileId, { name: 'My Renamed Doc' })

    expect(deleteLocalFileSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Untitled' }))
    expect(writeLocalFileSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Renamed Doc' }))
  })

  it('deletes file on disk and queues Drive trash when deleting a document in Google Drive mode with mirror attached', async () => {
    const localWs = await import('../services/localWorkspace')
    const deleteLocalFileSpy = vi.spyOn(localWs, 'deleteLocalWorkspaceFile').mockResolvedValue()
    vi.spyOn(localWs, 'getDeviceDirectoryHandle').mockResolvedValue({ kind: 'directory', name: 'Mirror' } as unknown as FileSystemDirectoryHandle)

    useWorkspaceStore.setState({ mode: 'drive' })

    const created = await fileRepository.create('document')
    expect(created.success).toBe(true)
    const fileId = created.data!.id

    await fileRepository.delete(fileId)

    expect(deleteLocalFileSpy).toHaveBeenCalledWith(expect.objectContaining({ id: fileId, name: 'Untitled' }))
    expect(await db.syncQueue.where('entityId').equals(fileId).first()).toMatchObject({
      operation: 'delete',
      entityType: 'file',
    })
  })

  it('filters out media files and attachment folders from repository list', async () => {
    useWorkspaceStore.setState({ mode: 'drive' })

    const now = new Date().toISOString()
    // Regular document
    await db.files.add({
      id: 'regular-doc-1',
      driveFileId: 'df-1',
      workspaceType: 'drive',
      name: 'Meeting Notes',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: null,
      syncStatus: 'backed-up',
      isDeleted: false,
    })

    // Rogue media files
    await db.files.add({
      id: 'rogue-image-1',
      driveFileId: 'df-img',
      workspaceType: 'drive',
      name: 'screenshot.png',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'image/png',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: null,
      syncStatus: 'backed-up',
      isDeleted: false,
    })

    await db.files.add({
      id: 'rogue-audio-1',
      driveFileId: 'df-aud',
      workspaceType: 'drive',
      name: 'recording.mp3',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'audio/mpeg',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: null,
      syncStatus: 'backed-up',
      isDeleted: false,
    })

    // Regular folder
    await db.folders.add({
      id: 'regular-folder-1',
      driveFolderId: 'df-fld-1',
      workspaceType: 'drive',
      name: 'Work',
      parentId: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })

    // Attachment companion folder
    await db.folders.add({
      id: 'att-folder-1',
      driveFolderId: 'df-att-1',
      workspaceType: 'drive',
      name: 'Meeting Notes_attachments',
      parentId: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })

    const files = await fileRepository.list()
    expect(files.map((f) => f.name)).toContain('Meeting Notes')
    expect(files.map((f) => f.name)).not.toContain('screenshot.png')
    expect(files.map((f) => f.name)).not.toContain('recording.mp3')

    const folders = await folderRepository.list()
    expect(folders.map((f) => f.name)).toContain('Work')
    expect(folders.map((f) => f.name)).not.toContain('Meeting Notes_attachments')
  })

  it('keeps sync queue and file status pending when edit arrives during active upload, then uploads latest content', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    useWorkspaceStore.setState({ mode: 'drive' })
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })

    function createDeferred<T>() {
      let resolve!: (value: T | PromiseLike<T>) => void
      let reject!: (reason?: unknown) => void
      const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
      })
      return { promise, resolve, reject }
    }

    const upload1Deferred = createDeferred<Awaited<ReturnType<typeof backupDocumentToDrive>>>()
    const upload2Deferred = createDeferred<Awaited<ReturnType<typeof backupDocumentToDrive>>>()

    const calls: Array<{ content: string; title: string }> = []
    vi.mocked(backupDocumentToDrive).mockImplementation(async (input) => {
      calls.push({ content: input.content, title: input.title })
      if (calls.length === 1) {
        return upload1Deferred.promise
      }
      return upload2Deferred.promise
    })

    const file = (await fileRepository.create('document')).data!
    await fileRepository.update(file.id, { content: 'version 1' })

    // Now go online and kick off Drive sync
    vi.stubGlobal('navigator', { onLine: true })
    const syncFlight = processPendingDriveSync()

    // Wait until upload 1 is called
    while (calls.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    expect(calls).toHaveLength(1)
    expect(calls[0]?.content).toBe('version 1')

    // While upload 1 is in-flight, a new local edit arrives
    await fileRepository.update(file.id, { content: 'version 2' })

    // Queue item should have been reverted to 'pending' by queueFileSync
    const queueItemDuringUpload = (await db.syncQueue.toArray())[0]
    expect(queueItemDuringUpload?.status).toBe('pending')

    // First upload completes
    upload1Deferred.resolve({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: true })

    // Wait until upload 2 is initiated with the new version
    while (calls.length < 2) {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    expect(calls).toHaveLength(2)
    expect(calls[1]?.content).toBe('version 2')

    // Before upload 2 resolves, file must still be pending with content version 2
    const fileDuringSecondUpload = await db.files.get(file.id)
    expect(fileDuringSecondUpload?.syncStatus).toBe('pending')
    expect(fileDuringSecondUpload?.content).toBe('version 2')

    // Now resolve the second upload
    upload2Deferred.resolve({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })
    await syncFlight

    // After second upload finishes, file is backed-up and queue is completed
    const finalFile = await db.files.get(file.id)
    expect(finalFile?.syncStatus).toBe('backed-up')
    expect(finalFile?.syncError).toBeNull()

    const finalQueue = await db.syncQueue.toArray()
    expect(finalQueue[0]?.status).toBe('completed')
  })

  it('marks sync failed and records retry on upload error, and retries on subsequent sync', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    useWorkspaceStore.setState({ mode: 'drive' })
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })

    const file = (await fileRepository.create('document')).data!
    await fileRepository.update(file.id, { content: 'retry test content' })

    // Now go online with upload failing
    vi.stubGlobal('navigator', { onLine: true })
    vi.mocked(backupDocumentToDrive).mockResolvedValueOnce({ success: false, error: 'Network timeout' })

    await processPendingDriveSync()

    // Should be failed with error recorded and retryCount incremented
    const failedFile = await db.files.get(file.id)
    expect(failedFile?.syncStatus).toBe('failed')
    expect(failedFile?.syncError).toBe('Network timeout')

    const failedQueueItem = (await db.syncQueue.toArray())[0]
    expect(failedQueueItem?.status).toBe('failed')
    expect(failedQueueItem?.retryCount).toBe(1)
    expect(failedQueueItem?.errorMessage).toBe('Network timeout')

    // Next sync attempt succeeds
    vi.mocked(backupDocumentToDrive).mockResolvedValueOnce({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: true })
    await processPendingDriveSync()

    const recoveredFile = await db.files.get(file.id)
    expect(recoveredFile?.syncStatus).toBe('backed-up')
    expect(recoveredFile?.syncError).toBeNull()

    const completedQueueItem = (await db.syncQueue.toArray())[0]
    expect(completedQueueItem?.status).toBe('completed')
  })

  it('keeps queue item pending when edit arrives during failed upload attempt', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })

    function createDeferred<T>() {
      let resolve!: (value: T | PromiseLike<T>) => void
      let reject!: (reason?: unknown) => void
      const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
      })
      return { promise, resolve, reject }
    }

    const upload1Deferred = createDeferred<Awaited<ReturnType<typeof backupDocumentToDrive>>>()
    const calls: string[] = []

    vi.mocked(backupDocumentToDrive).mockImplementation(async (input) => {
      calls.push(input.content)
      if (calls.length === 1) {
        return upload1Deferred.promise
      }
      return { success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false }
    })

    const file = (await fileRepository.create('document')).data!
    await fileRepository.update(file.id, { content: 'v1' })

    const syncFlight = processPendingDriveSync()
    await Promise.resolve()
    await Promise.resolve()

    // New edit while upload 1 is failing
    await fileRepository.update(file.id, { content: 'v2' })

    // Upload 1 fails
    upload1Deferred.resolve({ success: false, error: 'Temporary service error' })

    // Entire sync flight finishes (it re-runs because rerun was requested)
    await syncFlight

    // Both calls occurred
    expect(calls).toEqual(['v1', 'v2'])

    // Final state is backed-up with v2
    const finalFile = await db.files.get(file.id)
    expect(finalFile?.syncStatus).toBe('backed-up')
    expect(finalFile?.content).toBe('v2')
    expect((await db.syncQueue.toArray())[0]?.status).toBe('completed')
  })

  it('coalesces rapid repeated file updates into a single queue item without duplicates', async () => {
    vi.stubGlobal('navigator', { onLine: false }) // Offline so they accumulate in queue
    useWorkspaceStore.setState({ mode: 'drive' })

    const file = (await fileRepository.create('document')).data!
    await fileRepository.update(file.id, { content: 'edit 1' })
    await fileRepository.update(file.id, { content: 'edit 2' })
    await fileRepository.update(file.id, { content: 'edit 3' })

    const queueItems = await db.syncQueue.filter((item) => item.entityType === 'file' && item.entityId === file.id).toArray()
    expect(queueItems).toHaveLength(1)
    expect(queueItems[0]?.status).toBe('pending')

    // Now go online and sync
    vi.stubGlobal('navigator', { onLine: true })
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })
    vi.mocked(backupDocumentToDrive).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: true })

    await processPendingDriveSync()

    const finalQueueItems = await db.syncQueue.filter((item) => item.entityType === 'file' && item.entityId === file.id).toArray()
    expect(finalQueueItems).toHaveLength(1)
    expect(finalQueueItems[0]?.status).toBe('completed')
    expect((await db.files.get(file.id))?.syncStatus).toBe('backed-up')
  })

  it('guards against circular parent references in folderRepository.create and folderRepository.update', async () => {
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    const folderAId = crypto.randomUUID()
    const folderBId = crypto.randomUUID()

    // Manually create circular reference: A -> B -> A
    await db.folders.add({
      id: folderAId,
      name: 'Folder A',
      parentId: folderBId,
      driveFolderId: null,
      workspaceType: 'drive',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })
    await db.folders.add({
      id: folderBId,
      name: 'Folder B',
      parentId: folderAId,
      driveFolderId: null,
      workspaceType: 'drive',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })

    // create on folderA should terminate safely without hanging
    const createResult = await folderRepository.create('Child Folder', folderAId)
    expect(createResult).toBeDefined()

    // update should terminate safely without hanging
    const updateResult = await folderRepository.update(folderAId, { parentId: folderBId })
    expect(updateResult).toBeDefined()
  })

  it('deduplicates logical folders in folderRepository.list and search', async () => {
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    const id1 = crypto.randomUUID()
    const id2 = crypto.randomUUID()

    // Two folders with the same name and parent, one with driveFolderId and one without
    await db.folders.add({
      id: id1,
      name: 'Duplicate Folder',
      parentId: null,
      driveFolderId: 'drive-folder-123',
      workspaceType: 'drive',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })
    await db.folders.add({
      id: id2,
      name: 'Duplicate Folder',
      parentId: null,
      driveFolderId: null,
      workspaceType: 'drive',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })

    const list = await folderRepository.list()
    const matching = list.filter((f) => f.name === 'Duplicate Folder')
    expect(matching).toHaveLength(1)
    expect(matching[0]?.driveFolderId).toBe('drive-folder-123')

    const search = await folderRepository.search('Duplicate')
    const matchingSearch = search.filter((f) => f.name === 'Duplicate Folder')
    expect(matchingSearch).toHaveLength(1)
    expect(matchingSearch[0]?.driveFolderId).toBe('drive-folder-123')
  })

  it('preserves distinct folders when two same-name folders have different Drive IDs under the same parent', async () => {
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    const id1 = crypto.randomUUID()
    const id2 = crypto.randomUUID()

    // Two distinct Google Drive folders with the same name under the same parent
    await db.folders.add({
      id: id1,
      name: 'Work',
      parentId: null,
      driveFolderId: 'drive-folder-alpha',
      workspaceType: 'drive',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })
    await db.folders.add({
      id: id2,
      name: 'Work',
      parentId: null,
      driveFolderId: 'drive-folder-beta',
      workspaceType: 'drive',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })

    const list = await folderRepository.list()
    const matching = list.filter((f) => f.name === 'Work' && f.parentId === null)
    expect(matching).toHaveLength(2)
    const driveIds = matching.map((f) => f.driveFolderId).sort()
    expect(driveIds).toEqual(['drive-folder-alpha', 'drive-folder-beta'])

    const search = await folderRepository.search('Work')
    const matchingSearch = search.filter((f) => f.name === 'Work' && f.parentId === null)
    expect(matchingSearch).toHaveLength(2)
  })

  it('preserves same-name folders under different parents', async () => {
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    const parentFolderId = crypto.randomUUID()

    await db.folders.add({
      id: parentFolderId,
      name: 'Parent Container',
      parentId: null,
      driveFolderId: 'drive-parent',
      workspaceType: 'drive',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })
    await db.folders.add({
      id: crypto.randomUUID(),
      name: 'Reports',
      parentId: null,
      driveFolderId: 'drive-root-reports',
      workspaceType: 'drive',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })
    await db.folders.add({
      id: crypto.randomUUID(),
      name: 'Reports',
      parentId: parentFolderId,
      driveFolderId: 'drive-nested-reports',
      workspaceType: 'drive',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })

    const list = await folderRepository.list()
    const matching = list.filter((f) => f.name === 'Reports')
    expect(matching).toHaveLength(2)
    expect(matching.some((f) => f.parentId === null)).toBe(true)
    expect(matching.some((f) => f.parentId === parentFolderId)).toBe(true)
  })

  it('detaches file to root when syncing if its parent folder was deleted', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    useWorkspaceStore.setState({ mode: 'drive' })

    const folderRes = await folderRepository.create('Parent To Delete')
    const folder = folderRes.data!

    const fileRes = await fileRepository.create('document', folder.id)
    const file = fileRes.data!

    // Mark parent folder as deleted (e.g. deleted remotely on Drive)
    await db.folders.update(folder.id, { isDeleted: true })

    // Verify folder is deleted
    const deletedFolder = await db.folders.get(folder.id)
    expect(deletedFolder?.isDeleted).toBe(true)

    // Now update file content to queue a sync
    await fileRepository.update(file.id, { content: 'hello from detached file' })

    // Go online
    vi.stubGlobal('navigator', { onLine: true })
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })
    vi.mocked(backupDocumentToDrive).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: true })

    await processPendingDriveSync()

    // File should have had its folderId detached to null in db and backed up successfully
    const updatedFile = await db.files.get(file.id)
    expect(updatedFile?.folderId).toBeNull()
    expect(updatedFile?.syncStatus).toBe('backed-up')
    expect(vi.mocked(backupDocumentToDrive)).toHaveBeenCalledWith(expect.objectContaining({
      fileId: file.id,
      folderId: null,
    }))
  })

  it('restores file to root if its parent folder was deleted while in trash', async () => {
    useWorkspaceStore.setState({ mode: 'drive' })
    const folderRes = await folderRepository.create('Parent Folder')
    const folder = folderRes.data!

    const fileRes = await fileRepository.create('document', folder.id)
    const file = fileRes.data!

    // Soft delete the file
    await fileRepository.delete(file.id)
    // Soft delete the parent folder
    await folderRepository.delete(folder.id)

    // Restore the file
    const restoreRes = await fileRepository.restore(file.id)
    expect(restoreRes.success).toBe(true)

    // File should be restored and detached to root (null)
    const restoredFile = await db.files.get(file.id)
    expect(restoredFile?.isDeleted).toBe(false)
    expect(restoredFile?.folderId).toBeNull()
  })

  it('does not upload to Drive while syncConflict is active and does not mark queue item completed', async () => {
    useWorkspaceStore.setState({ mode: 'drive' })
    vi.stubGlobal('navigator', { onLine: true })
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })
    vi.mocked(backupDocumentToDrive).mockReset()
    vi.mocked(backupDocumentToDrive).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: true })

    const file = (await fileRepository.create('document')).data!
    await fileRepository.update(file.id, { content: 'local draft with conflict' })

    // A conflict is recorded
    const now = new Date().toISOString()
    const conflict = await recordRemoteConflict(file.id, 'remote colliding draft', now)
    expect(conflict).toBeDefined()

    // Clear mock calls
    vi.mocked(backupDocumentToDrive).mockClear()

    // Trigger Drive sync
    await processPendingDriveSync()

    // Verify backupDocumentToDrive was NOT called
    expect(vi.mocked(backupDocumentToDrive)).not.toHaveBeenCalled()

    // Verify queue item was NOT marked completed or deleted; it must remain pending!
    const queueItems = await db.syncQueue.filter((item) => item.entityType === 'file' && item.entityId === file.id).toArray()
    expect(queueItems.length).toBeGreaterThan(0)
    const activeQueueItem = queueItems.find((item) => item.status !== 'completed')
    expect(activeQueueItem).toBeDefined()
    expect(activeQueueItem?.status).toBe('pending')

    // Now resolve the conflict by keeping local version
    await keepLocalVersion(file.id, conflict!.versionId)

    // Trigger Drive sync again
    await processPendingDriveSync()

    // Now backupDocumentToDrive WAS called and queue item is completed!
    expect(vi.mocked(backupDocumentToDrive)).toHaveBeenCalledWith(expect.objectContaining({
      fileId: file.id,
      content: 'local draft with conflict',
    }))

    const finalQueueItem = await db.syncQueue.get(activeQueueItem!.id)
    expect(finalQueueItem?.status).toBe('completed')
  })

  it('clears a transient conflict atomically when autosave converges to its remote version', async () => {
    useWorkspaceStore.setState({ mode: 'drive' })
    vi.stubGlobal('navigator', { onLine: true })
    const file = (await fileRepository.create('document')).data!
    await fileRepository.update(file.id, { content: 'local draft' })

    const remoteModifiedTime = new Date().toISOString()
    await recordRemoteConflict(file.id, 'remote version', remoteModifiedTime)
    const conflictedFile = await db.files.get(file.id)
    expect(conflictedFile?.syncConflict).toBeDefined()

    const result = await fileRepository.update(
      file.id,
      { content: 'remote version', syncStatus: 'pending' },
      { expectedUpdatedAt: conflictedFile!.updatedAt, expectedContent: conflictedFile!.content }
    )

    expect(result.success).toBe(true)
    expect(await db.files.get(file.id)).toMatchObject({
      content: 'remote version',
      syncConflict: null,
      baseContent: 'remote version',
      lastSyncedAt: remoteModifiedTime,
    })
  })
})

