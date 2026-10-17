import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspaceTabsStore } from '../stores/useWorkspaceTabsStore'
import { useWorkspacePane } from '../contexts/WorkspacePaneContext'

import { EmptyState } from '../components/common/EmptyState'
import { DeleteFileDialog } from '../components/files/DeleteFileDialog'
import { FileActionsMenu } from '../components/files/FileActionsMenu'
import { FileCard } from '../components/files/FileCard'
import { FileNameDialog } from '../components/files/FileNameDialog'
import { FolderActionsMenu } from '../components/files/FolderActionsMenu'
import { FolderCard } from '../components/files/FolderCard'
import { FolderNameDialog } from '../components/files/FolderNameDialog'
import { toast } from '../components/ui/toast'
import { fileRepository, folderRepository } from '../database/repositories'
import { useLibraryData } from '../hooks/useLibraryData'
import type { MyBookFile, MyBookFolder } from '../types/files'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { formatUpdatedAt } from '../utils/dateFormat'
import { deletedToast } from '../utils/deleteToast'
import { activeFavoriteItems } from '../utils/favorites'

type HomeTab = 'recent' | 'favorites' | 'all'

interface HomePageProps {
  initialTab?: HomeTab
}

export function HomePage({ initialTab = 'recent' }: HomePageProps) {
  const navigate = useNavigate()
  const tabs = useWorkspaceTabsStore()
  const { paneId } = useWorkspacePane()
  const { files, folders, isLoading } = useLibraryData()
  const [activeTab, setActiveTab] = useState<HomeTab>(initialTab)
  const [renameTarget, setRenameTarget] = useState<MyBookFile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MyBookFile | null>(null)
  const [folderRenameTarget, setFolderRenameTarget] = useState<MyBookFolder | null>(null)
  const [folderDeleteTarget, setFolderDeleteTarget] = useState<MyBookFolder | null>(null)
  const recentFiles = [...files].sort(compareFilesByUpdatedAt)
  const favoriteItems = activeTab === 'favorites' ? activeFavoriteItems(files, folders) : []
  const visibleFiles = activeTab === 'all' ? files : activeTab === 'recent' ? recentFiles : []
  const emptyState = emptyHomeState(activeTab)
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

  const favoriteList = favoriteItems.length ? (
    <div className="px-1">
      {favoriteItems.map((favorite) => favorite.kind === 'folder'
        ? renderFolderCard(favorite.item)
        : renderFileCard(favorite.item))}
    </div>
  ) : !isLoading ? (
    <div className="px-4 pt-12">
      <EmptyState
        title={emptyState.title}
        description={emptyState.description}
      />
    </div>
  ) : null
  const fileList = visibleFiles.length ? (
    <div className="px-1">
      {visibleFiles.map((file) => renderFileCard(file))}
    </div>
  ) : !isLoading ? (
    <div className="px-4 pt-12">
      <EmptyState
        title={emptyState.title}
        description={emptyState.description}
      />
    </div>
  ) : null

  return (
    <div className="px-4">
      <Tabs
        className="-mx-4 mt-2"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as HomeTab)}
      >
        <TabsList aria-label="File view" className="mx-4 grid w-auto grid-cols-3">
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="all">All files</TabsTrigger>
        </TabsList>
        <TabsContent value="recent">{activeTab === 'recent' ? fileList : null}</TabsContent>
        <TabsContent value="favorites">{activeTab === 'favorites' ? favoriteList : null}</TabsContent>
        <TabsContent value="all">{activeTab === 'all' ? fileList : null}</TabsContent>
      </Tabs>

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
      <DeleteFileDialog
        isOpen={Boolean(deleteTarget)}
        fileName={deleteTarget?.name ?? ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          deleteFile(deleteTarget)
        }}
      />
      <DeleteFileDialog
        isOpen={Boolean(folderDeleteTarget)}
        itemKind="folder"
        fileName={folderDeleteTarget?.name ?? ''}
        onClose={() => setFolderDeleteTarget(null)}
        onConfirm={() => {
          if (!folderDeleteTarget) return
          void folderRepository.delete(folderDeleteTarget.id).then((result) => {
            if (!result.success) return
            toast.add(deletedToast({
              itemName: folderDeleteTarget.name,
              onUndo: () => { void folderRepository.restore(folderDeleteTarget.id) },
            }))
          })
        }}
      />
    </div>
  )

  function renderFileCard(file: MyBookFile) {
    return (
      <FileCard
        key={`file:${file.id}`}
        name={file.name}
        meta={`Updated ${formatUpdatedAt(file.updatedAt)}`}
        type={file.type}
        syncStatus={file.syncStatus}
        folderName={folders.find((folder) => folder.id === file.folderId)?.name ?? 'Writin'}
        onOpen={() => { const path = `/${file.type}/${file.id}`; tabs.navigate(path, { pane: paneId }); navigate(path) }}
        action={
          <FileActionsMenu
            fileName={file.name}
            folders={folders}
            currentFolderId={file.folderId}
            isFavorite={Boolean(file.isFavorite)}
            onRename={() => setRenameTarget(file)}
            onDuplicate={() => void fileRepository.duplicate(file.id)}
            onMove={(folderId) => void fileRepository.update(file.id, { folderId })}
            onToggleFavorite={() => void fileRepository.setFavorite(file.id, !file.isFavorite)}
            onDelete={() => setDeleteTarget(file)}
            onOpenInNewTab={() => { const path = `/${file.type}/${file.id}`; tabs.navigate(path, { newTab: true, pane: paneId }); navigate(path) }}
            onOpenInSplit={() => { const path = `/${file.type}/${file.id}`; tabs.splitWith(path); navigate(path) }}
          />
        }
      />
    )
  }

  function renderFolderCard(folder: MyBookFolder) {
    return (
      <FolderCard
        key={`folder:${folder.id}`}
        name={folder.name}
        fileCount={fileCount(folder.id)}
        folderCount={folderCount(folder.id)}
        onOpen={() => { const path = `/folders/${folder.id}`; tabs.navigate(path, { pane: paneId }); navigate(path) }}
        action={
          <FolderActionsMenu
            folderName={folder.name}
            folders={folders}
            folderId={folder.id}
            currentParentId={folder.parentId}
            isFavorite={Boolean(folder.isFavorite)}
            onRename={() => setFolderRenameTarget(folder)}
            onMove={(destination) => void folderRepository.update(folder.id, { parentId: destination })}
            onToggleFavorite={() => void folderRepository.setFavorite(folder.id, !folder.isFavorite)}
            onDelete={() => setFolderDeleteTarget(folder)}
          />
        }
      />
    )
  }
}

function emptyHomeState(activeTab: HomeTab) {
  if (activeTab === 'recent') {
    return {
      title: 'No recent files',
      description: 'Files you open or edit will appear here.',
    }
  }
  if (activeTab === 'favorites') {
    return {
      title: 'No favorite files yet',
      description: 'Favorite files and folders will appear here.',
    }
  }
  return {
    title: 'No files yet',
    description: 'Create a document or spreadsheet to get started.',
  }
}

function compareFilesByUpdatedAt(a: MyBookFile, b: MyBookFile) {
  const updated = b.updatedAt.localeCompare(a.updatedAt)
  if (updated !== 0) return updated
  const name = a.name.localeCompare(b.name, 'en-US', { sensitivity: 'base' })
  if (name !== 0) return name
  return a.id.localeCompare(b.id)
}
