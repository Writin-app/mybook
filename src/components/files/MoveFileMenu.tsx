import { FolderArrowDownIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { MoveItemDialog } from './MoveItemDialog'
import { Button } from '../ui/button'

import type { MyBookFolder } from '../../types/files'
import type { RepositoryResult } from '../../database/repositories'

interface MoveFileMenuProps {
  fileName: string
  folders: MyBookFolder[]
  currentFolderId: string | null
  onMove: (folderId: string | null) => Promise<RepositoryResult>
  onCreateFolder: (name: string, parentId: string | null) => Promise<RepositoryResult<MyBookFolder>>
}

export function MoveFileMenu({ fileName, folders, currentFolderId, onMove, onCreateFolder }: MoveFileMenuProps) {
  const [isMoveOpen, setIsMoveOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={`Move ${fileName}`}
        onClick={() => setIsMoveOpen(true)}
      >
        <FolderArrowDownIcon aria-hidden="true" className="size-5" />
      </Button>
      <MoveItemDialog
        isOpen={isMoveOpen}
        itemKind="file"
        itemName={fileName}
        folders={folders}
        disabledFolderIds={currentFolderId === null ? ['root'] : [currentFolderId]}
        onClose={() => setIsMoveOpen(false)}
        onMove={onMove}
        onCreateFolder={onCreateFolder}
      />
    </>
  )
}
