import { useAuthStore } from '../stores/useAuthStore'
import { db } from '../database/db'
import type { JSONContent } from '@tiptap/core'
import type { MyBookFolder, SyncEntityType, SyncQueueItem } from '../types/files'
import { devLog } from '../utils/safeLog'
import { hasUnsavedLocalEdits } from './localEditState'
import { createConflictedCopyFile, recordRemoteConflict } from './syncConflicts'
import { reconcileExternalUpdate } from './syncReconciler'
import { areDocumentContentsEquivalent } from '../utils/documentMerge'

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document'
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet'
const MYBOOK_MARKDOWN_MIME = 'text/markdown'
const WRITIN_FOLDER_NAME = 'Writin'
export const DRIVE_VAULT_NAME_KEY = 'drive-vault.root-name'

export async function getDriveVaultRootName(): Promise<string> {
  const record = await db.settings.get(DRIVE_VAULT_NAME_KEY)
  if (record && record.key === DRIVE_VAULT_NAME_KEY && typeof record.value === 'string' && record.value.trim()) {
    return record.value.trim()
  }
  return WRITIN_FOLDER_NAME
}

export async function setDriveVaultRootName(name: string): Promise<void> {
  const trimmed = name.trim() || WRITIN_FOLDER_NAME
  await db.settings.put({ key: DRIVE_VAULT_NAME_KEY, value: trimmed, updatedAt: new Date().toISOString() })
}

export interface DriveVaultSummary {
  id: string
  name: string
  modifiedTime?: string
}

function normalizedDriveFolderName(name: string) {
  return name.trim().toLocaleLowerCase()
}

async function listDriveRootFolders(): Promise<DriveFolder[]> {
  const query = `mimeType='${DRIVE_FOLDER_MIME}' and trashed=false and 'root' in parents`
  const folders = new Map<string, DriveFolder>()
  const seenPages = new Set<string>()
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      q: query,
      fields: 'nextPageToken,incompleteSearch,files(id,name,mimeType,trashed,modifiedTime,appProperties,parents)',
      spaces: 'drive',
      pageSize: '1000',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const result = await driveFetch(`/files?${params}`)
    if (!result.success) throw new Error(result.error)
    const data = await result.response.json() as { files?: DriveFolder[]; nextPageToken?: string; incompleteSearch?: boolean }
    if (data.incompleteSearch || !Array.isArray(data.files)) {
      throw new Error('Drive root folder search was incomplete. Please retry; no folder was created.')
    }
    for (const folder of data.files) {
      if (!folder?.id || !folder.name || folder.mimeType !== DRIVE_FOLDER_MIME || folder.trashed) {
        throw new Error('Drive returned incomplete root folder details. Please retry; no folder was created.')
      }
      folders.set(folder.id, folder)
    }
    pageToken = data.nextPageToken
    if (pageToken) {
      if (seenPages.has(pageToken)) throw new Error('Drive root folder search could not finish. Please retry.')
      seenPages.add(pageToken)
    }
  } while (pageToken)
  return [...folders.values()]
}

export async function findDriveRootFolderByName(name: string): Promise<DriveVaultSummary | null> {
  const normalizedName = normalizedDriveFolderName(name)
  if (!normalizedName) return null
  const folders = await listDriveRootFolders()
  const match = folders.find((folder) => normalizedDriveFolderName(folder.name) === normalizedName)
  return match?.id ? { id: match.id, name: match.name } : null
}

export async function listExistingDriveVaults(): Promise<DriveVaultSummary[]> {
  try {
    const legacyNames = new Set(['writin', 'mybook'])
    const files = await listDriveRootFolders()
    const seen = new Set<string>()
    const vaults: DriveVaultSummary[] = []
    for (const file of files) {
      const isAppVault = file.appProperties?.writin_vault === 'true' || file.appProperties?.mybook_vault === 'true'
      if (!file.id || seen.has(file.id) || file.trashed || (!isAppVault && !legacyNames.has(normalizedDriveFolderName(file.name)))) continue
      seen.add(file.id)
      vaults.push({
        id: file.id,
        name: file.name,
      })
    }
    return vaults
  } catch {
    return []
  }
}

export async function selectExistingDriveVault(folderId: string, folderName: string): Promise<void> {
  await db.settings.put({ key: MYBOOK_FOLDER_KEY, value: folderId, updatedAt: new Date().toISOString() })
  await db.settings.put({ key: DRIVE_VAULT_NAME_KEY, value: folderName, updatedAt: new Date().toISOString() })
}

// Keep the existing setting key so installed users retain their Drive root ID.
const MYBOOK_FOLDER_KEY = 'google-drive.mybook-folder-id'

export interface DriveFolder {
  id: string
  name: string
  mimeType: string
  trashed?: boolean
  explicitlyTrashed?: boolean
  webViewLink?: string
  parents?: string[]
  appProperties?: Record<string, string>
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  trashed?: boolean
  explicitlyTrashed?: boolean
  webViewLink?: string
  parents?: string[]
  appProperties?: Record<string, string>
  modifiedTime?: string
  createdTime?: string
}

export type DriveTrashClassification = 'active' | 'independent-trash-root' | 'recursive-trash-descendant'

export interface DriveTrashMetadata {
  id: string
  name: string
  mimeType: string
  parents: string[]
  trashed: boolean
  explicitlyTrashed: boolean
  appProperties: Record<string, string>
  modifiedTime?: string
  mybookFolderId: string | null
}

export interface ClassifiedDriveTrashItem extends DriveTrashMetadata {
  classification: DriveTrashClassification
  trashedByAncestorDriveId: string | null
}

export type DriveSetupResult =
  | { success: true; folderId: string; folderName: string; created: boolean; modifiedTime?: string }
  | { success: false; error: string }

export type DriveSyncResult =
  | { success: true; driveFolderId: string | null; created: boolean }
  | { success: false; error: string }

function buildHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) {
    return { success: false as const, error: 'Your Google session expired. Please sign in again.' }
  }

  try {
    const response = await fetch(`${DRIVE_API_BASE}${path}`, {
      ...init,
      headers: {
        ...buildHeaders(accessToken),
        ...(init.headers ?? {}),
      },
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string; status?: string } } | null
      const message = body?.error?.message ?? response.statusText
      if (response.status === 401) return { success: false as const, error: 'Google session expired. Please reconnect.' }
      if (response.status === 403) return { success: false as const, error: 'Google Drive permission was denied or is unavailable.' }
      if (response.status === 404) return { success: false as const, error: 'Google Drive folder was not found.' }
      if (!navigator.onLine) return { success: false as const, error: 'You are offline. Connect to the internet and try again.' }
      return { success: false as const, error: message || 'Google Drive request failed.' }
    }

    return { success: true as const, response }
  } catch {
    return { success: false as const, error: navigator.onLine ? 'Could not reach Google Drive. Please try again.' : 'You are offline. Connect to the internet and try again.' }
  }
}

async function driveFetchAllFiles<T>(query: string, fields: string): Promise<T[]> {
  const allFiles: T[] = []
  let pageToken: string | undefined
  const seenPages = new Set<string>()

  do {
    const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
    const path = `/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(`nextPageToken,files(${fields})`)}&spaces=drive&pageSize=1000${pageParam}`
    const result = await driveFetch(path)
    if (!result.success) throw new Error(result.error)
    const data = await result.response.json() as { files?: T[]; nextPageToken?: string }
    if (Array.isArray(data.files)) {
      allFiles.push(...data.files)
    }
    pageToken = data.nextPageToken
    if (pageToken) {
      if (seenPages.has(pageToken)) break
      seenPages.add(pageToken)
    }
  } while (pageToken)

  return allFiles
}

async function listChildFolders(parentId: string): Promise<DriveFolder[]> {
  const query = `'${parentId}' in parents and mimeType='${DRIVE_FOLDER_MIME}' and trashed=false`
  return await driveFetchAllFiles<DriveFolder>(query, 'id,name,mimeType,trashed,webViewLink,appProperties')
}

async function listChildFiles(parentId: string): Promise<DriveFile[]> {
  const query = `'${parentId}' in parents and mimeType!='${DRIVE_FOLDER_MIME}' and trashed=false`
  return await driveFetchAllFiles<DriveFile>(query, 'id,name,mimeType,trashed,webViewLink,parents,modifiedTime,createdTime,appProperties')
}

function normalizeDriveTrashMetadata(item: DriveFile | DriveFolder): DriveTrashMetadata {
  return {
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    parents: item.parents ?? [],
    trashed: item.trashed === true,
    explicitlyTrashed: item.explicitlyTrashed === true,
    appProperties: item.appProperties ?? {},
    modifiedTime: 'modifiedTime' in item ? item.modifiedTime : undefined,
    mybookFolderId: item.appProperties?.mybookFolderId ?? null,
  }
}

function classifyDriveTrashItems(items: DriveTrashMetadata[]): ClassifiedDriveTrashItem[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const explicitTrashAncestorFor = (item: DriveTrashMetadata) => {
    const seen = new Set<string>()
    let currentParentId = item.parents[0] ?? null
    while (currentParentId) {
      if (seen.has(currentParentId)) return null
      seen.add(currentParentId)
      const parent = byId.get(currentParentId)
      if (!parent) return null
      if (parent.trashed && parent.explicitlyTrashed) return parent.id
      currentParentId = parent.parents[0] ?? null
    }
    return null
  }

  return items.map((item) => {
    const trashedByAncestorDriveId = item.trashed && !item.explicitlyTrashed ? explicitTrashAncestorFor(item) : null
    return {
      ...item,
      classification: item.trashed
        ? item.explicitlyTrashed
          ? 'independent-trash-root'
          : 'recursive-trash-descendant'
        : 'active',
      trashedByAncestorDriveId,
    }
  })
}

export function classifyDriveTrashMetadata(items: Array<DriveFile | DriveFolder | DriveTrashMetadata>): ClassifiedDriveTrashItem[] {
  return classifyDriveTrashItems(items.map((item) => normalizeDriveTrashMetadata(item as DriveFile | DriveFolder)))
}

const DRIVE_TRASH_FIELDS = 'id,name,mimeType,parents,trashed,explicitlyTrashed,appProperties,modifiedTime'

export async function listTrashedMyBookDriveFiles(parentId: string): Promise<DriveTrashMetadata[]> {
  const query = `'${parentId}' in parents and mimeType!='${DRIVE_FOLDER_MIME}' and trashed=true`
  const files = await driveFetchAllFiles<DriveFile>(query, DRIVE_TRASH_FIELDS)
  return files.map(normalizeDriveTrashMetadata)
}

export async function listTrashedMyBookDriveFolders(parentId: string): Promise<DriveTrashMetadata[]> {
  const query = `'${parentId}' in parents and mimeType='${DRIVE_FOLDER_MIME}' and trashed=true`
  const folders = await driveFetchAllFiles<DriveFolder>(query, DRIVE_TRASH_FIELDS)
  return folders.map(normalizeDriveTrashMetadata)
}

async function parentMoveParams(fileId: string, targetParentId: string, accessToken: string) {
  const params = new URLSearchParams()
  const currentResponse = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?fields=parents`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!currentResponse.ok) {
    const body = await currentResponse.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not read the Google Drive file location.')
  }
  const current = await currentResponse.json().catch(() => null) as { parents?: string[] } | null
  const currentParents = current?.parents ?? []
  const parentsToRemove = currentParents.filter((parentId) => parentId !== targetParentId)

  if (!currentParents.includes(targetParentId)) params.set('addParents', targetParentId)
  if (parentsToRemove.length) params.set('removeParents', parentsToRemove.join(','))

  return params
}

async function getDriveFileContent(fileId: string) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error('Could not download the file from Google Drive.')
  }
  return await response.text()
}

async function getDriveFileBlob(fileId: string) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Could not download the file from Google Drive.')
  return response.blob()
}

async function exportGoogleWorkspaceFile(fileId: string, mimeType: string) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(mimeType)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Could not export the Google Drive file.')
  return response.blob()
}

export async function downloadDriveFileBlob(fileId: string): Promise<Blob> {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) throw new Error('Could not download the Drive file.')
  return response.blob()
}

export async function listVisibleFoldersByName(name: string, parentId?: string): Promise<DriveFolder[]> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : ''
  const result = await driveFetch(`/files?q=${encodeURIComponent(`mimeType='${DRIVE_FOLDER_MIME}' and name='${name.replace(/'/g, "\\'")}' and trashed=false and 'me' in owners${parentClause}`)}&fields=${encodeURIComponent('files(id,name,mimeType,trashed,webViewLink)')}&spaces=drive`)
  if (!result.success) throw new Error(result.error)
  const data = await result.response.json() as { files?: DriveFolder[] }
  return data.files ?? []
}

export async function createVisibleFolder(name: string, appProperties?: Record<string, string>): Promise<DriveFolder> {
  return createVisibleFolderInParent(name, 'root', appProperties)
}

export async function createVisibleFolderInParent(name: string, parentId: string, appProperties?: Record<string, string>): Promise<DriveFolder> {
  const result = await driveFetch('/files?fields=id,name,mimeType,trashed,webViewLink,appProperties', {
    method: 'POST',
    body: JSON.stringify({
      name,
      mimeType: DRIVE_FOLDER_MIME,
      parents: [parentId],
      ...(appProperties ? { appProperties } : {}),
    }),
  })
  if (!result.success) throw new Error(result.error)
  return await result.response.json() as DriveFolder
}

export async function ensureVisibleFolderInParent(name: string, parentId: string, appProperties?: Record<string, string>) {
  const matches = await listVisibleFoldersByName(name, parentId)
  const existing = matches.find((folder) => folder.mimeType === DRIVE_FOLDER_MIME && !folder.trashed)
  if (existing) {
    if (appProperties && Object.keys(appProperties).length > 0) {
      await updateDriveFolder(existing.id, { appProperties })
    }
    return existing
  }
  return createVisibleFolderInParent(name, parentId, appProperties)
}

export async function updateDriveFolder(folderId: string, changes: { name?: string; parentId?: string | null; appProperties?: Record<string, string> }) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const metadata: Record<string, unknown> = {}
  if (changes.name !== undefined) metadata.name = changes.name
  if (changes.appProperties !== undefined) metadata.appProperties = changes.appProperties
  const params = new URLSearchParams({ fields: 'id,name,mimeType,webViewLink,appProperties' })
  if (changes.parentId) {
    const moveParams = await parentMoveParams(folderId, changes.parentId, accessToken)
    moveParams.forEach((value, key) => params.set(key, value))
  }
  const response = await fetch(`${DRIVE_API_BASE}/files/${folderId}?${params.toString()}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not update the Google Drive folder.')
  }
  return await response.json() as DriveFolder
}

export async function trashDriveFolder(folderId: string) {
  return updateDriveFolderState(folderId, true)
}

export async function permanentlyDeleteDriveFile(fileId: string) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (response.ok || response.status === 404) return
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
  throw new Error(body?.error?.message ?? 'Could not permanently delete the Google Drive item.')
}

export async function restoreDriveFolder(folderId: string) {
  return updateDriveFolderState(folderId, false)
}

async function updateDriveFolderState(folderId: string, trashed: boolean) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`${DRIVE_API_BASE}/files/${folderId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? `Could not ${trashed ? 'trash' : 'restore'} the Google Drive folder.`)
  }
}

export async function createDriveFileInFolder(name: string, content: string, mimeType: string, parentId: string) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')

  const result = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: (() => {
      const boundary = 'mybook-boundary'
      const metadata = JSON.stringify({ name, parents: [parentId], mimeType })
      return new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
        `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n`,
        `--${boundary}--`,
      ], { type: `multipart/related; boundary=${boundary}` })
    })(),
  })

  if (!result.ok) {
    const body = await result.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not create the file in Google Drive.')
  }

  return await result.json() as { id: string; name: string; webViewLink?: string; modifiedTime?: string }
}

export async function updateDriveFile(fileId: string, changes: { name?: string; content?: string; parentId?: string | null; mimeType?: string; trashed?: boolean; appProperties?: Record<string, string> }) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')

  const metadata: Record<string, unknown> = {}
  if (changes.name !== undefined) metadata.name = changes.name
  if (changes.mimeType !== undefined) metadata.mimeType = changes.mimeType
  if (changes.trashed !== undefined) metadata.trashed = changes.trashed
  if (changes.appProperties !== undefined) metadata.appProperties = changes.appProperties

  const parentParams = new URLSearchParams()
  if (changes.parentId !== undefined) {
    if (changes.parentId) {
      const moveParams = await parentMoveParams(fileId, changes.parentId, accessToken)
      moveParams.forEach((value, key) => parentParams.set(key, value))
    }
  }

  if (changes.content === undefined) {
    parentParams.set('fields', 'id,name,webViewLink,parents,appProperties')
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${parentParams.toString()}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
      throw new Error(body?.error?.message ?? 'Could not update the file in Google Drive.')
    }
    return await response.json() as { id: string; name: string; webViewLink?: string }
  }

  const query = new URLSearchParams({ uploadType: 'multipart', fields: 'id,name,webViewLink,parents,appProperties' })
  parentParams.forEach((value, key) => query.set(key, value))
  const boundary = 'mybook-update-boundary'
  const bodyParts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${changes.mimeType ?? 'application/json'}\r\n\r\n${changes.content ?? ''}\r\n`,
    `--${boundary}--`,
  ]

  const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?${query.toString()}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: new Blob(bodyParts, { type: `multipart/related; boundary=${boundary}` }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not update the file in Google Drive.')
  }

  return await response.json() as { id: string; name: string; webViewLink?: string }
}

export async function restoreDriveFile(fileId: string) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: false }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not restore the file in Google Drive.')
  }
}

export async function trashDriveFile(fileId: string) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not delete the file in Google Drive.')
  }
}

export async function retryWithBackoff<T>(task: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      if (attempt === attempts - 1) break
      await new Promise((resolve) => globalThis.setTimeout(resolve, 500 * (2 ** attempt)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The operation could not be completed.')
}

const backupFlights = new Map<string, Promise<DriveSetupResult>>()

async function runSingleFileBackup(fileId: string, task: () => Promise<DriveSetupResult>) {
  const active = backupFlights.get(fileId)
  if (active) return active
  const next = task().finally(() => {
    if (backupFlights.get(fileId) === next) backupFlights.delete(fileId)
  })
  backupFlights.set(fileId, next)
  return next
}

function safeMarkdownName(name: string) {
  return `${name.replace(/\.mybook\.md$/i, '').replace(/\.md$/i, '').trim() || 'Untitled'}.md`
}

async function uploadMarkdownFile(title: string, content: string, parentId: string, fileId?: string | null, appProperties?: Record<string, string>) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const boundary = 'mybook-markdown-boundary'
  const metadata: Record<string, unknown> = {
    name: safeMarkdownName(title),
    ...(fileId ? {} : { parents: [parentId] }),
    mimeType: MYBOOK_MARKDOWN_MIME,
    ...(appProperties ? { appProperties } : {}),
  }
  const method = fileId ? 'PATCH' : 'POST'
  const query = new URLSearchParams({ uploadType: 'multipart', fields: 'id,name,webViewLink,modifiedTime,appProperties' })
  if (fileId) {
    const moveParams = await parentMoveParams(fileId, parentId, accessToken)
    moveParams.forEach((value, key) => query.set(key, value))
  }
  const endpoint = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?${query.toString()}`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,modifiedTime,appProperties'
  const response = await fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    body: new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${MYBOOK_MARKDOWN_MIME}; charset=UTF-8\r\n\r\n${content}\r\n`,
      `--${boundary}--`,
    ], { type: `multipart/related; boundary=${boundary}` }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not upload the Writin Markdown file to Google Drive.')
  }
  return await response.json() as { id: string; name: string; webViewLink?: string; modifiedTime?: string }
}

async function uploadBinaryFile(
  name: string,
  data: Uint8Array,
  mimeType: string,
  parentId: string,
  fileId?: string | null
) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const boundary = 'mybook-binary-attachment-boundary'
  const metadata: Record<string, unknown> = {
    name,
    ...(fileId ? {} : { parents: [parentId] }),
    mimeType,
  }
  const method = fileId ? 'PATCH' : 'POST'
  const query = new URLSearchParams({ uploadType: 'multipart', fields: 'id,name,webViewLink,modifiedTime' })
  if (fileId) {
    const moveParams = await parentMoveParams(fileId, parentId, accessToken)
    moveParams.forEach((value, key) => query.set(key, value))
  }
  const endpoint = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?${query.toString()}`
    : `https://www.googleapis.com/upload/drive/v3/files?${query.toString()}`

  const response = await fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    body: new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      data,
      `\r\n--${boundary}--`,
    ], { type: `multipart/related; boundary=${boundary}` }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? `Could not upload attachment ${name} to Google Drive.`)
  }
  return await response.json() as { id: string; name: string; webViewLink?: string; modifiedTime?: string }
}

function hasMediaNodes(node: JSONContent): boolean {
  if (
    (node.type === 'imageBlock' || node.type === 'videoBlock' || node.type === 'audioBlock' || node.type === 'fileAttachment') &&
    typeof node.attrs?.src === 'string' &&
    node.attrs.src.trim()
  ) {
    return true
  }
  if (Array.isArray(node.content)) {
    return node.content.some(hasMediaNodes)
  }
  return false
}

function hasRelativeAttachmentRefs(node: JSONContent): boolean {
  if (
    (node.type === 'imageBlock' || node.type === 'videoBlock' || node.type === 'audioBlock' || node.type === 'fileAttachment') &&
    typeof node.attrs?.src === 'string'
  ) {
    const src = node.attrs.src.trim()
    if (src.startsWith('./') || src.includes('_attachments/')) {
      return true
    }
  }
  if (Array.isArray(node.content)) {
    return node.content.some(hasRelativeAttachmentRefs)
  }
  return false
}

export async function syncDocumentAttachmentsToDrive(
  title: string,
  parsedContent: JSONContent,
  driveParentId: string
): Promise<JSONContent> {
  if (!hasMediaNodes(parsedContent)) {
    return parsedContent
  }
  const { parseDataUrl, mimeToExtension, sanitizeFileName, isAttachmentDirectoryName } = await import('./localWorkspace')
  const cloned = JSON.parse(JSON.stringify(parsedContent)) as JSONContent
  const docSafeName = sanitizeFileName(title)
  const extractedMedia: Array<{ fileName: string; mimeType: string; data: Uint8Array }> = []
  const activeAttachmentNames = new Set<string>()
  let mediaCounter = 0

  function processNode(node: JSONContent) {
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
          extractedMedia.push({ fileName, mimeType: parsed.mimeType, data: parsed.data })
          node.attrs.src = `./${docSafeName}_attachments/${fileName}`
          activeAttachmentNames.add(fileName.toLowerCase())
        }
      } else if (src.startsWith('./') || isAttachmentDirectoryName(src.split('/')[0] || '')) {
        const cleanSrc = src.replace(/^\.\//u, '')
        const parts = cleanSrc.split('/')
        if (parts.length >= 2) {
          const fileName = parts.slice(1).join('/')
          activeAttachmentNames.add(fileName.toLowerCase())
        }
      }
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        processNode(child)
      }
    }
  }

  processNode(cloned)

  if (extractedMedia.length === 0 && activeAttachmentNames.size === 0) {
    return cloned
  }

  try {
    const attachmentFolderName = `${docSafeName}_attachments`
    const attachmentFolder = await ensureVisibleFolderInParent(attachmentFolderName, driveParentId)
    const existingFiles = await listChildFiles(attachmentFolder.id)
    const existingByName = new Map(existingFiles.map((f) => [f.name.toLowerCase(), f]))

    for (const item of extractedMedia) {
      const existing = existingByName.get(item.fileName.toLowerCase())
      await retryWithBackoff(() => uploadBinaryFile(item.fileName, item.data, item.mimeType, attachmentFolder.id, existing?.id))
    }

    for (const file of existingFiles) {
      if (!activeAttachmentNames.has(file.name.toLowerCase())) {
        try {
          await trashDriveFile(file.id)
        } catch {
          // Ignore cleanup error
        }
      }
    }
  } catch (err) {
    devLog('warn', 'Failed to sync attachments to Google Drive.', err)
  }

  return cloned
}

export async function syncDriveAttachmentsOnRenameOrMove(
  oldTitle: string,
  newTitle: string,
  oldDriveParentId: string,
  newDriveParentId: string
) {
  try {
    const { sanitizeFileName } = await import('./localWorkspace')
    const oldSafe = sanitizeFileName(oldTitle)
    const newSafe = sanitizeFileName(newTitle)
    if (oldSafe.toLowerCase() === newSafe.toLowerCase() && oldDriveParentId === newDriveParentId) return

    const candidateOldFolders = [
      `${oldSafe}_attachments`,
      `${oldSafe}-attachments`,
      `${oldSafe}.attachments`,
    ]

    for (const folderName of candidateOldFolders) {
      const existing = await listVisibleFoldersByName(folderName, oldDriveParentId)
      for (const folder of existing) {
        await updateDriveFolder(folder.id, {
          name: `${newSafe}_attachments`,
          parentId: newDriveParentId !== oldDriveParentId ? newDriveParentId : null,
        })
      }
    }
  } catch (error) {
    devLog('warn', 'Could not sync Drive attachments on rename/move.', error)
  }
}

export async function trashDriveFileAttachments(title: string, driveParentId: string) {
  try {
    const { sanitizeFileName } = await import('./localWorkspace')
    const safeName = sanitizeFileName(title)
    const candidateFolders = [
      `${safeName}_attachments`,
      `${safeName}-attachments`,
      `${safeName}.attachments`,
    ]
    for (const folderName of candidateFolders) {
      const existing = await listVisibleFoldersByName(folderName, driveParentId)
      for (const folder of existing) {
        await trashDriveFolder(folder.id)
      }
    }
  } catch (error) {
    devLog('warn', 'Could not trash Drive attachments folder.', error)
  }
}

export async function backupDocumentToDrive(input: {
  fileId: string
  title: string
  content: string
  folderId: string | null
}): Promise<DriveSetupResult> {
  return runSingleFileBackup(input.fileId, async () => {
    const file = await db.files.get(input.fileId)
    if (!file) return { success: false, error: 'Document could not be found.' }
    const driveBootstrap = await ensureMyBookDriveFolder()
    if (!driveBootstrap.success) return { success: false, error: driveBootstrap.error }
    const parentFolder = input.folderId ? await db.folders.get(input.folderId) : null
    const driveParentId = parentFolder?.driveFolderId ?? driveBootstrap.folderId
    try {
      await db.files.update(file.id, { workspaceType: 'drive', syncStatus: 'backing-up', syncError: null })
      const latest = await db.files.get(input.fileId)
      const content = latest?.content ?? input.content
      const title = latest?.name ?? input.title
      const parsedContent = (() => {
        try { return JSON.parse(content || '{"type":"doc","content":[{"type":"paragraph"}]}') as JSONContent } catch { return { type: 'doc', content: [{ type: 'paragraph' }] } as JSONContent }
      })()

      // Sync companion attachment folder and media files to Google Drive
      const docWithDriveAttachments = await syncDocumentAttachmentsToDrive(title, parsedContent, driveParentId)

      const { documentToMyBookMarkdown } = await import('../utils/mybookMarkdown')
      const markdown = documentToMyBookMarkdown(title, docWithDriveAttachments, { documentId: file.id })
      const isFavorite = latest?.isFavorite ?? file.isFavorite
      const result = await retryWithBackoff(() => uploadMarkdownFile(title, markdown, driveParentId, latest?.driveFileId ?? file.driveFileId, { isFavorite: isFavorite ? 'true' : 'false' }))
      const current = await db.files.get(file.id)
      const changedDuringUpload = !current || current.content !== content || current.name !== title || current.folderId !== (latest?.folderId ?? file.folderId) || current.isDeleted
      await db.files.update(file.id, changedDuringUpload ? {
        driveFileId: result.id,
        workspaceType: 'drive',
        mimeType: 'application/x-mybook-document',
        syncStatus: current?.syncStatus === 'failed' ? 'failed' : 'pending',
        baseContent: content,
        lastSyncedAt: result.modifiedTime ?? latest?.lastSyncedAt ?? file.lastSyncedAt ?? new Date().toISOString(),
      } : {
        driveFileId: result.id,
        workspaceType: 'drive',
        mimeType: 'application/x-mybook-document',
        syncStatus: 'backed-up',
        baseContent: content,
        lastSyncedAt: result.modifiedTime ?? latest?.lastSyncedAt ?? file.lastSyncedAt ?? new Date().toISOString(),
      })
      return { success: true, folderId: driveParentId, folderName: WRITIN_FOLDER_NAME, created: !(latest?.driveFileId ?? file.driveFileId), modifiedTime: result.modifiedTime }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not back up the document to Google Drive.'
      await db.files.update(file.id, { syncStatus: 'failed', syncError: message })
      return { success: false, error: message }
    }
  })
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function safeXlsxName(name: string) {
  return `${name.replace(/\.xlsx$/i, '').trim() || 'Untitled spreadsheet'}.xlsx`
}

async function uploadXlsxBlob(name: string, blob: Blob, parentId: string, fileId?: string | null, targetMimeType = XLSX_MIME, appProperties?: Record<string, string>) {
  const accessToken = await useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const metadata: Record<string, unknown> = {
    name: targetMimeType === GOOGLE_SHEET_MIME ? name.replace(/\.xlsx$/i, '').trim() || 'Untitled spreadsheet' : safeXlsxName(name),
    ...(fileId ? {} : { parents: [parentId] }),
    mimeType: targetMimeType,
    ...(appProperties ? { appProperties } : {}),
  }
  const boundary = 'mybook-xlsx-boundary'
  const method = fileId ? 'PATCH' : 'POST'
  const query = new URLSearchParams({ uploadType: 'multipart', fields: 'id,name,webViewLink,modifiedTime,appProperties' })
  if (fileId) {
    const moveParams = await parentMoveParams(fileId, parentId, accessToken)
    moveParams.forEach((value, key) => query.set(key, value))
  }
  const endpoint = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?${query.toString()}`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,modifiedTime,appProperties'
  const response = await fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    body: new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${XLSX_MIME}\r\n\r\n`,
      blob,
      `\r\n--${boundary}--`,
    ], { type: `multipart/related; boundary=${boundary}` }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not upload the XLSX file to Google Drive.')
  }
  return await response.json() as { id: string; name: string; webViewLink?: string; modifiedTime?: string }
}

export async function backupSpreadsheetToDrive(input: {
  fileId: string
  title: string
  content: string
  folderId: string | null
}): Promise<DriveSetupResult> {
  return runSingleFileBackup(input.fileId, async () => {
    const file = await db.files.get(input.fileId)
    if (!file) return { success: false, error: 'Spreadsheet could not be found.' }
    const driveBootstrap = await ensureMyBookDriveFolder()
    if (!driveBootstrap.success) return { success: false, error: driveBootstrap.error }
    const parentFolder = input.folderId ? await db.folders.get(input.folderId) : null
    const driveParentId = parentFolder?.driveFolderId ?? driveBootstrap.folderId
    try {
      await db.files.update(file.id, { workspaceType: 'drive', syncStatus: 'backing-up', syncError: null })
      const latest = await db.files.get(input.fileId)
      const { exportWorkbookToXlsx } = await import('../utils/xlsx')
      const snapshot = JSON.parse((latest?.content ?? input.content) || '{}')
      const exported = await exportWorkbookToXlsx(snapshot)
      if (!exported.success || !exported.data) throw new Error(exported.error ?? 'Could not convert the spreadsheet to XLSX.')
      const isFavorite = latest?.isFavorite ?? file.isFavorite
      const result = await retryWithBackoff(() => uploadXlsxBlob(latest?.name ?? input.title, exported.data as Blob, driveParentId, latest?.driveFileId ?? file.driveFileId, latest?.mimeType === GOOGLE_SHEET_MIME ? GOOGLE_SHEET_MIME : undefined, { isFavorite: isFavorite ? 'true' : 'false' }))
      const current = await db.files.get(file.id)
      const uploadedContent = latest?.content ?? input.content
      const uploadedTitle = latest?.name ?? input.title
      const changedDuringUpload = !current || current.content !== uploadedContent || current.name !== uploadedTitle || current.folderId !== (latest?.folderId ?? file.folderId) || current.isDeleted
      await db.files.update(file.id, changedDuringUpload
        ? {
            driveFileId: result.id,
            workspaceType: 'drive',
            syncStatus: current?.syncStatus === 'failed' ? 'failed' : 'pending',
            baseContent: uploadedContent,
            lastSyncedAt: result.modifiedTime ?? latest?.lastSyncedAt ?? file.lastSyncedAt ?? new Date().toISOString(),
          }
        : {
            driveFileId: result.id,
            workspaceType: 'drive',
            syncStatus: 'backed-up',
            baseContent: uploadedContent,
            lastSyncedAt: result.modifiedTime ?? latest?.lastSyncedAt ?? file.lastSyncedAt ?? new Date().toISOString(),
          })
      return { success: true, folderId: driveParentId, folderName: WRITIN_FOLDER_NAME, created: !(latest?.driveFileId ?? file.driveFileId), modifiedTime: result.modifiedTime }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not back up the spreadsheet to Google Drive.'
      await db.files.update(file.id, { syncStatus: 'failed', syncError: message })
      return { success: false, error: message }
    }
  })
}

export async function openDriveFileInBrowser(fileId: string) {
  window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank', 'noopener,noreferrer')
}

export async function getDriveFileStatus(fileId: string): Promise<{
  exists: boolean
  name?: string
  mimeType?: string
  parents?: string[]
  modifiedTime?: string
  appProperties?: Record<string, string>
  error?: string
}> {
  const result = await driveFetch(`/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,parents,trashed,modifiedTime,appProperties`)
  if (result.success) {
    const file = await result.response.json() as {
      id?: string
      name?: string
      mimeType?: string
      parents?: string[]
      trashed?: boolean
      modifiedTime?: string
      appProperties?: Record<string, string>
    }
    return {
      exists: Boolean(file.id) && !file.trashed,
      name: file.name,
      mimeType: file.mimeType,
      parents: file.parents,
      modifiedTime: file.modifiedTime,
      appProperties: file.appProperties,
    }
  }
  if (result.error.includes('not found')) return { exists: false }
  return { exists: false, error: result.error }
}

export async function copyDriveFileLink(fileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await navigator.clipboard.writeText(`https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`)
    return { success: true }
  } catch {
    return { success: false, error: 'Could not copy the backup link.' }
  }
}

export async function backfillLocalFoldersToDrive(folders: Array<{ id: string; name: string; parentId: string | null; driveFolderId: string | null; isDeleted?: boolean }>): Promise<DriveSyncResult[]> {
  const localFolders = folders.filter((folder) => !folder.isDeleted)
  const results: DriveSyncResult[] = []
  const pending = new Map(localFolders.map((folder) => [folder.id, folder]))
  const resolved = new Map<string, string>()

  const bootstrap = await ensureMyBookDriveFolder()
  if (!bootstrap.success) return [{ success: false, error: bootstrap.error }]
  resolved.set('root', bootstrap.folderId)

  let progressed = true
  while (pending.size > 0 && progressed) {
    progressed = false
    for (const [id, folder] of pending) {
      const parentKey = folder.parentId ?? 'root'
      const parentDriveId = resolved.get(parentKey)
      if (!parentDriveId) continue
      try {
        const driveFolder = folder.driveFolderId
          ? { id: folder.driveFolderId }
          : await ensureVisibleFolderInParent(folder.name, parentDriveId, { isFavorite: (folder as { isFavorite?: boolean }).isFavorite ? 'true' : 'false' })
        resolved.set(id, driveFolder.id)
        await db.folders.update(id, { driveFolderId: driveFolder.id, workspaceType: 'drive', updatedAt: new Date().toISOString() })
        results.push({ success: true, driveFolderId: driveFolder.id, created: !folder.driveFolderId })
        pending.delete(id)
        progressed = true
      } catch (error) {
        results.push({ success: false, error: error instanceof Error ? error.message : 'Could not backfill folder.' })
        pending.delete(id)
        progressed = true
      }
    }
  }

  if (pending.size > 0) {
    results.push({ success: false, error: 'Some folders could not be backfilled because their parents were missing.' })
  }

  return results
}

export async function importDriveFoldersToLocal(
  onProgress?: (progress: { loaded: number; total: number; percent: number }) => void,
) {
  const bootstrap = await ensureMyBookDriveFolder()
  if (!bootstrap.success) throw new Error(bootstrap.error)

  const localFolders = await db.folders.toArray()
  const unresolvedSync = await unresolvedSyncIndex()
  const byDriveId = new Map<string, MyBookFolder>()
  const byNameAndParent = new Map<string, MyBookFolder>()
  for (const folder of localFolders) {
    if (folder.driveFolderId) {
      byDriveId.set(folder.driveFolderId, preferLocalFolderMatch(byDriveId.get(folder.driveFolderId), folder))
    }
    if (!folder.isDeleted) {
      const key = `${folder.parentId ?? 'root'}:${folder.name.toLowerCase()}`
      byNameAndParent.set(key, preferLocalFolderMatch(byNameAndParent.get(key), folder))
    }
  }
  const seenDriveIds = new Set<string>()
  const visiting = new Set<string>()
  let processedFolders = 0
  let totalDiscoveredFolders = 0
  let maxPercent = 0

  const syncChildren = async (parentDriveId: string, parentLocalId: string | null) => {
    if (visiting.has(parentDriveId)) return
    visiting.add(parentDriveId)
    try {
      const { isAttachmentDirectoryName } = await import('./localWorkspace')
      const children = await listChildFolders(parentDriveId)
      totalDiscoveredFolders += children.length
      for (const driveFolder of children) {
        if (isAttachmentDirectoryName(driveFolder.name)) {
          continue
        }
        if (seenDriveIds.has(driveFolder.id)) {
          continue
        }
        seenDriveIds.add(driveFolder.id)
        const isFavorite = driveFolder.appProperties?.isFavorite === 'true'
        const localMatch = byDriveId.get(driveFolder.id) ?? byNameAndParent.get(`${parentLocalId ?? 'root'}:${driveFolder.name.toLowerCase()}`)
        let matchedLocalId: string
        if (localMatch) {
          matchedLocalId = localMatch.id
          const hasLocalIntent = unresolvedSync.has('folder', localMatch.id)
          if (hasLocalIntent) {
            if (localMatch.driveFolderId !== driveFolder.id || localMatch.workspaceType !== 'drive') {
              await db.folders.update(localMatch.id, { driveFolderId: driveFolder.id, workspaceType: 'drive' })
              localMatch.driveFolderId = driveFolder.id
              localMatch.workspaceType = 'drive'
            }
          } else if (localMatch.name !== driveFolder.name || localMatch.parentId !== parentLocalId || localMatch.driveFolderId !== driveFolder.id || localMatch.isDeleted || Boolean(localMatch.isFavorite) !== isFavorite) {
            const updatedAt = new Date().toISOString()
            await db.folders.update(localMatch.id, {
              name: driveFolder.name,
              parentId: parentLocalId,
              driveFolderId: driveFolder.id,
              workspaceType: 'drive',
              updatedAt,
              isDeleted: false,
              isFavorite,
            })
            localMatch.name = driveFolder.name
            localMatch.parentId = parentLocalId
            localMatch.driveFolderId = driveFolder.id
            localMatch.workspaceType = 'drive'
            localMatch.updatedAt = updatedAt
            localMatch.isDeleted = false
            localMatch.isFavorite = isFavorite
          }
          byDriveId.set(driveFolder.id, localMatch)
          byNameAndParent.set(`${parentLocalId ?? 'root'}:${driveFolder.name.toLowerCase()}`, localMatch)
        } else {
          const now = new Date().toISOString()
          const id = crypto.randomUUID()
          matchedLocalId = id
          const newFolder: MyBookFolder = {
            id,
            name: driveFolder.name,
            parentId: parentLocalId,
            driveFolderId: driveFolder.id,
            workspaceType: 'drive',
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            isFavorite,
          }
          await db.folders.add(newFolder)
          byDriveId.set(driveFolder.id, newFolder)
          byNameAndParent.set(`${parentLocalId ?? 'root'}:${driveFolder.name.toLowerCase()}`, newFolder)
        }
        processedFolders += 1
        const rawPercent = totalDiscoveredFolders > 0 ? Math.min(100, Math.round((processedFolders / totalDiscoveredFolders) * 100)) : 100
        maxPercent = Math.max(maxPercent, rawPercent)
        onProgress?.({ loaded: processedFolders, total: totalDiscoveredFolders, percent: maxPercent })
        await syncChildren(driveFolder.id, matchedLocalId)
      }
    } finally {
      visiting.delete(parentDriveId)
    }
  }

  await syncChildren(bootstrap.folderId, null)
  if (totalDiscoveredFolders === 0) {
    onProgress?.({ loaded: 0, total: 0, percent: 100 })
  }
  const missing = localFolders.filter((folder) => !folder.isDeleted && folder.driveFolderId && !seenDriveIds.has(folder.driveFolderId) && !unresolvedSync.has('folder', folder.id))
  if (missing.length) {
    const allFolders = await db.folders.toArray()
    const allFiles = await db.files.toArray()
    const deletedFolderIds = new Set(missing.map((folder) => folder.id))
    let changed = true
    while (changed) {
      changed = false
      for (const folder of allFolders) {
        if (folder.parentId && deletedFolderIds.has(folder.parentId) && !deletedFolderIds.has(folder.id)) {
          deletedFolderIds.add(folder.id)
          changed = true
        }
      }
    }
    const now = new Date().toISOString()
    await db.transaction('rw', db.folders, db.files, db.syncQueue, async () => {
      const foldersToDelete: string[] = []
      const foldersToDetach: string[] = []
      for (const folderId of deletedFolderIds) {
        if (unresolvedSync.has('folder', folderId)) {
          foldersToDetach.push(folderId)
        } else {
          foldersToDelete.push(folderId)
        }
      }

      await Promise.all(foldersToDelete.map((folderId) => db.folders.update(folderId, { isDeleted: true, updatedAt: now })))
      await Promise.all(foldersToDetach.map((folderId) => db.folders.update(folderId, { parentId: null, updatedAt: now })))

      const filesInDeletedFolders = allFiles.filter((file) => Boolean(file.folderId && deletedFolderIds.has(file.folderId)))
      const filesToDelete = filesInDeletedFolders.filter((file) => !unresolvedSync.has('file', file.id))
      const filesToDetach = filesInDeletedFolders.filter((file) => unresolvedSync.has('file', file.id))

      await Promise.all(filesToDelete.map((file) => db.files.update(file.id, { isDeleted: true, updatedAt: now })))
      await Promise.all(filesToDetach.map((file) => db.files.update(file.id, { folderId: null, updatedAt: now })))

      const trulyDeletedFolderIds = new Set(foldersToDelete)
      await db.syncQueue
        .filter((item) => item.status !== 'completed' && item.entityType === 'folder' && trulyDeletedFolderIds.has(item.entityId))
        .modify({ status: 'completed', errorMessage: 'Deleted in Google Drive.', updatedAt: now })

      const trulyDeletedFileIds = new Set(filesToDelete.map((f) => f.id))
      await db.syncQueue
        .filter((item) => item.status !== 'completed' && item.entityType === 'file')
        .modify((item) => {
          if (trulyDeletedFileIds.has(item.entityId)) {
            item.status = 'completed'
            item.errorMessage = 'Deleted in Google Drive.'
            item.updatedAt = now
          }
        })
    })
  }
}

function inferFileType(name: string, mimeType: string) {
  if (mimeType === GOOGLE_SHEET_MIME || mimeType.includes('spreadsheet') || /\.xlsx$/i.test(name)) return 'spreadsheet' as const
  return 'document' as const
}

function isImportableDriveFile(name: string, mimeType: string, isAttachmentName: (name: string) => boolean) {
  const normalizedMimeType = mimeType.toLowerCase()
  if (isAttachmentName(name)) return false
  if (
    normalizedMimeType.startsWith('image/') ||
    normalizedMimeType.startsWith('video/') ||
    normalizedMimeType.startsWith('audio/') ||
    normalizedMimeType === 'application/pdf' ||
    normalizedMimeType === 'application/zip' ||
    normalizedMimeType === 'application/x-zip-compressed'
  ) {
    return false
  }
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|mp4|webm|mov|m4v|mp3|wav|ogg|m4a|flac|aac|pdf|zip|tar|gz)$/i.test(name)) {
    return false
  }
  return true
}

function localFileName(name: string, type: 'document' | 'spreadsheet') {
  return type === 'spreadsheet'
    ? name.replace(/\.xlsx$/i, '')
    : name.replace(/\.mybook\.md$/i, '').replace(/\.md$/i, '').replace(/\.docx$/i, '')
}

function preferLocalFileMatch<T extends { driveFileId: string | null; syncStatus: string; lastSyncedAt: string | null; updatedAt: string }>(current: T | undefined, candidate: T) {
  if (!current) return candidate
  const currentScore = (current.driveFileId ? 100 : 0) + (current.syncStatus === 'backed-up' ? 20 : 0)
  const candidateScore = (candidate.driveFileId ? 100 : 0) + (candidate.syncStatus === 'backed-up' ? 20 : 0)
  if (candidateScore !== currentScore) return candidateScore > currentScore ? candidate : current
  const currentTime = new Date(current.lastSyncedAt ?? current.updatedAt).getTime()
  const candidateTime = new Date(candidate.lastSyncedAt ?? candidate.updatedAt).getTime()
  return candidateTime > currentTime ? candidate : current
}

function preferLocalFolderMatch(current: MyBookFolder | undefined, candidate: MyBookFolder): MyBookFolder {
  if (!current) return candidate
  const currentActiveScore = current.isDeleted ? 0 : 100
  const candidateActiveScore = candidate.isDeleted ? 0 : 100
  if (candidateActiveScore !== currentActiveScore) {
    return candidateActiveScore > currentActiveScore ? candidate : current
  }
  const currentDriveScore = current.driveFolderId ? 50 : 0
  const candidateDriveScore = candidate.driveFolderId ? 50 : 0
  if (candidateDriveScore !== currentDriveScore) {
    return candidateDriveScore > currentDriveScore ? candidate : current
  }
  const currentTime = new Date(current.updatedAt).getTime()
  const candidateTime = new Date(candidate.updatedAt).getTime()
  return candidateTime >= currentTime ? candidate : current
}

function normalizedTitle(value: string) {
  return value.replace(/\.(docx|xlsx)$/i, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function driveModifiedAfterLastSync(driveModifiedTime: string, lastSyncedAt: string | null) {
  if (!lastSyncedAt) return true
  return new Date(driveModifiedTime).getTime() > new Date(lastSyncedAt).getTime()
}

function isUnresolvedSyncItem(item: SyncQueueItem) {
  return item.status === 'pending' || item.status === 'processing' || item.status === 'failed'
}

async function unresolvedSyncIndex() {
  const items = await db.syncQueue.filter(isUnresolvedSyncItem).toArray()
  const unresolved = new Set<string>()
  for (const item of items) unresolved.add(`${item.entityType}:${item.entityId}`)
  return {
    has(entityType: SyncEntityType, entityId: string) {
      return unresolved.has(`${entityType}:${entityId}`)
    },
  }
}

function textNode(text: string, marks: Array<{ type: string; attrs?: Record<string, unknown> }> = []): JSONContent[] {
  return text ? [{ type: 'text', text, ...(marks.length ? { marks } : {}) }] : []
}

function markForElement(element: Element, marks: Array<{ type: string; attrs?: Record<string, unknown> }>) {
  const tag = element.tagName.toLowerCase()
  if (tag === 'strong' || tag === 'b') return [...marks, { type: 'bold' }]
  if (tag === 'em' || tag === 'i') return [...marks, { type: 'italic' }]
  if (tag === 'u') return [...marks, { type: 'underline' }]
  if (tag === 's' || tag === 'strike' || tag === 'del') return [...marks, { type: 'strike' }]
  if (tag === 'a') {
    const href = element.getAttribute('href')
    return href ? [...marks, { type: 'link', attrs: { href } }] : marks
  }
  return marks
}

function inlineJson(node: Node, marks: Array<{ type: string; attrs?: Record<string, unknown> }> = []): JSONContent[] {
  if (node.nodeType === Node.TEXT_NODE) return textNode(node.textContent ?? '', marks)
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const element = node as Element
  if (element.tagName.toLowerCase() === 'br') return [{ type: 'hardBreak' }]
  const nextMarks = markForElement(element, marks)
  return [...element.childNodes].flatMap((child) => inlineJson(child, nextMarks))
}

function paragraphJson(element: Element): JSONContent {
  const content = [...element.childNodes].flatMap((child) => inlineJson(child))
  return { type: 'paragraph', ...(content.length ? { content } : {}) }
}

function listJson(element: Element, ordered: boolean): JSONContent {
  const items = [...element.children]
    .filter((child) => child.tagName.toLowerCase() === 'li')
    .map((child) => {
      const blocks = blockJson(child)
      return { type: 'listItem', content: blocks.length ? blocks : [paragraphJson(child)] }
    })
  return { type: ordered ? 'orderedList' : 'bulletList', content: items }
}

function tableJson(element: Element): JSONContent {
  const rows = [...element.querySelectorAll('tr')].map((row) => ({
    type: 'tableRow',
    content: [...row.children].filter((cell) => ['td', 'th'].includes(cell.tagName.toLowerCase())).map((cell) => ({
      type: 'tableCell',
      content: [paragraphJson(cell)],
    })),
  })).filter((row) => row.content.length)
  return { type: 'table', content: rows }
}

function blockJson(node: Node): JSONContent[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim()
    return text ? [{ type: 'paragraph', content: textNode(text) }] : []
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const element = node as Element
  const tag = element.tagName.toLowerCase()
  if (tag === 'p') {
    const img = element.querySelector('img')
    if (img && !element.textContent?.trim()) {
      const src = img.getAttribute('src')
      if (src) {
        return [{
          type: 'imageBlock',
          attrs: {
            src,
            alt: img.getAttribute('alt') || '',
          },
        }]
      }
    }
    return [paragraphJson(element)]
  }
  if (tag === 'img') {
    const src = element.getAttribute('src')
    if (src) {
      return [{
        type: 'imageBlock',
        attrs: {
          src,
          alt: element.getAttribute('alt') || '',
        },
      }]
    }
    return []
  }
  if (tag === 'figure') {
    const img = element.querySelector('img')
    if (img?.getAttribute('src')) {
      return [{
        type: 'imageBlock',
        attrs: {
          src: img.getAttribute('src') || '',
          alt: img.getAttribute('alt') || element.querySelector('figcaption')?.textContent || '',
          caption: element.querySelector('figcaption')?.textContent || '',
        },
      }]
    }
  }
  if (/^h[1-6]$/.test(tag)) return [{ type: 'heading', attrs: { level: Math.min(Number(tag.slice(1)), 3) }, content: inlineJson(element) }]
  if (tag === 'ul') return [listJson(element, false)]
  if (tag === 'ol') return [listJson(element, true)]
  if (tag === 'blockquote') return [{ type: 'blockquote', content: [...element.childNodes].flatMap((child) => blockJson(child)) }]
  if (tag === 'table') return [tableJson(element)]
  if (tag === 'hr') return [{ type: 'horizontalRule' }]
  if (tag === 'li') {
    const childBlocks = [...element.childNodes].flatMap((child) => blockJson(child))
    return childBlocks.length ? childBlocks : [paragraphJson(element)]
  }
  return [...element.childNodes].flatMap((child) => blockJson(child))
}

function stripLeadingTitleNodes(content: JSONContent[], fileName: string) {
  const title = normalizedTitle(fileName)
  if (!title) return content
  let start = 0
  while (start < content.length) {
    const node = content[start]
    if (node?.type !== 'paragraph' && node?.type !== 'heading') break
    const text = (node.content ?? []).map((child) => child.text ?? '').join('')
    if (normalizedTitle(text) !== title) break
    start += 1
  }
  return content.slice(start)
}

function tiptapDocFromHtml(html: string, fileName: string) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const content = stripLeadingTitleNodes([...document.body.childNodes].flatMap((child) => blockJson(child)), fileName)
  return JSON.stringify({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] })
}

async function hydrateDriveAttachments(
  docName: string,
  parentDriveId: string | null,
  docJson: JSONContent
): Promise<JSONContent> {
  if (!hasRelativeAttachmentRefs(docJson)) return docJson
  try {
    let resolvedParentDriveId = parentDriveId
    if (!resolvedParentDriveId) {
      const bootstrap = await ensureMyBookDriveFolder()
      if (bootstrap.success) resolvedParentDriveId = bootstrap.folderId
    }
    if (!resolvedParentDriveId) return docJson

    const { sanitizeFileName, isAttachmentDirectoryName, uint8ArrayToDataUrl } = await import('./localWorkspace')
    const cleanDocName = docName
      .replace(/\.mybook\.md$/i, '')
      .replace(/\.md$/i, '')
      .replace(/\.docx$/i, '')
      .trim()
    const safeDocName = sanitizeFileName(cleanDocName)
    const candidateFolders = [
      `${safeDocName}_attachments`,
      `${safeDocName}-attachments`,
      `${safeDocName}.attachments`,
      `${sanitizeFileName(docName)}_attachments`,
    ]

    let attachmentFolder: DriveFile | null = null
    for (const candidate of candidateFolders) {
      const existing = await listVisibleFoldersByName(candidate, resolvedParentDriveId)
      if (existing.length > 0 && existing[0]) {
        attachmentFolder = existing[0]
        break
      }
    }
    if (!attachmentFolder) return docJson

    const driveFiles = await listChildFiles(attachmentFolder.id)
    if (driveFiles.length === 0) return docJson

    const filesByName = new Map(driveFiles.map((f) => [f.name.toLowerCase(), f]))
    const cloned = JSON.parse(JSON.stringify(docJson)) as JSONContent

    async function processNode(node: JSONContent) {
      if (
        (node.type === 'imageBlock' || node.type === 'videoBlock' || node.type === 'audioBlock' || node.type === 'fileAttachment') &&
        typeof node.attrs?.src === 'string'
      ) {
        const src = node.attrs.src.trim()
        if (src.startsWith('./') || isAttachmentDirectoryName(src.split('/')[0] || '')) {
          const cleanSrc = src.replace(/^\.\//u, '')
          const parts = cleanSrc.split('/')
          if (parts.length >= 2) {
            const fileName = parts.slice(1).join('/').toLowerCase()
            const matchedDriveFile = filesByName.get(fileName)
            if (matchedDriveFile) {
              const blob = await downloadDriveFileBlob(matchedDriveFile.id)
              const buffer = await blob.arrayBuffer()
              const bytes = new Uint8Array(buffer)
              const mimeType = matchedDriveFile.mimeType || 'application/octet-stream'
              node.attrs.src = uint8ArrayToDataUrl(bytes, mimeType)
            }
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
    devLog('warn', 'Failed to hydrate Drive attachments.', err)
    return docJson
  }
}

async function readDriveFileAsLocalContent(file: DriveFile, localFileId: string) {
  if (file.mimeType === MYBOOK_MARKDOWN_MIME || /\.md$/i.test(file.name)) {
    const { parseMyBookMarkdown } = await import('../utils/mybookMarkdown')
    const parsed = parseMyBookMarkdown(await getDriveFileContent(file.id))
    const parentDriveId = file.parents?.[0] ?? null
    const cleanDocTitle = file.name
      .replace(/\.mybook\.md$/i, '')
      .replace(/\.md$/i, '')
      .replace(/\.docx$/i, '')
      .trim()
    const hydratedDoc = await hydrateDriveAttachments(cleanDocTitle, parentDriveId, parsed.document)
    return { content: JSON.stringify(hydratedDoc), documentId: parsed.metadata.documentId }
  }
  if (file.mimeType === GOOGLE_DOC_MIME || file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(file.name)) {
    const blob = file.mimeType === GOOGLE_DOC_MIME
      ? await exportGoogleWorkspaceFile(file.id, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      : await getDriveFileBlob(file.id)
    const mammoth = (await import('mammoth')).default
    const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() })
    return { content: tiptapDocFromHtml(result.value, file.name) }
  }
  if (file.mimeType === GOOGLE_SHEET_MIME || file.mimeType === XLSX_MIME || /\.xlsx$/i.test(file.name)) {
    const blob = file.mimeType === GOOGLE_SHEET_MIME
      ? await exportGoogleWorkspaceFile(file.id, XLSX_MIME)
      : await getDriveFileBlob(file.id)
    const { importXlsxToWorkbook } = await import('../utils/xlsx')
    const imported = await importXlsxToWorkbook({
      name: file.name,
      type: file.mimeType,
      size: blob.size,
      arrayBuffer: () => blob.arrayBuffer(),
    }, localFileId)
    if (!imported.success || !imported.data) throw new Error(imported.error ?? 'Could not import the Drive spreadsheet.')
    return { content: JSON.stringify(imported.data) }
  }
  return { content: await getDriveFileContent(file.id) }
}

async function saveVersionBeforeDriveUpdate(existingId: string, driveModifiedTime: string | null) {
  const existing = await db.files.get(existingId)
  if (!existing?.content) return
  await db.fileVersions.add({
    id: crypto.randomUUID(),
    fileId: existing.id,
    source: 'local',
    content: existing.content,
    name: existing.name,
    mimeType: existing.mimeType,
    driveFileId: existing.driveFileId,
    driveModifiedTime,
    createdAt: new Date().toISOString(),
    label: 'Before Drive update',
  })
}

export async function importDriveFilesToLocal(
  onProgress?: (progress: { loaded: number; total: number; percent: number }) => void,
) {
  const bootstrap = await ensureMyBookDriveFolder()
  if (!bootstrap.success) throw new Error(bootstrap.error)

  const { isAttachmentDirectoryName } = await import('./localWorkspace')
  const localFolders = await db.folders.toArray()
  const localFiles = await db.files.toArray()
  const unresolvedSync = await unresolvedSyncIndex()

  // Clean up any rogue media files that might have been accidentally imported
  const rogueFiles = localFiles.filter(
    (file) =>
      !file.isDeleted &&
      (isAttachmentDirectoryName(file.name) ||
       /\.(png|jpe?g|gif|webp|svg|bmp|ico|mp4|webm|mov|m4v|mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name))
  )
  if (rogueFiles.length > 0) {
    const now = new Date().toISOString()
    await db.transaction('rw', db.files, async () => {
      for (const file of rogueFiles) {
        await db.files.update(file.id, { isDeleted: true, updatedAt: now })
      }
    })
  }

  const usedLocalFileIds = new Set(localFiles.map((file) => file.id))
  const byDriveId = new Map(localFiles.filter((file) => file.driveFileId).map((file) => [file.driveFileId as string, file]))
  const byNameAndParent = new Map<string, typeof localFiles[number]>()
  for (const file of localFiles) {
    const exactKey = `${file.folderId ?? 'root'}:${file.name.toLowerCase()}`
    const localNameKey = `${file.folderId ?? 'root'}:${localFileName(file.name, file.type).toLowerCase()}`
    byNameAndParent.set(exactKey, preferLocalFileMatch(byNameAndParent.get(exactKey), file))
    byNameAndParent.set(localNameKey, preferLocalFileMatch(byNameAndParent.get(localNameKey), file))
  }
  const folderByDriveId = new Map<string, MyBookFolder>()
  const folderByNameAndParent = new Map<string, MyBookFolder>()
  for (const folder of localFolders) {
    if (folder.driveFolderId) {
      folderByDriveId.set(folder.driveFolderId, preferLocalFolderMatch(folderByDriveId.get(folder.driveFolderId), folder))
    }
    if (!folder.isDeleted) {
      const key = `${folder.parentId ?? 'root'}:${folder.name.toLowerCase()}`
      folderByNameAndParent.set(key, preferLocalFolderMatch(folderByNameAndParent.get(key), folder))
    }
  }
  const seenDriveFileIds = new Set<string>()
  const visitedDriveFolderIds = new Set<string>()
  let processedFiles = 0
  let totalDiscoveredFiles = 0
  let maxPercent = 0

  const syncFiles = async (parentDriveId: string, parentLocalId: string | null) => {
    let resolvedFolderId = parentLocalId
    if (!resolvedFolderId && parentDriveId !== bootstrap.folderId) {
      const parentFolder = folderByDriveId.get(parentDriveId)
      if (parentFolder) {
        resolvedFolderId = parentFolder.id
      }
    }
    const children = await listChildFiles(parentDriveId)
    const importableChildren = children.filter((file) => isImportableDriveFile(file.name, file.mimeType, isAttachmentDirectoryName))
    totalDiscoveredFiles += importableChildren.length
    for (const driveFile of importableChildren) {
      seenDriveFileIds.add(driveFile.id)
      const fileType = inferFileType(driveFile.name, driveFile.mimeType)
      const effectiveFolderId = resolvedFolderId
      const existing = byDriveId.get(driveFile.id)
        ?? byNameAndParent.get(`${effectiveFolderId ?? 'root'}:${driveFile.name.toLowerCase()}`)
        ?? byNameAndParent.get(`${effectiveFolderId ?? 'root'}:${localFileName(driveFile.name, fileType).toLowerCase()}`)
      const now = new Date().toISOString()
      let localId = existing?.id ?? crypto.randomUUID()
      const driveModifiedTime = driveFile.modifiedTime ?? now
      let content = ''
      let portableDocumentId: string | undefined
      const isRemoteNewer = new Date(driveModifiedTime).getTime() > new Date(existing?.updatedAt ?? 0).getTime()
      const hasLocalIntent = existing
        ? (
            unresolvedSync.has('file', existing.id) ||
            ((existing.syncStatus === 'pending' || existing.syncStatus === 'backing-up') && !isRemoteNewer)
          )
        : false
      const shouldReadContent = !existing || (!hasLocalIntent && driveModifiedAfterLastSync(driveModifiedTime, existing.lastSyncedAt))
      if (shouldReadContent) {
        try {
          const imported = await readDriveFileAsLocalContent(driveFile, localId)
          content = imported.content
          portableDocumentId = imported.documentId
        } catch {
          content = ''
        }
      }
      if (!existing && fileType === 'document' && portableDocumentId) {
        if (!usedLocalFileIds.has(portableDocumentId)) localId = portableDocumentId
      }
      usedLocalFileIds.add(localId)
      const isFavorite = driveFile.appProperties?.isFavorite === 'true'
      if (existing) {
        const name = localFileName(driveFile.name, fileType)
        const type = existing.type ?? fileType
        const mimeType = driveFile.mimeType || existing.mimeType
        const driveIsNewer = shouldReadContent && isRemoteNewer
        const nextContent = !hasLocalIntent && driveIsNewer && content && content !== existing.content ? content : existing.content
        if (nextContent !== existing.content) await saveVersionBeforeDriveUpdate(existing.id, driveModifiedTime)
        const finalFolderId = effectiveFolderId ?? (parentDriveId === bootstrap.folderId ? null : existing.folderId)
        const userVisibleChanged =
          name !== existing.name ||
          finalFolderId !== existing.folderId ||
          type !== existing.type ||
          nextContent !== existing.content ||
          existing.isDeleted ||
          Boolean(existing.isFavorite) !== isFavorite
        const nextFileChanges = hasLocalIntent ? {
          driveFileId: driveFile.id,
          workspaceType: 'drive' as const,
          type,
          mimeType,
        } : {
          name,
          folderId: finalFolderId,
          driveFileId: driveFile.id,
          workspaceType: 'drive' as const,
          type,
          mimeType,
          content: nextContent,
          baseContent: nextContent,
          updatedAt: userVisibleChanged ? driveModifiedTime : existing.updatedAt,
          lastSyncedAt: driveModifiedTime,
          syncStatus: 'backed-up' as const,
          syncError: null,
          isDeleted: false,
          isFavorite,
        }
        if (hasLocalIntent || userVisibleChanged || existing.driveFileId !== driveFile.id || existing.workspaceType !== 'drive' || !existing.lastSyncedAt || new Date(driveModifiedTime).getTime() > new Date(existing.lastSyncedAt).getTime() || existing.syncStatus !== 'backed-up' || existing.syncError) {
          await db.files.update(existing.id, nextFileChanges)
        }
        const updatedFile = { ...existing, ...nextFileChanges }
        byDriveId.set(driveFile.id, updatedFile)
        byNameAndParent.set(`${finalFolderId ?? 'root'}:${updatedFile.name.toLowerCase()}`, updatedFile)
      } else {
        const newFile = {
          id: localId,
          driveFileId: driveFile.id,
          workspaceType: 'drive' as const,
          name: localFileName(driveFile.name, fileType),
          type: fileType,
          folderId: effectiveFolderId,
          content,
          baseContent: content,
          mimeType: driveFile.mimeType,
          createdAt: driveFile.createdTime ?? now,
          updatedAt: driveModifiedTime,
          lastSyncedAt: driveModifiedTime,
          syncStatus: 'backed-up' as const,
          isDeleted: false,
          isFavorite,
        }
        await db.files.add(newFile)
        byDriveId.set(driveFile.id, newFile)
        byNameAndParent.set(`${effectiveFolderId ?? 'root'}:${newFile.name.toLowerCase()}`, newFile)
      }
      processedFiles += 1
      const rawPercent = totalDiscoveredFiles > 0 ? Math.min(100, Math.round((processedFiles / totalDiscoveredFiles) * 100)) : 100
      maxPercent = Math.max(maxPercent, Math.min(99, rawPercent))
      onProgress?.({ loaded: processedFiles, total: totalDiscoveredFiles, percent: maxPercent })
    }
  }

  const walk = async (parentDriveId: string, parentLocalId: string | null) => {
    if (visitedDriveFolderIds.has(parentDriveId)) return
    visitedDriveFolderIds.add(parentDriveId)

    await syncFiles(parentDriveId, parentLocalId)
    const children = await listChildFolders(parentDriveId)
    for (const driveFolder of children) {
      if (isAttachmentDirectoryName(driveFolder.name)) {
        continue
      }
      const localMatch = folderByDriveId.get(driveFolder.id) ?? folderByNameAndParent.get(`${parentLocalId ?? 'root'}:${driveFolder.name.toLowerCase()}`)
      let nextLocalId: string
      if (localMatch) {
        nextLocalId = localMatch.id
        folderByDriveId.set(driveFolder.id, localMatch)
        folderByNameAndParent.set(`${parentLocalId ?? 'root'}:${driveFolder.name.toLowerCase()}`, localMatch)
      } else {
        const now = new Date().toISOString()
        const id = crypto.randomUUID()
        nextLocalId = id
        const newFolder: MyBookFolder = {
          id,
          name: driveFolder.name,
          parentId: parentLocalId,
          driveFolderId: driveFolder.id,
          workspaceType: 'drive',
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          isFavorite: driveFolder.appProperties?.isFavorite === 'true',
        }
        await db.folders.add(newFolder)
        folderByDriveId.set(driveFolder.id, newFolder)
        folderByNameAndParent.set(`${parentLocalId ?? 'root'}:${driveFolder.name.toLowerCase()}`, newFolder)
      }
      await walk(driveFolder.id, nextLocalId)
    }
  }

  await walk(bootstrap.folderId, null)
  const missingFiles = localFiles.filter((file) => !file.isDeleted && file.driveFileId && !seenDriveFileIds.has(file.driveFileId) && !unresolvedSync.has('file', file.id))
  if (missingFiles.length) {
    const now = new Date().toISOString()
    const missingFileIds = new Set(missingFiles.map((file) => file.id))
    await db.transaction('rw', db.files, db.syncQueue, async () => {
      await Promise.all(missingFiles.map((file) => db.files.update(file.id, { isDeleted: true, updatedAt: now })))
      await db.syncQueue
        .filter((item) => item.status !== 'completed' && item.entityType === 'file' && missingFileIds.has(item.entityId))
        .modify({ status: 'completed', errorMessage: 'Deleted in Google Drive.', updatedAt: now })
    })
  }
  onProgress?.({ loaded: processedFiles, total: totalDiscoveredFiles, percent: 100 })
}

const refreshDriveFileInFlight = new Map<string, Promise<{ updated: boolean; modifiedTime?: string; error?: string }>>()

export async function refreshDriveFileToLocal(fileId: string): Promise<{ updated: boolean; modifiedTime?: string; error?: string }> {
  const existingFlight = refreshDriveFileInFlight.get(fileId)
  if (existingFlight) return existingFlight

  const flight = (async () => {
    // If a backup is actively running for this file, await it so baseline and lastSyncedAt are committed
    const activeBackup = backupFlights.get(fileId)
    if (activeBackup) {
      try {
        await activeBackup
      } catch {
        // Backup finished with error; continue with check
      }
    }

    const local = await db.files.get(fileId)
    if (!local?.driveFileId) return { updated: false }
    if (local.syncStatus === 'backing-up') {
      return { updated: false }
    }
    try {
      const status = await getDriveFileStatus(local.driveFileId)
      if (!status.exists) return { updated: false, error: status.error ?? 'Drive file was not found.' }
      const driveModifiedTime = status.modifiedTime ?? new Date().toISOString()

      // Already surfaced as a conflict; wait for the user to resolve it unless
      // its saved remote copy now matches the local snapshot. That case is a
      // stale false alarm (for example, autosave caught up after polling).
      if (local.syncConflict?.remoteModifiedTime === driveModifiedTime) {
        const conflictVersion = await db.fileVersions.get(local.syncConflict.versionId)
        if (conflictVersion && areDocumentContentsEquivalent(local.content, conflictVersion.content)) {
          await db.files.update(local.id, {
            syncConflict: null,
            baseContent: conflictVersion.content,
            lastSyncedAt: driveModifiedTime,
          })
        }
        return { updated: false, modifiedTime: driveModifiedTime }
      }

      // Skip reading content if Drive file hasn't been modified after local sync
      if (!driveModifiedAfterLastSync(driveModifiedTime, local.lastSyncedAt)) {
        return { updated: false, modifiedTime: driveModifiedTime }
      }

      const fileType = local.type ?? inferFileType(status.name ?? local.name, status.mimeType ?? '')
      const driveFile: DriveFile = {
        id: local.driveFileId,
        name: status.name ?? (fileType === 'document' ? safeMarkdownName(local.name) : local.name),
        mimeType: status.mimeType ?? (fileType === 'spreadsheet' ? XLSX_MIME : MYBOOK_MARKDOWN_MIME),
        parents: status.parents,
        modifiedTime: driveModifiedTime,
        appProperties: status.appProperties,
      }
      const imported = await readDriveFileAsLocalContent(driveFile, local.id)
      const content = imported.content
      const cleanTitle = status.name ? localFileName(status.name, fileType) : local.name
      // Re-read right before deciding: the user may have typed during the fetch, or a backup may have finished.
      let latest = await db.files.get(local.id)
      if (!latest) return { updated: false }

      const backupDuringFetch = backupFlights.get(local.id)
      if (backupDuringFetch) {
        try {
          await backupDuringFetch
        } catch {
          // ignore
        }
        const fresh = await db.files.get(local.id)
        if (!fresh) return { updated: false }
        latest = fresh
        if (!driveModifiedAfterLastSync(driveModifiedTime, latest.lastSyncedAt)) {
          return { updated: false, modifiedTime: driveModifiedTime }
        }
      }

      const unresolved = await unresolvedSyncIndex()
      const hasPendingPush = unresolved.has('file', latest.id) || latest.syncStatus === 'pending'
      const unsavedEdits = hasUnsavedLocalEdits(latest.id)
      const decision = content
        ? reconcileExternalUpdate({
          baseContent: latest.baseContent,
          localContent: latest.content,
          syncStatus: latest.syncStatus,
          hasUnsavedLocalEdits: unsavedEdits,
          hasPendingPush,
          remoteChanged: true,
          remoteContent: content,
        })
        : { action: 'noop' as const }

      if (decision.action === 'merge') {
        await saveVersionBeforeDriveUpdate(latest.id, driveModifiedTime)
        const now = new Date().toISOString()
        await db.transaction('rw', db.files, db.syncQueue, async () => {
          await db.files.update(latest.id, {
            content: decision.mergedContent,
            baseContent: content,
            workspaceType: 'drive',
            lastSyncedAt: driveModifiedTime,
            syncStatus: 'pending',
            syncError: null,
            updatedAt: now,
          })
          const existing = await db.syncQueue
            .filter((item) => item.entityType === 'file' && item.entityId === latest.id && item.status !== 'completed')
            .first()
          const operation = latest.driveFileId ? 'update' : 'create'
          if (existing) {
            await db.syncQueue.update(existing.id, {
              operation: existing.operation === 'permanent-delete' ? 'permanent-delete' : operation,
              status: 'pending',
              errorMessage: null,
              updatedAt: now,
            })
          } else {
            await db.syncQueue.add({
              id: crypto.randomUUID(),
              entityId: latest.id,
              entityType: 'file',
              operation,
              status: 'pending',
              retryCount: 0,
              createdAt: now,
              updatedAt: now,
              errorMessage: null,
            })
          }
        })
        void import('../database/repositories').then((m) => m.processPendingDriveSync()).catch(() => {})
        return { updated: true, modifiedTime: driveModifiedTime }
      }

      if (decision.action === 'keep-local') {
        const now = new Date().toISOString()
        await db.transaction('rw', db.files, db.syncQueue, async () => {
          await db.files.update(latest.id, {
            workspaceType: 'drive',
            lastSyncedAt: driveModifiedTime,
            baseContent: latest.baseContent ?? content,
            syncStatus: 'pending',
            syncError: null,
            updatedAt: now,
          })
          const existing = await db.syncQueue
            .filter((item) => item.entityType === 'file' && item.entityId === latest.id && item.status !== 'completed')
            .first()
          const operation = latest.driveFileId ? 'update' : 'create'
          if (existing) {
            await db.syncQueue.update(existing.id, {
              operation: existing.operation === 'permanent-delete' ? 'permanent-delete' : operation,
              status: 'pending',
              errorMessage: null,
              updatedAt: now,
            })
          } else {
            await db.syncQueue.add({
              id: crypto.randomUUID(),
              entityId: latest.id,
              entityType: 'file',
              operation,
              status: 'pending',
              retryCount: 0,
              createdAt: now,
              updatedAt: now,
              errorMessage: null,
            })
          }
        })
        void import('../database/repositories').then((m) => m.processPendingDriveSync()).catch(() => {})
        return { updated: false, modifiedTime: driveModifiedTime }
      }

      if (decision.action === 'conflict') {
        // The Drive response may have raced active typing. Wait for autosave to
        // persist those keystrokes, then compare the saved document before
        // recording a conflict banner.
        if (unsavedEdits) return { updated: false, modifiedTime: driveModifiedTime }
        await recordRemoteConflict(latest.id, content, driveModifiedTime)
        const conflictedCopy = await createConflictedCopyFile(latest.id, content, driveModifiedTime)
        if (conflictedCopy) {
          try {
            const { toast } = await import('../components/ui/toast')
            toast.add({
              title: 'Conflict saved as copy',
              description: `A newer version from Google Drive was saved as "${conflictedCopy.name}".`,
              type: 'warning',
              priority: 'low',
            })
          } catch {
            // Toast not available in background worker or test
          }
        }
        return { updated: false, modifiedTime: driveModifiedTime }
      }

      // Unpushed local work (including renames) is never overwritten by remote metadata.
      if (hasPendingPush || unsavedEdits) return { updated: false, modifiedTime: driveModifiedTime }

      const contentChanged = decision.action === 'apply-remote'
      const titleChanged = Boolean(cleanTitle && cleanTitle !== latest.name)

      if (!contentChanged && !titleChanged) {
        await db.files.update(latest.id, {
          workspaceType: 'drive',
          lastSyncedAt: driveModifiedTime,
          baseContent: latest.content,
          syncStatus: 'backed-up',
          syncError: null,
        })
        return { updated: false, modifiedTime: driveModifiedTime }
      }

      if (contentChanged) {
        await saveVersionBeforeDriveUpdate(latest.id, driveModifiedTime)
      }

      await db.files.update(latest.id, {
        ...(contentChanged ? { content, baseContent: content } : { baseContent: latest.content }),
        ...(titleChanged ? { name: cleanTitle } : {}),
        workspaceType: 'drive',
        lastSyncedAt: driveModifiedTime,
        syncStatus: 'backed-up',
        syncError: null,
        updatedAt: driveModifiedTime,
      })
      return { updated: true, modifiedTime: driveModifiedTime }
    } catch (error) {
      return { updated: false, error: error instanceof Error ? error.message : 'Could not refresh the Drive file.' }
    }
  })().finally(() => {
    refreshDriveFileInFlight.delete(fileId)
  })

  refreshDriveFileInFlight.set(fileId, flight)
  return flight
}

// Share setup within a tab; Web Locks also serialize tabs on the same origin.
let driveRootFlight: Promise<DriveSetupResult> | null = null

async function prepareWritinDriveFolder(): Promise<DriveSetupResult> {
  try {
    const storedFolderId = (await db.settings.get(MYBOOK_FOLDER_KEY))?.value
    const targetFolderName = await getDriveVaultRootName()
    let folder: DriveFolder | undefined
    let created = false
    if (typeof storedFolderId === 'string' && storedFolderId.trim()) {
      const result = await driveFetch(`/files/${encodeURIComponent(storedFolderId)}?fields=id,name,mimeType,trashed`)
      if (!result.success) throw new Error(result.error)
      folder = await result.response.json() as DriveFolder
      if (folder.id !== storedFolderId || folder.mimeType !== DRIVE_FOLDER_MIME || folder.trashed) {
        throw new Error('Your existing Drive workspace is unavailable. Restore or reconnect it before syncing. No replacement folder was created.')
      }
    } else {
      const isDefaultTarget = ['writin', 'mybook'].includes(normalizedDriveFolderName(targetFolderName))
      const legacyNames = new Set(isDefaultTarget ? ['writin', 'mybook'] : [normalizedDriveFolderName(targetFolderName)])
      const rootFolders = await listDriveRootFolders()
      const candidates = new Map(rootFolders
        .filter((candidate) => legacyNames.has(normalizedDriveFolderName(candidate.name)))
        .map((candidate) => [candidate.id, candidate]))
      if (candidates.size > 1) {
        throw new Error('Multiple existing Drive workspaces were found. Open the browser already connected to your workspace to rename it safely. No folders were created or merged.')
      }
      folder = candidates.values().next().value
      if (!folder) {
        folder = await createVisibleFolder(targetFolderName, { writin_vault: 'true' })
        created = true
      }
      if (!folder.id || folder.mimeType !== DRIVE_FOLDER_MIME || folder.trashed) {
        throw new Error('Drive returned an invalid workspace folder. Please reconnect before syncing.')
      }
      // Preserve the identity even if the subsequent rename fails or is interrupted.
      await db.settings.put({ key: MYBOOK_FOLDER_KEY, value: folder.id, updatedAt: new Date().toISOString() })
    }
    if (folder.name !== targetFolderName) {
      const result = await driveFetch(`/files/${encodeURIComponent(folder.id)}?fields=id,name,mimeType,trashed`, {
        method: 'PATCH',
        body: JSON.stringify({ name: targetFolderName }),
      })
      if (!result.success) throw new Error(`Could not rename your existing Drive folder to ${targetFolderName}. ${result.error} Your folder and files have not been replaced.`)
      const renamed = await result.response.json() as DriveFolder
      if (renamed.id !== folder.id || renamed.name !== targetFolderName) {
        throw new Error('Drive folder rename could not be confirmed. Please retry; the existing folder ID is retained.')
      }
    }
    return { success: true, folderId: folder.id, folderName: targetFolderName, created }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not prepare the Writin Drive folder.' }
  }
}

// Retain the internal export name for compatibility with existing callers.
export function ensureMyBookDriveFolder(): Promise<DriveSetupResult> {
  driveRootFlight ??= (typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('mybook-drive-root-setup', prepareWritinDriveFolder)
    : prepareWritinDriveFolder()
  ).finally(() => { driveRootFlight = null })
  return driveRootFlight
}

export async function getDriveFolderStatus() {
  const stored = await db.settings.get(MYBOOK_FOLDER_KEY)
  return typeof stored?.value === 'string' ? stored.value : null
}

export function openMyBookFolderInDrive(folderId: string) {
  window.open(`https://drive.google.com/drive/folders/${folderId}`, '_blank', 'noopener,noreferrer')
}
