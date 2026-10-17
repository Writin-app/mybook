import type { JSONContent } from '@tiptap/core'

import { db } from '../database/db'
import type { MyBookFile, MyBookFolder } from '../types/files'
import { documentToMyBookMarkdown, myBookMarkdownToDocument, parseMyBookMarkdown } from '../utils/mybookMarkdown'
import { devLog } from '../utils/safeLog'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { hasUnsavedLocalEdits } from './localEditState'

const LEGACY_ROOT_DIR = 'Writin'
const LEGACY_FILES_DIR = 'files'
export const LOCAL_DIRECTORY_HANDLE_KEY = 'local-workspace.directory-handle'
export const LOCAL_WORKSPACE_DETAILS_KEY = 'local-workspace.details'

type StorageNavigator = Navigator & {
  storage?: StorageManager & {
    getDirectory?: () => Promise<FileSystemDirectoryHandle>
    persist?: () => Promise<boolean>
    persisted?: () => Promise<boolean>
    estimate?: () => Promise<StorageEstimate>
  }
}

type FileSystemWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
}

type PermissionMode = 'read' | 'readwrite'
type PermissionDescriptor = { mode?: PermissionMode }
type PermissionedDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: PermissionDescriptor) => Promise<PermissionState>
  requestPermission?: (descriptor?: PermissionDescriptor) => Promise<PermissionState>
  values?: () => AsyncIterableIterator<FileSystemHandle>
  entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>
}

export type LocalWorkspaceStorageKind = 'file-system' | 'opfs' | 'indexeddb'
export type LocalWorkspaceStoragePreference = 'file-system' | 'private'

export interface LocalWorkspaceDetails {
  name: string
  storage: LocalWorkspaceStorageKind
  createdAt: string
}

export interface PickedLocalWorkspaceDirectory {
  handle: FileSystemDirectoryHandle
  name: string
}

function opfsRoot() {
  return (navigator as StorageNavigator).storage?.getDirectory
}

export function isOpfsAvailable() {
  return typeof opfsRoot() === 'function'
}

export async function requestPersistentLocalStorage() {
  return await (navigator as StorageNavigator).storage?.persist?.() ?? false
}

export async function getLocalStorageProtectionStatus() {
  const storage = (navigator as StorageNavigator).storage
  const [persisted, estimate] = await Promise.all([
    storage?.persisted?.() ?? Promise.resolve(false),
    storage?.estimate?.() ?? Promise.resolve({ usage: undefined, quota: undefined } as StorageEstimate),
  ])
  return {
    persisted,
    usage: estimate.usage,
    quota: estimate.quota,
  }
}

export function canPickDeviceDirectory() {
  return typeof (window as FileSystemWindow).showDirectoryPicker === 'function'
}

export async function hasReadWritePermission(handle: FileSystemDirectoryHandle, { request = true } = {}) {
  const permissioned = handle as PermissionedDirectoryHandle
  if (!permissioned.queryPermission || !permissioned.requestPermission) return true
  try {
    if (await permissioned.queryPermission({ mode: 'readwrite' }) === 'granted') return true
    if (!request) return false
    return await permissioned.requestPermission({ mode: 'readwrite' }) === 'granted'
  } catch {
    return false
  }
}

export async function saveDeviceDirectoryHandle(handle: FileSystemDirectoryHandle) {
  await db.settings.put({ key: LOCAL_DIRECTORY_HANDLE_KEY, value: handle, updatedAt: new Date().toISOString() })
}

export async function forgetDeviceDirectoryHandle() {
  await db.settings.delete(LOCAL_DIRECTORY_HANDLE_KEY)
  const details = await getLocalWorkspaceDetails()
  if (details?.storage === 'file-system') {
    await db.settings.delete(LOCAL_WORKSPACE_DETAILS_KEY)
  }
}

export async function getDeviceDirectoryHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return (await db.settings.get(LOCAL_DIRECTORY_HANDLE_KEY))?.value as FileSystemDirectoryHandle | undefined
}

export async function saveLocalWorkspaceDetails(details: LocalWorkspaceDetails) {
  await db.settings.put({ key: LOCAL_WORKSPACE_DETAILS_KEY, value: details, updatedAt: new Date().toISOString() })
}

export async function getLocalWorkspaceDetails(): Promise<LocalWorkspaceDetails | null> {
  const record = await db.settings.get(LOCAL_WORKSPACE_DETAILS_KEY)
  return (record?.value as LocalWorkspaceDetails | undefined) ?? null
}

export async function pickLocalWorkspaceDirectory(): Promise<PickedLocalWorkspaceDirectory | null> {
  if (!canPickDeviceDirectory()) return null
  try {
    const handle = await (window as FileSystemWindow).showDirectoryPicker?.({
      id: 'writin-local-workspace',
      mode: 'readwrite',
    })
    if (!handle) return null
    return { handle, name: handle.name }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      devLog('warn', 'Could not pick a device folder workspace.', error)
    }
    return null
  }
}

export function sanitizeFileName(name: string): string {
  const trimmed = name.trim() || 'Untitled'
  return trimmed.replace(/[\\/:*?"<>|]/g, '_')
}

export function cleanDocumentName(filename: string): string {
  return filename
    .replace(/\.mybook\.md$/i, '')
    .replace(/\.md$/i, '')
    .replace(/\.xlsx$/i, '')
    .replace(/\.content\.json$/i, '')
    .trim() || 'Untitled'
}

function privateStorageKind(): LocalWorkspaceStorageKind {
  return isOpfsAvailable() ? 'opfs' : 'indexeddb'
}

export function isMissingDirectoryError(error: unknown): boolean {
  if (!error) return false
  const errName = error instanceof Error || (typeof error === 'object' && error !== null && 'name' in error)
    ? String((error as { name?: unknown }).name)
    : ''
  const errMsg = error instanceof Error ? error.message : String(error)
  if (errName === 'NotAllowedError' || errMsg.toLowerCase().includes('permission')) {
    return false
  }
  return (
    errName === 'NotFoundError' ||
    errMsg.toLowerCase().includes('not found') ||
    errMsg.toLowerCase().includes('could not be found') ||
    errMsg.toLowerCase().includes('no longer exists') ||
    errMsg.toLowerCase().includes('does not exist')
  )
}

export async function checkDeviceDirectoryHandleValid(
  customHandle?: FileSystemDirectoryHandle | null
): Promise<{ valid: boolean; handle: FileSystemDirectoryHandle | null; needsPermission?: boolean; error?: string }> {
  const handle = customHandle !== undefined ? customHandle : (await getDeviceDirectoryHandle())
  if (!handle) return { valid: true, handle: null }
  try {
    const anyHandle = handle as unknown as {
      values?: () => AsyncIterableIterator<FileSystemHandle> | IterableIterator<FileSystemHandle>
      entries?: () => AsyncIterableIterator<[string, FileSystemHandle]> | IterableIterator<[string, FileSystemHandle]>
      [Symbol.asyncIterator]?: () => AsyncIterator<FileSystemHandle>
      queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
    }

    if (typeof anyHandle.queryPermission === 'function') {
      const perm = await anyHandle.queryPermission({ mode: 'readwrite' })
      if (perm !== 'granted') {
        return { valid: true, handle, needsPermission: true }
      }
    }

    if (typeof anyHandle.values === 'function') {
      const iter = anyHandle.values()
      if (iter && typeof iter.next === 'function') {
        await iter.next()
      }
    } else if (typeof anyHandle.entries === 'function') {
      const iter = anyHandle.entries()
      if (iter && typeof iter.next === 'function') {
        await iter.next()
      }
    } else if (typeof anyHandle[Symbol.asyncIterator] === 'function') {
      const iter = anyHandle[Symbol.asyncIterator]!()
      if (iter && typeof iter.next === 'function') {
        await iter.next()
      }
    }
    return { valid: true, handle }
  } catch (error) {
    const errName = error instanceof Error || (error && typeof error === 'object' && 'name' in error)
      ? String((error as { name?: unknown }).name)
      : ''
    if (errName === 'NotAllowedError') {
      return { valid: true, handle, needsPermission: true }
    }
    if (isMissingDirectoryError(error)) {
      return { valid: false, handle, error: errName || 'NotFoundError' }
    }
    return { valid: true, handle }
  }
}

export async function getWorkspaceRootDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const deviceDirectory = await getDeviceDirectoryHandle()
  if (deviceDirectory && await hasReadWritePermission(deviceDirectory, { request: false })) {
    return deviceDirectory
  }

  const getDirectory = opfsRoot()
  if (!getDirectory) return null
  try {
    const root = await getDirectory.call(navigator.storage)
    return root
  } catch {
    return null
  }
}

export async function getWorkspaceEffectiveDirectory(
  customRoot?: FileSystemDirectoryHandle | null,
  create = false
): Promise<FileSystemDirectoryHandle | null> {
  const root = customRoot ?? (await getWorkspaceRootDirectory())
  if (!root) return null

  // Check legacy Writin/files structure first for backward compatibility
  try {
    const legacyDir = await root.getDirectoryHandle(LEGACY_ROOT_DIR)
    const filesDir = await legacyDir.getDirectoryHandle(LEGACY_FILES_DIR)
    return filesDir
  } catch {
    // Not legacy structure
  }

  // Get active vault/workspace name
  const details = await getLocalWorkspaceDetails()
  const vaultName = sanitizeFileName(details?.name || 'Writin')

  // If the root directory handle itself is named the vaultName (case-insensitive), use root directly
  if (root.name && root.name.trim().toLowerCase() === vaultName.toLowerCase()) {
    return root
  }

  // Otherwise, nest inside <vaultName>
  try {
    return await root.getDirectoryHandle(vaultName, { create })
  } catch {
    if (!create) {
      return root
    }
    return root
  }
}

async function resolveDirectoryHandleForFolder(
  root: FileSystemDirectoryHandle,
  folderId: string | null,
  create = false,
): Promise<FileSystemDirectoryHandle | null> {
  if (!folderId) return root

  const folderPath: string[] = []
  let currentId: string | null = folderId
  const visited = new Set<string>()

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const folder: MyBookFolder | undefined = await db.folders.get(currentId)
    if (!folder) break
    folderPath.unshift(sanitizeFileName(folder.name))
    currentId = folder.parentId
  }

  let currentDir = root
  for (const segment of folderPath) {
    try {
      currentDir = await currentDir.getDirectoryHandle(segment, { create })
    } catch {
      return null
    }
  }

  return currentDir
}

export async function initializeLocalWorkspace({
  name = 'Writin',
  storagePreference = canPickDeviceDirectory() ? 'file-system' : 'private',
  allowPrivateFallback = true,
  directoryHandle,
}: {
  name?: string
  storagePreference?: LocalWorkspaceStoragePreference
  allowPrivateFallback?: boolean
  directoryHandle?: FileSystemDirectoryHandle | null
} = {}) {
  await requestPersistentLocalStorage()
  const createdAt = new Date().toISOString()
  if (storagePreference === 'private' || !canPickDeviceDirectory()) {
    await forgetDeviceDirectoryHandle()
    const storage = privateStorageKind()
    await saveLocalWorkspaceDetails({ name, storage, createdAt })
    await scanAndHydrateLocalWorkspace()
    return { storage }
  }

  try {
    const handle = directoryHandle ?? await (window as FileSystemWindow).showDirectoryPicker?.({
      id: 'writin-local-workspace',
      mode: 'readwrite',
    })
    if (!handle) {
      if (!allowPrivateFallback) return { storage: privateStorageKind(), cancelled: true }
      const storage = privateStorageKind()
      await saveLocalWorkspaceDetails({ name, storage, createdAt })
      return { storage }
    }
    await saveDeviceDirectoryHandle(handle)
    const workspaceName = handle.name || name
    await saveLocalWorkspaceDetails({ name: workspaceName, storage: 'file-system', createdAt })
    await scanAndHydrateLocalWorkspace(handle)
    return { storage: 'file-system' as const }
  } catch (error) {
    if (!allowPrivateFallback && error instanceof DOMException && error.name === 'AbortError') {
      return { storage: privateStorageKind(), cancelled: true }
    }
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      devLog('warn', 'Could not initialize device folder workspace.', error)
    }
  }
  const storage = privateStorageKind()
  await saveLocalWorkspaceDetails({ name, storage, createdAt })
  return { storage }
}

export function isAttachmentDirectoryName(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower.endsWith('_attachments') ||
    lower.endsWith('-attachments') ||
    lower.endsWith('.attachments')
  )
}

export function parseDataUrl(dataUrl: string): { mimeType: string; data: Uint8Array } | null {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/u.exec(dataUrl)
  if (!match || !match[2]) return null
  const mimeType = match[1] || 'application/octet-stream'
  try {
    const binaryString = atob(match[2])
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return { mimeType, data: bytes }
  } catch {
    return null
  }
}

export function uint8ArrayToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    const byte = bytes[i]
    if (byte !== undefined) {
      binary += String.fromCharCode(byte)
    }
  }
  const base64 = btoa(binary)
  return `data:${mimeType};base64,${base64}`
}

export function mimeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'weba',
    'audio/aac': 'aac',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
  }
  return map[mimeType.toLowerCase()] || 'bin'
}

export async function extractAndSaveAttachments(
  docDir: FileSystemDirectoryHandle,
  docSafeName: string,
  docJson: JSONContent
): Promise<JSONContent> {
  if (!docDir || !docJson || typeof docDir.getDirectoryHandle !== 'function') return docJson
  try {
    const cloned = JSON.parse(JSON.stringify(docJson)) as JSONContent
    let mediaCounter = 0
    let attachmentsDirHandle: FileSystemDirectoryHandle | null = null
    const activeAttachmentFileNames = new Set<string>()

    async function getAttachmentsDir() {
      if (!attachmentsDirHandle) {
        attachmentsDirHandle = await docDir.getDirectoryHandle(`${docSafeName}_attachments`, { create: true })
      }
      return attachmentsDirHandle
    }

    async function processNode(node: JSONContent) {
      if (
        (node.type === 'imageBlock' || node.type === 'videoBlock' || node.type === 'audioBlock' || node.type === 'fileAttachment') &&
        typeof node.attrs?.src === 'string'
      ) {
        const src = node.attrs.src.trim()
        if (src.startsWith('data:')) {
          const parsed = parseDataUrl(src)
          if (parsed) {
            mediaCounter += 1
            const ext = mimeToExtension(parsed.mimeType)
            let fileName = ''
            if (node.type === 'fileAttachment' && typeof node.attrs.name === 'string' && node.attrs.name.trim()) {
              fileName = sanitizeFileName(node.attrs.name.trim())
              if (!fileName.includes('.')) fileName = `${fileName}.${ext}`
            } else {
              fileName = `media_${mediaCounter}.${ext}`
            }

            try {
              const dir = await getAttachmentsDir()
              const fileHandle = await dir.getFileHandle(fileName, { create: true })
              const writable = await fileHandle.createWritable()
              await writable.write(parsed.data)
              await writable.close()

              node.attrs.src = `./${docSafeName}_attachments/${fileName}`
              activeAttachmentFileNames.add(fileName)
            } catch (err) {
              devLog('warn', 'Failed to write attachment to disk.', err)
            }
          }
        } else if (src.startsWith('./') || isAttachmentDirectoryName(src.split('/')[0] || '')) {
          const cleanSrc = src.replace(/^\.\//u, '')
          const parts = cleanSrc.split('/')
          if (parts.length >= 2) {
            const fileName = parts.slice(1).join('/')
            activeAttachmentFileNames.add(fileName)
          }
        }
      }

      if (Array.isArray(node.content)) {
        for (const child of node.content) {
          await processNode(child)
        }
      }
    }

    await processNode(cloned)

    // Cleanup: Prune unreferenced attachment files or remove empty attachment folder(s)
    const candidateFolders = [
      `${docSafeName}_attachments`,
      `${docSafeName}-attachments`,
      `${docSafeName}.attachments`,
    ]

    for (const folderName of candidateFolders) {
      try {
        const dir = await docDir.getDirectoryHandle(folderName)
        const dirPermission = dir as PermissionedDirectoryHandle
        let remainingFileCount = 0
        if (typeof dirPermission.entries === 'function') {
          const toRemove: string[] = []
          for await (const [entryName, entry] of dirPermission.entries()) {
            if (entry.kind === 'file') {
              if (!activeAttachmentFileNames.has(entryName)) {
                toRemove.push(entryName)
              } else {
                remainingFileCount += 1
              }
            }
          }
          for (const fileName of toRemove) {
            try {
              await dir.removeEntry(fileName)
            } catch {
              // Ignore file removal error
            }
          }
        }

        // If no active attachments exist for this document, remove the folder
        if (activeAttachmentFileNames.size === 0 || remainingFileCount === 0) {
          try {
            await docDir.removeEntry(folderName, { recursive: true })
          } catch {
            // Ignore directory removal error
          }
        }
      } catch {
        // Folder does not exist, nothing to clean
      }
    }

    return cloned
  } catch (err) {
    devLog('warn', 'Failed to extract attachments from document.', err)
    return docJson
  }
}

export async function hydrateAttachments(
  docDir: FileSystemDirectoryHandle,
  docSafeName: string,
  docJson: JSONContent
): Promise<JSONContent> {
  if (!docDir || !docJson || typeof docDir.getDirectoryHandle !== 'function') return docJson
  try {
    const cloned = JSON.parse(JSON.stringify(docJson)) as JSONContent

    async function resolveAttachmentHandle(relativeSrc: string): Promise<FileSystemFileHandle | null> {
      const cleanSrc = relativeSrc.replace(/^\.\//u, '')
      const parts = cleanSrc.split('/')
      if (parts.length < 2) return null
      const folderName = parts[0]
      const fileName = parts.slice(1).join('/')

      const candidateFolders = [
        folderName,
        `${docSafeName}_attachments`,
        `${docSafeName}-attachments`,
        `${docSafeName}.attachments`,
      ]

      for (const folder of candidateFolders) {
        if (!folder) continue
        try {
          const folderHandle = await docDir.getDirectoryHandle(folder)
          return await folderHandle.getFileHandle(fileName)
        } catch {
          // Folder/file not found in this candidate
        }
      }
      return null
    }

    async function processNode(node: JSONContent) {
      if (
        (node.type === 'imageBlock' || node.type === 'videoBlock' || node.type === 'audioBlock' || node.type === 'fileAttachment') &&
        typeof node.attrs?.src === 'string'
      ) {
        const src = node.attrs.src.trim()
        if (src.startsWith('./') || isAttachmentDirectoryName(src.split('/')[0] || '')) {
          try {
            const fileHandle = await resolveAttachmentHandle(src)
            if (fileHandle) {
              const file = await fileHandle.getFile()
              const buffer = await file.arrayBuffer()
              const bytes = new Uint8Array(buffer)
              const mimeType = file.type || 'application/octet-stream'
              node.attrs.src = uint8ArrayToDataUrl(bytes, mimeType)
            }
          } catch (err) {
            devLog('warn', 'Failed to hydrate attachment from disk.', err)
          }
        }
      }

      if (Array.isArray(node.content)) {
        for (const child of node.content) {
          await processNode(child)
        }
      }
    }

    await processNode(cloned)
    return cloned
  } catch (err) {
    devLog('warn', 'Failed to hydrate attachments.', err)
    return docJson
  }
}

export async function syncAttachmentsOnRenameOrMove(
  oldFile: Pick<MyBookFile, 'id' | 'name' | 'folderId'>,
  newFile: Pick<MyBookFile, 'id' | 'name' | 'folderId'>
) {
  try {
    const root = await getWorkspaceEffectiveDirectory(null, true)
    if (!root) return
    const oldDir = await resolveDirectoryHandleForFolder(root, oldFile.folderId ?? null, false)
    if (!oldDir) return
    const newDir = await resolveDirectoryHandleForFolder(root, newFile.folderId ?? null, true)
    if (!newDir) return

    const oldSafe = sanitizeFileName(oldFile.name)
    const newSafe = sanitizeFileName(newFile.name)

    const candidateOldFolders = [
      `${oldSafe}_attachments`,
      `${oldSafe}-attachments`,
      `${oldSafe}.attachments`,
    ]

    for (const oldFolderName of candidateOldFolders) {
      try {
        const oldAttachmentsDir = await oldDir.getDirectoryHandle(oldFolderName)
        const newAttachmentsDir = await newDir.getDirectoryHandle(`${newSafe}_attachments`, { create: true })

        const dirPermission = oldAttachmentsDir as PermissionedDirectoryHandle
        if (typeof dirPermission.entries === 'function') {
          for await (const [fileName, entry] of dirPermission.entries()) {
            if (entry.kind === 'file') {
              const fileHandle = entry as FileSystemFileHandle
              const fileData = await (await fileHandle.getFile()).arrayBuffer()
              const targetHandle = await newAttachmentsDir.getFileHandle(fileName, { create: true })
              const writable = await targetHandle.createWritable()
              await writable.write(fileData)
              await writable.close()
            }
          }
        }
        await oldDir.removeEntry(oldFolderName, { recursive: true })
        break
      } catch {
        // Old attachment directory not found, continue checking
      }
    }
  } catch (error) {
    devLog('warn', 'Could not sync attachments on rename/move.', error)
  }
}

export function documentMarkdown(
  file: Pick<MyBookFile, 'id' | 'name' | 'content'> & { createdAt?: string; updatedAt?: string },
  dirHandle?: FileSystemDirectoryHandle | null
): Promise<string> | string {
  let json: JSONContent
  try {
    json = file.content ? (JSON.parse(file.content) as JSONContent) : { type: 'doc', content: [{ type: 'paragraph' }] }
  } catch {
    json = { type: 'doc', content: [{ type: 'paragraph' }] }
  }

  if (dirHandle) {
    const safeName = sanitizeFileName(file.name)
    return extractAndSaveAttachments(dirHandle, safeName, json).then((processed) =>
      documentToMyBookMarkdown(file.name, processed, {
        documentId: file.id,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      })
    )
  }

  return documentToMyBookMarkdown(file.name, json, {
    documentId: file.id,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  })
}

export async function appContentFromStoredFile(
  file: Pick<MyBookFile, 'name' | 'type'>,
  value: string,
  dirHandle?: FileSystemDirectoryHandle | null
): Promise<string> {
  if (file.type === 'spreadsheet') return value
  try {
    const parsed = myBookMarkdownToDocument(value)
    if (dirHandle) {
      const safeName = sanitizeFileName(file.name)
      const hydrated = await hydrateAttachments(dirHandle, safeName, parsed.document)
      return JSON.stringify(hydrated)
    }
    return JSON.stringify(parsed.document)
  } catch {
    return value
  }
}

export async function scanAndHydrateLocalWorkspace(
  customRoot?: FileSystemDirectoryHandle | null,
  options?: { targetWorkspaceType?: 'local' | 'drive'; triggerDriveSync?: boolean }
): Promise<{ discoveredCount: number; restoredCount: number; deletedCount?: number }> {
  const root = customRoot ?? (await getWorkspaceRootDirectory())
  if (!root) return { discoveredCount: 0, restoredCount: 0, deletedCount: 0 }

  const targetWorkspaceType = options?.targetWorkspaceType ?? (useWorkspaceStore.getState().mode === 'drive' ? 'drive' : 'local')
  const shouldQueueDriveSync = options?.triggerDriveSync ?? (targetWorkspaceType === 'drive')

  let discoveredCount = 0
  let restoredCount = 0
  let deletedCount = 0

  const encounteredFileIds = new Set<string>()
  const encounteredFolderIds = new Set<string>()

  const effectiveRoot = (await getWorkspaceEffectiveDirectory(root, false)) ?? root

  async function scanDirectory(dirHandle: FileSystemDirectoryHandle, parentFolderId: string | null) {
    const dirPermission = dirHandle as PermissionedDirectoryHandle
    if (typeof dirPermission.entries !== 'function') return

    const subdirectories: Array<{ name: string; handle: FileSystemDirectoryHandle }> = []
    const fileEntries: Array<{ name: string; handle: FileSystemFileHandle }> = []

    for await (const [name, entry] of dirPermission.entries()) {
      if (entry.kind === 'directory') {
        if (
          isAttachmentDirectoryName(name) ||
          name === '.git' ||
          name === 'node_modules' ||
          name === LEGACY_ROOT_DIR
        ) {
          continue
        }
        subdirectories.push({ name, handle: entry as FileSystemDirectoryHandle })
      } else if (entry.kind === 'file') {
        if (isAttachmentDirectoryName(name) || name.startsWith('.')) continue
        fileEntries.push({ name, handle: entry as FileSystemFileHandle })
      }
    }

    // Process subdirectories
    for (const { name, handle } of subdirectories) {
      let existingFolder = await db.folders
        .filter((f) => f.workspaceType === targetWorkspaceType && !f.isDeleted && f.parentId === parentFolderId && f.name.toLowerCase() === name.toLowerCase())
        .first()

      if (!existingFolder) {
        const now = new Date().toISOString()
        const newFolder: MyBookFolder = {
          id: crypto.randomUUID(),
          driveFolderId: null,
          workspaceType: targetWorkspaceType,
          name,
          parentId: parentFolderId,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
        }
        await db.folders.add(newFolder)
        existingFolder = newFolder
        restoredCount += 1

        if (shouldQueueDriveSync) {
          await db.syncQueue.add({
            id: crypto.randomUUID(),
            entityType: 'folder',
            entityId: newFolder.id,
            operation: 'create',
            errorMessage: null,
            status: 'pending',
            retryCount: 0,
            createdAt: now,
            updatedAt: now,
          })
        }
      }

      encounteredFolderIds.add(existingFolder.id)
      await scanDirectory(handle, existingFolder.id)
    }

    // Process files
    for (const { name, handle } of fileEntries) {
      if (isAttachmentDirectoryName(name) || name.startsWith('.')) continue

      const isMarkdown = name.endsWith('.md') || name.endsWith('.mybook.md')
      const isSpreadsheet = name.endsWith('.xlsx') || name.endsWith('.mybook.json')
      const isLegacyJson = name.endsWith('.content.json')

      if (!isMarkdown && !isSpreadsheet && !isLegacyJson) continue

      discoveredCount += 1

      try {
        const fileObj = await handle.getFile()
        const text = await fileObj.text()
        const docName = cleanDocumentName(name)
        const now = new Date(fileObj.lastModified || Date.now()).toISOString()

        if (isMarkdown) {
          const parsed = parseMyBookMarkdown(text)
          const documentId = parsed.metadata?.documentId
          const metaCreated = parsed.metadata?.createdAt
          const metaUpdated = parsed.metadata?.updatedAt
          const hydratedDoc = await hydrateAttachments(dirHandle, docName, parsed.document)

          let existingFile: MyBookFile | undefined
          if (documentId) {
            const candidate = await db.files.get(documentId)
            if (candidate && !candidate.isDeleted && candidate.workspaceType === targetWorkspaceType) {
              if (candidate.name.toLowerCase() === docName.toLowerCase() && candidate.folderId === parentFolderId) {
                existingFile = candidate
              } else if (!encounteredFileIds.has(candidate.id)) {
                existingFile = candidate
              }
            }
          }
          if (!existingFile) {
            existingFile = await db.files
              .filter((f) => f.workspaceType === targetWorkspaceType && !f.isDeleted && f.folderId === parentFolderId && f.name.toLowerCase() === docName.toLowerCase() && !encounteredFileIds.has(f.id))
              .first()
          }

          if (!existingFile) {
            const fileCreatedAt = metaCreated || now
            const fileUpdatedAt = metaUpdated || now
            const newFile: MyBookFile = {
              id: crypto.randomUUID(),
              driveFileId: null,
              workspaceType: targetWorkspaceType,
              name: docName,
              type: 'document',
              folderId: parentFolderId,
              content: JSON.stringify(hydratedDoc),
              mimeType: 'application/x-mybook-document',
              createdAt: fileCreatedAt,
              updatedAt: fileUpdatedAt,
              lastSyncedAt: null,
              syncStatus: targetWorkspaceType === 'drive' ? 'pending' : 'local',
              isDeleted: false,
            }
            await db.files.add(newFile)
            encounteredFileIds.add(newFile.id)
            restoredCount += 1

            if (shouldQueueDriveSync) {
              await db.syncQueue.add({
                id: crypto.randomUUID(),
                entityType: 'file',
                entityId: newFile.id,
                operation: 'create',
                errorMessage: null,
                status: 'pending',
                retryCount: 0,
                createdAt: fileCreatedAt,
                updatedAt: fileUpdatedAt,
              })
            }
          } else {
            encounteredFileIds.add(existingFile.id)
            if (hasUnsavedLocalEdits(existingFile.id)) {
              continue
            }
            const hydratedString = JSON.stringify(hydratedDoc)
            const isContentIdentical = existingFile.content === hydratedString
            const isLocationIdentical = existingFile.name.toLowerCase() === docName.toLowerCase() && existingFile.folderId === parentFolderId
            const isIdentical = isContentIdentical && isLocationIdentical

            if (!isIdentical && !existingFile.content) {
              const fileUpdates: Partial<MyBookFile> = {
                name: docName,
                folderId: parentFolderId,
                content: hydratedString,
              }
              await db.files.update(existingFile.id, fileUpdates)
              existingFile = { ...existingFile, ...fileUpdates }
            } else if (!isIdentical) {
              const nextUpdatedAt = metaUpdated && metaUpdated !== existingFile.updatedAt ? metaUpdated : now
              const fileUpdates: Partial<MyBookFile> = {
                name: docName,
                folderId: parentFolderId,
                content: hydratedString,
                updatedAt: nextUpdatedAt,
                syncStatus: targetWorkspaceType === 'drive' ? 'pending' : existingFile.syncStatus,
              }
              await db.files.update(existingFile.id, fileUpdates)
              existingFile = { ...existingFile, ...fileUpdates }

              if (shouldQueueDriveSync) {
                await db.syncQueue.add({
                  id: crypto.randomUUID(),
                  entityType: 'file',
                  entityId: existingFile.id,
                  operation: existingFile.driveFileId ? 'update' : 'create',
                  errorMessage: null,
                  status: 'pending',
                  retryCount: 0,
                  createdAt: nextUpdatedAt,
                  updatedAt: nextUpdatedAt,
                })
              }
            }
          }
        } else if (isSpreadsheet) {
          const existingFile = await db.files
            .filter((f) => f.workspaceType === targetWorkspaceType && !f.isDeleted && f.folderId === parentFolderId && f.name.toLowerCase() === docName.toLowerCase())
            .first()

          if (!existingFile) {
            const newFile: MyBookFile = {
              id: crypto.randomUUID(),
              driveFileId: null,
              workspaceType: targetWorkspaceType,
              name: docName,
              type: 'spreadsheet',
              folderId: parentFolderId,
              content: text,
              mimeType: 'application/x-mybook-spreadsheet',
              createdAt: now,
              updatedAt: now,
              lastSyncedAt: null,
              syncStatus: targetWorkspaceType === 'drive' ? 'pending' : 'local',
              isDeleted: false,
            }
            await db.files.add(newFile)
            encounteredFileIds.add(newFile.id)
            restoredCount += 1

            if (shouldQueueDriveSync) {
              await db.syncQueue.add({
                id: crypto.randomUUID(),
                entityType: 'file',
                entityId: newFile.id,
                operation: 'create',
                errorMessage: null,
                status: 'pending',
                retryCount: 0,
                createdAt: now,
                updatedAt: now,
              })
            }
          } else {
            encounteredFileIds.add(existingFile.id)
            if (hasUnsavedLocalEdits(existingFile.id)) {
              continue
            }
            if (text !== existingFile.content) {
              await db.files.update(existingFile.id, {
                content: text,
                updatedAt: now,
                syncStatus: targetWorkspaceType === 'drive' ? 'pending' : existingFile.syncStatus,
              })
              if (shouldQueueDriveSync) {
                await db.syncQueue.add({
                  id: crypto.randomUUID(),
                  entityType: 'file',
                  entityId: existingFile.id,
                  operation: existingFile.driveFileId ? 'update' : 'create',
                  errorMessage: null,
                  status: 'pending',
                  retryCount: 0,
                  createdAt: now,
                  updatedAt: now,
                })
              }
            }
          }
        } else if (isLegacyJson) {
          const rawId = name.replace(/\.content\.json$/i, '')
          const existingFile = await db.files.get(rawId)
          if (existingFile) {
            encounteredFileIds.add(existingFile.id)
            if (!existingFile.content) {
              await db.files.update(existingFile.id, { content: text, updatedAt: now })
            }
          }
        }
      } catch (err) {
        devLog('warn', `Failed to read disk file during workspace scan: ${name}`, err)
      }
    }
  }

  try {
    await scanDirectory(effectiveRoot, null)
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      await forgetDeviceDirectoryHandle()
      useWorkspaceStore.getState().setMirrorFolderMissing(true)
      return { discoveredCount: 0, restoredCount: 0, deletedCount: 0 }
    }
  }

  // Only process deletions from disk if an active physical device directory handle is linked
  const deviceHandle = customRoot ?? (await getDeviceDirectoryHandle())
  if (!deviceHandle) {
    return { discoveredCount, restoredCount, deletedCount: 0 }
  }

  // Detect and process items deleted locally from disk
  const activeFolders = await db.folders.filter((f) => f.workspaceType === targetWorkspaceType && !f.isDeleted).toArray()
  const activeFiles = await db.files.filter((f) => f.workspaceType === targetWorkspaceType && !f.isDeleted).toArray()

  // MASS DELETION GUARD / ROOT REMOVAL GUARD:
  // 1. If we had active files in DB but encountered ZERO files on disk, the root folder was deleted or emptied!
  //    Under NO CIRCUMSTANCES should this purge Google Drive.
  //    Instead, disconnect mirror and trigger the missing mirror prompt.
  if (activeFiles.length > 0 && encounteredFileIds.size === 0) {
    devLog('warn', 'Mass deletion guard: 0 files found on disk for active workspace. Halting deletion sync.')
    await forgetDeviceDirectoryHandle()
    useWorkspaceStore.getState().setMirrorFolderMissing(true)
    return { discoveredCount: 0, restoredCount: 0, deletedCount: 0 }
  }

  // 2. If more than 2 files AND more than 50% of files disappeared simultaneously:
  const missingFilesCount = activeFiles.filter((f) => !encounteredFileIds.has(f.id)).length
  if (activeFiles.length > 2 && missingFilesCount > 2 && missingFilesCount > activeFiles.length * 0.5) {
    devLog('warn', `Mass deletion guard: ${missingFilesCount}/${activeFiles.length} files missing on disk. Halting deletion sync.`)
    await forgetDeviceDirectoryHandle()
    useWorkspaceStore.getState().setMirrorFolderMissing(true)
    return { discoveredCount: 0, restoredCount: 0, deletedCount: 0 }
  }

  const deleteTimestamp = new Date().toISOString()

  for (const file of activeFiles) {
    if (!encounteredFileIds.has(file.id)) {
      await db.files.update(file.id, {
        isDeleted: true,
        updatedAt: deleteTimestamp,
        syncStatus: shouldQueueDriveSync ? 'pending' : file.syncStatus,
      })
      deletedCount += 1
      if (shouldQueueDriveSync) {
        await db.syncQueue.add({
          id: crypto.randomUUID(),
          entityType: 'file',
          entityId: file.id,
          operation: 'delete',
          errorMessage: null,
          status: 'pending',
          retryCount: 0,
          createdAt: deleteTimestamp,
          updatedAt: deleteTimestamp,
        })
      }
    }
  }

  for (const folder of activeFolders) {
    if (!encounteredFolderIds.has(folder.id)) {
      await db.folders.update(folder.id, {
        isDeleted: true,
        updatedAt: deleteTimestamp,
      })
      deletedCount += 1
      if (shouldQueueDriveSync) {
        await db.syncQueue.add({
          id: crypto.randomUUID(),
          entityType: 'folder',
          entityId: folder.id,
          operation: 'delete',
          errorMessage: null,
          status: 'pending',
          retryCount: 0,
          createdAt: deleteTimestamp,
          updatedAt: deleteTimestamp,
        })
      }
    }
  }

  if (shouldQueueDriveSync && (restoredCount > 0 || deletedCount > 0)) {
    void import('../database/repositories').then((m) => m.processPendingDriveSync()).catch(() => undefined)
  }
  return { discoveredCount, restoredCount, deletedCount }
}

export async function writeLocalWorkspaceFile(
  file: Pick<MyBookFile, 'id' | 'type' | 'name' | 'folderId' | 'content'> & { createdAt?: string; updatedAt?: string }
) {
  try {
    const root = await getWorkspaceEffectiveDirectory(null, true)
    if (!root) return

    const dir = await resolveDirectoryHandleForFolder(root, file.folderId ?? null, true)
    if (!dir) return

    const safeName = sanitizeFileName(file.name)
    const fileName = file.type === 'spreadsheet' ? `${safeName}.xlsx` : `${safeName}.md`

    const fileHandle = await dir.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    const contentToWrite = file.type === 'spreadsheet' ? file.content : await documentMarkdown(file, dir)
    await writable.write(contentToWrite)
    await writable.close()
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      useWorkspaceStore.getState().setMirrorFolderMissing(true)
    }
    devLog('warn', 'Could not write local workspace file.', error)
  }
}

export async function readLocalWorkspaceFile(file: Pick<MyBookFile, 'id' | 'type' | 'name' | 'folderId'>): Promise<string | null> {
  try {
    const root = await getWorkspaceEffectiveDirectory(null, false)
    if (!root) return null

    const dir = await resolveDirectoryHandleForFolder(root, file.folderId ?? null, false)
    if (!dir) return null

    const safeName = sanitizeFileName(file.name)
    const fileName = file.type === 'spreadsheet' ? `${safeName}.xlsx` : `${safeName}.md`

    try {
      const fileHandle = await dir.getFileHandle(fileName)
      const stored = await (await fileHandle.getFile()).text()
      return await appContentFromStoredFile(file, stored, dir)
    } catch {
      // Try legacy portable filename fallback
      try {
        const legacyName = file.type === 'spreadsheet' ? `${file.id}.mybook.json` : `${file.id}.mybook.md`
        const legacyHandle = await dir.getFileHandle(legacyName)
        const stored = await (await legacyHandle.getFile()).text()
        return await appContentFromStoredFile(file, stored, dir)
      } catch {
        return null
      }
    }
  } catch {
    return null
  }
}

export async function deleteLocalWorkspaceFile(file: Pick<MyBookFile, 'id' | 'type' | 'name' | 'folderId'>) {
  try {
    const root = await getWorkspaceEffectiveDirectory(null, false)
    if (!root) return

    const dir = await resolveDirectoryHandleForFolder(root, file.folderId ?? null, false)
    if (!dir) return

    const safeName = sanitizeFileName(file.name)
    const fileName = file.type === 'spreadsheet' ? `${safeName}.xlsx` : `${safeName}.md`

    await Promise.allSettled([
      dir.removeEntry(fileName),
      dir.removeEntry(`${safeName}_attachments`, { recursive: true }),
      dir.removeEntry(`${safeName}-attachments`, { recursive: true }),
      dir.removeEntry(`${safeName}.attachments`, { recursive: true }),
      dir.removeEntry(`${file.id}.content.json`),
      dir.removeEntry(`${file.id}.mybook.md`),
      dir.removeEntry(`${file.id}.mybook.json`),
    ])
  } catch {
    // Non-blocking cleanup
  }
}

export async function ensureLocalWorkspaceFolder(folderId: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await getWorkspaceEffectiveDirectory(null, true)
    if (!root) return null
    return await resolveDirectoryHandleForFolder(root, folderId, true)
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      useWorkspaceStore.getState().setMirrorFolderMissing(true)
    }
    devLog('warn', 'Could not ensure local workspace folder.', error)
    return null
  }
}

export async function deleteLocalWorkspaceFolder(folderId: string) {
  try {
    const root = await getWorkspaceEffectiveDirectory(null, false)
    if (!root) return
    const folder = await db.folders.get(folderId)
    if (!folder) return
    const parentDir = await resolveDirectoryHandleForFolder(root, folder.parentId, false)
    if (!parentDir) return
    const safeName = sanitizeFileName(folder.name)
    await parentDir.removeEntry(safeName, { recursive: true })
  } catch {
    // Non-blocking cleanup
  }
}

