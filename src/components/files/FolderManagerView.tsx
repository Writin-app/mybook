import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { fileRepository, folderRepository } from '../../database/repositories'
import { useLibraryData } from '../../hooks/useLibraryData'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import type { MyBookFile, MyBookFolder } from '../../types/files'
import { formatUpdatedAt } from '../../utils/dateFormat'
import { deletedToast } from '../../utils/deleteToast'
import { AppButton } from '../common/AppButton'
import { EmptyState } from '../common/EmptyState'
import { toast } from '../ui/toast'
import { DeleteFileDialog } from './DeleteFileDialog'
import { DeleteFolderDialog } from './DeleteFolderDialog'
import { FileCard } from './FileCard'
import { FileActionsMenu } from './FileActionsMenu'
import { FileNameDialog } from './FileNameDialog'
import { FolderActionsMenu } from './FolderActionsMenu'
import { FolderCard } from './FolderCard'
import { FolderNameDialog } from './FolderNameDialog'
import { useWorkspaceTabsStore } from '../../stores/useWorkspaceTabsStore'
import { useWorkspacePane } from '../../contexts/WorkspacePaneContext'

interface FolderManagerViewProps {
  folderId: string | null
}

export function FolderManagerView({ folderId }: FolderManagerViewProps) {
  const navigate = useNavigate()
  const tabs = useWorkspaceTabsStore()
  const { paneId } = useWorkspacePane()
  const { files, folders, isLoading } = useLibraryData()
  const workspaceMode = useWorkspaceStore((state) => state.mode)
  const [renameTarget, setRenameTarget] = useState<MyBookFolder | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MyBookFolder | null>(null)
  const [fileRenameTarget, setFileRenameTarget] = useState<MyBookFile | null>(null)
  const [fileDeleteTarget, setFileDeleteTarget] = useState<MyBookFile | null>(null)
  const currentFolder = folderId ? folders.find((folder) => folder.id === folderId) : null
  const childFolders = folders.filter((folder) => folder.parentId === folderId)
  const childFiles = files.filter((file) => file.folderId === folderId)

  if (folderId && !currentFolder) {
    if (isLoading) return null
    return (
      <EmptyState
        title="Folder not found"
        description="This folder may have been deleted."
        action={<AppButton variant="primary" onPress={() => { tabs.navigate('/folders', { pane: paneId }); navigate('/folders') }}>Back to folders</AppButton>}
      />
    )
  }

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
      <div className="-mx-4 mt-4 px-1">
        {childFiles.map((file) => (
          <FileCard
            key={file.id}
            name={file.name}
            meta={`Updated ${formatUpdatedAt(file.updatedAt)}`}
            type={file.type}
            syncStatus={file.syncStatus}
            folderName={currentFolder?.name ?? 'Writin'}
            onOpen={() => { const path = `/${file.type}/${file.id}`; tabs.navigate(path, { pane: paneId }); navigate(path) }}
            action={
              <FileActionsMenu
                fileName={file.name}
                folders={folders}
                currentFolderId={file.folderId}
                isFavorite={Boolean(file.isFavorite)}
                onRename={() => setFileRenameTarget(file)}
                onDuplicate={() => void fileRepository.duplicate(file.id)}
                onMove={(destination) => void fileRepository.update(file.id, { folderId: destination })}
                onToggleFavorite={() => void fileRepository.setFavorite(file.id, !file.isFavorite)}
                onDelete={() => setFileDeleteTarget(file)}
                onOpenInNewTab={() => { const path = `/${file.type}/${file.id}`; tabs.navigate(path, { newTab: true, pane: paneId }); navigate(path) }}
                onOpenInSplit={() => { const path = `/${file.type}/${file.id}`; tabs.splitWith(path); navigate(path) }}
              />
            }
          />
        ))}
        {childFolders.map((folder) => (
          <FolderCard
            key={folder.id}
            name={folder.name}
            fileCount={fileCount(folder.id)}
            folderCount={folderCount(folder.id)}
            driveStatus={workspaceMode === 'local' ? 'Stored locally' : folder.driveFolderId ? 'Synced to Drive' : 'Drive folder pending'}
            onOpen={() => { const path = `/folders/${folder.id}`; tabs.navigate(path, { pane: paneId }); navigate(path) }}
            action={
              <FolderActionsMenu
                folderName={folder.name}
                folders={folders}
                folderId={folder.id}
                currentParentId={folder.parentId}
                isFavorite={Boolean(folder.isFavorite)}
                onRename={() => setRenameTarget(folder)}
                onMove={(destination) => void folderRepository.update(folder.id, { parentId: destination })}
                onToggleFavorite={() => void folderRepository.setFavorite(folder.id, !folder.isFavorite)}
                onDelete={() => setDeleteTarget(folder)}
              />
            }
          />
        ))}
      </div>

      {childFolders.length === 0 && childFiles.length === 0 && !isLoading ? (
        <div className="pt-16">
          <EmptyState
            title={folderId ? 'This folder is empty' : 'No folders or files'}
            description="Create a folder or move a file here to get started."
          />
        </div>
      ) : null}

      <FolderNameDialog
        isOpen={Boolean(renameTarget)}
        title="Rename folder"
        submitLabel="Save"
        initialName={renameTarget?.name}
        onClose={() => setRenameTarget(null)}
        existingFolderNames={folders
          .filter((folder) => folder.parentId === renameTarget?.parentId && folder.id !== renameTarget?.id)
          .map((folder) => folder.name)}
        onSubmit={(name) => renameTarget ? folderRepository.update(renameTarget.id, { name }) : Promise.resolve({ success: false })}
      />
      <DeleteFolderDialog
        isOpen={Boolean(deleteTarget)}
        folderName={deleteTarget?.name ?? ''}
        hasContents={deleteTarget ? itemCount(deleteTarget.id) > 0 : false}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          const deletingCurrent = deleteTarget.id === folderId
          const destination = deleteTarget.parentId
          deleteFolder(deleteTarget)
          if (deletingCurrent) navigate(destination ? `/folders/${destination}` : '/folders')
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
      <FileNameDialog
        fileName={fileRenameTarget?.name ?? ''}
        isOpen={Boolean(fileRenameTarget)}
        existingFileNames={files
          .filter((file) => file.folderId === fileRenameTarget?.folderId && file.id !== fileRenameTarget?.id)
          .map((file) => file.name)}
        onClose={() => setFileRenameTarget(null)}
        onSubmit={(name) => fileRenameTarget ? fileRepository.update(fileRenameTarget.id, { name }) : Promise.resolve({ success: false })}
      />
    </div>
  )
}
