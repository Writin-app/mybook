export type FileType = 'document' | 'spreadsheet'
export type WorkspaceType = 'local' | 'drive'
export type SyncStatus = 'local' | 'pending' | 'backing-up' | 'backed-up' | 'failed' | 'offline'
export type EditorSaveStatus = 'editing' | 'saving-locally' | 'saved-locally' | SyncStatus
export type FileSort = 'recent' | 'name-asc' | 'name-desc' | 'type' | 'oldest'
export type FileFilter = 'all' | 'document' | 'spreadsheet'

export interface MyBookFile {
  id: string
  driveFileId: string | null
  workspaceType?: WorkspaceType
  name: string
  type: FileType
  folderId: string | null
  content: string
  mimeType: string
  createdAt: string
  updatedAt: string
  lastSyncedAt: string | null
  /** Last content known to match the remote copy; the common ancestor for reconciling local and remote edits. */
  baseContent?: string | null
  /** Set when a remote update could not be applied without discarding local edits. */
  syncConflict?: SyncConflict | null
  syncError?: string | null
  syncStatus: SyncStatus
  isDeleted: boolean
  isFavorite?: boolean
  isLocked?: boolean
  /** Product-level writing-language profile ID, or `automatic` for unresolved language. */
  writingLanguage?: string
}

export interface SyncConflict {
  remoteModifiedTime: string
  /** File version holding the remote content that was not applied. */
  versionId: string
  detectedAt: string
}

export type FileVersionSource = 'local' | 'drive'

export interface MyBookFileVersion {
  id: string
  fileId: string
  source: FileVersionSource
  content: string
  name: string
  mimeType: string
  driveFileId: string | null
  driveModifiedTime: string | null
  createdAt: string
  label: string
}

export interface MyBookFolder {
  id: string
  driveFolderId: string | null
  workspaceType?: WorkspaceType
  name: string
  parentId: string | null
  createdAt: string
  updatedAt: string
  isDeleted: boolean
  isFavorite?: boolean
}

export type SyncEntityType = 'file' | 'folder'
export type SyncOperation = 'create' | 'update' | 'metadata-update' | 'delete' | 'restore' | 'permanent-delete'
export type SyncQueueStatus = 'pending' | 'processing' | 'failed' | 'completed'

export interface SyncQueueItem {
  id: string
  entityId: string
  entityType: SyncEntityType
  operation: SyncOperation
  status: SyncQueueStatus
  retryCount: number
  createdAt: string
  updatedAt: string
  errorMessage: string | null
}

export interface AppSetting {
  key: string
  value: unknown
  updatedAt: string
}
