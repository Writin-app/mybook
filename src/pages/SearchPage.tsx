import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { EmptyState } from '../components/common/EmptyState'
import { SearchInput } from '../components/common/SearchInput'
import { DeleteFileDialog } from '../components/files/DeleteFileDialog'
import { DeleteFolderDialog } from '../components/files/DeleteFolderDialog'
import { FileActionsMenu } from '../components/files/FileActionsMenu'
import { FileCard } from '../components/files/FileCard'
import { FileNameDialog } from '../components/files/FileNameDialog'
import { FolderActionsMenu } from '../components/files/FolderActionsMenu'
import { FolderCard } from '../components/files/FolderCard'
import { FolderNameDialog } from '../components/files/FolderNameDialog'
import { fileRepository, folderRepository } from '../database/repositories'
import { useLibraryData } from '../hooks/useLibraryData'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import type { MyBookFile, MyBookFolder } from '../types/files'
import { formatUpdatedAt } from '../utils/dateFormat'
import { deletedToast } from '../utils/deleteToast'
import { toast } from '../components/ui/toast'

type SearchResult =
  | { kind: 'file'; item: MyBookFile }
  | { kind: 'folder'; item: MyBookFolder }

export function SearchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { files, folders } = useLibraryData()
  const workspaceMode = useWorkspaceStore((state) => state.mode)
  const [query, setQuery] = useState(() => searchParams.get('query') ?? '')
  const [renameTarget, setRenameTarget] = useState<MyBookFile | null>(null)
  const [folderRenameTarget, setFolderRenameTarget] = useState<MyBookFolder | null>(null)
  const [folderDeleteTarget, setFolderDeleteTarget] = useState<MyBookFolder | null>(null)
  const [fileDeleteTarget, setFileDeleteTarget] = useState<MyBookFile | null>(null)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return []
    const matchingFiles: SearchResult[] = files
      .filter((file) => file.name.toLocaleLowerCase().includes(normalizedQuery))
      .map((item) => ({ kind: 'file', item }))
    const matchingFolders: SearchResult[] = folders
      .filter((folder) => folder.name.toLocaleLowerCase().includes(normalizedQuery))
      .map((item) => ({ kind: 'folder', item }))
    return [...matchingFiles, ...matchingFolders].sort(compareResultsByUpdatedAt)
  }, [files, folders, query])

  const itemCount = (targetId: string) =>
    folders.filter((folder) => folder.parentId === targetId).length +
    files.filter((file) => file.folderId === targetId).length
  const folderCount = (targetId: string) => folders.filter((folder) => folder.parentId === targetId).length
  const fileCount = (targetId: string) => files.filter((file) => file.folderId === targetId).length

  const deleteFile = (file: MyBookFile) => {
    void fileRepository.delete(file.id).then((result) => {
      if (!result.success) return
      toast.add(deletedToast({
        itemName: file.name,
        onUndo: () => { void fileRepository.restore(file.id) },
      }))
    })
  }

  const deleteFolder = (folder: MyBookFolder) => {
    void folderRepository.delete(folder.id).then((result) => {
      if (!result.success) return
      toast.add(deletedToast({
        itemName: folder.name,
        onUndo: () => { void folderRepository.restore(folder.id) },
      }))
    })
  }

  return (
    <div className="px-4">
      <div>
        <div className="mt-3">
          <SearchInput
            label="Search files and folders"
            placeholder="Search files and folders..."
            value={query}
            onChange={setQuery}
          />
        </div>
      </div>

      {results.length ? (
        <div className="-mx-4 mt-4 px-1">
          {results.map((result) => {
            if (result.kind === 'folder') {
              const folder = result.item
              return (
                <FolderCard
                  key={`folder:${folder.id}`}
                  name={folder.name}
                  fileCount={fileCount(folder.id)}
                  folderCount={folderCount(folder.id)}
                  driveStatus={workspaceMode === 'local' ? 'Stored locally' : folder.driveFolderId ? 'Synced to Drive' : 'Drive folder pending'}
                  onOpen={() => navigate(`/folders/${folder.id}`)}
                  action={
                    <FolderActionsMenu
                      folderName={folder.name}
                      folders={folders}
                      folderId={folder.id}
                      currentParentId={folder.parentId}
                      isFavorite={Boolean(folder.isFavorite)}
                      onRename={() => setFolderRenameTarget(folder)}
                      onMove={(folderId) => folderRepository.update(folder.id, { parentId: folderId })}
                      onCreateFolder={(name, parentId) => folderRepository.create(name, parentId)}
                      onToggleFavorite={() => void folderRepository.setFavorite(folder.id, !folder.isFavorite)}
                      onDelete={() => setFolderDeleteTarget(folder)}
                    />
                  }
                />
              )
            }
            const file = result.item
            return (
              <FileCard
                key={`file:${file.id}`}
                name={file.name}
                meta={`Updated ${formatUpdatedAt(file.updatedAt)}`}
                type={file.type}
                folderName={folders.find((folder) => folder.id === file.folderId)?.name ?? 'Writin'}
                syncStatus={file.syncStatus}
                onOpen={() => navigate(`/${file.type}/${file.id}`)}
                action={
                  <FileActionsMenu
                    fileName={file.name}
                    folders={folders}
                    currentFolderId={file.folderId}
                    isFavorite={Boolean(file.isFavorite)}
                    onRename={() => setRenameTarget(file)}
                    onDuplicate={() => void fileRepository.duplicate(file.id)}
                    onMove={(folderId) => fileRepository.update(file.id, { folderId })}
                    onCreateFolder={(name, parentId) => folderRepository.create(name, parentId)}
                    onToggleFavorite={() => void fileRepository.setFavorite(file.id, !file.isFavorite)}
                    onDelete={() => setFileDeleteTarget(file)}
                  />
                }
              />
            )
          })}
        </div>
      ) : query.trim() ? (
        <div className="pt-16">
          <EmptyState title="No files or folders found" description="Try another name." />
        </div>
      ) : null}

      <FileNameDialog
        fileName={renameTarget?.name ?? ''}
        isOpen={Boolean(renameTarget)}
        existingFileNames={files
          .filter((file) => file.folderId === renameTarget?.folderId && file.id !== renameTarget?.id)
          .map((file) => file.name)}
        onClose={() => setRenameTarget(null)}
        onSubmit={(name) => renameTarget
          ? fileRepository.update(renameTarget.id, { name })
          : Promise.resolve({ success: false })}
      />
      <FolderNameDialog
        isOpen={Boolean(folderRenameTarget)}
        title="Rename folder"
        submitLabel="Save"
        initialName={folderRenameTarget?.name}
        onClose={() => setFolderRenameTarget(null)}
        existingFolderNames={folders
          .filter((folder) => folder.parentId === folderRenameTarget?.parentId && folder.id !== folderRenameTarget?.id)
          .map((folder) => folder.name)}
        onSubmit={(name) => folderRenameTarget ? folderRepository.update(folderRenameTarget.id, { name }) : Promise.resolve({ success: false })}
      />
      <FolderNameDialog
        isOpen={isCreatingFolder}
        title="Create folder"
        submitLabel="Create"
        onClose={() => setIsCreatingFolder(false)}
        existingFolderNames={folders.filter((f) => f.parentId === null).map((f) => f.name)}
        onSubmit={(name) => folderRepository.create(name)}
        onSuccess={(result) => {
          if (result.data) {
            navigate(`/folders/${result.data.id}`)
            toast.add({ title: `"${result.data.name}" created`, type: 'success', priority: 'low' })
          }
        }}
      />
      <DeleteFileDialog
        isOpen={Boolean(fileDeleteTarget)}
        fileName={fileDeleteTarget?.name ?? ''}
        onClose={() => setFileDeleteTarget(null)}
        onConfirm={() => {
          if (!fileDeleteTarget) return
          deleteFile(fileDeleteTarget)
        }}
      />
      <DeleteFolderDialog
        isOpen={Boolean(folderDeleteTarget)}
        folderName={folderDeleteTarget?.name ?? ''}
        hasContents={folderDeleteTarget ? itemCount(folderDeleteTarget.id) > 0 : false}
        onClose={() => setFolderDeleteTarget(null)}
        onConfirm={() => {
          if (!folderDeleteTarget) return
          deleteFolder(folderDeleteTarget)
        }}
      />
    </div>
  )
}

function compareResultsByUpdatedAt(a: SearchResult, b: SearchResult) {
  const updated = b.item.updatedAt.localeCompare(a.item.updatedAt)
  if (updated !== 0) return updated
  const name = a.item.name.localeCompare(b.item.name, 'en-US', { sensitivity: 'base' })
  if (name !== 0) return name
  if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
  return a.item.id.localeCompare(b.item.id)
}
