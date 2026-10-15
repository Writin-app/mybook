import { EllipsisHorizontalIcon, FolderArrowDownIcon, PencilSquareIcon, StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline'
import { Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid'
import { useState } from 'react'
import { Dropdown } from '../ui/compat-dropdown'
import { MoveItemDialog } from './MoveItemDialog'

import type { MyBookFolder } from '../../types/files'
import type { RepositoryResult } from '../../database/repositories'

interface FolderActionsMenuProps {
  folderName: string
  folders: MyBookFolder[]
  folderId: string
  currentParentId: string | null
  isFavorite?: boolean
  onRename: () => void
  onMove: (folderId: string | null) => Promise<RepositoryResult>
  onCreateFolder: (name: string, parentId: string) => Promise<RepositoryResult<MyBookFolder>>
  onToggleFavorite?: () => void
  onDelete: () => void
}

export function FolderActionsMenu({ folderName, folders, folderId, currentParentId, isFavorite = false, onRename, onMove, onCreateFolder, onToggleFavorite, onDelete }: FolderActionsMenuProps) {
  const FavoriteIcon = isFavorite ? StarSolidIcon : StarOutlineIcon
  const [isMoveOpen, setIsMoveOpen] = useState(false)
  const descendants = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const folder of folders) {
      if ((folder.parentId === folderId || (folder.parentId && descendants.has(folder.parentId))) && !descendants.has(folder.id)) {
        descendants.add(folder.id)
        changed = true
      }
    }
  }
  const disabledFolderIds = [
    folderId,
    ...descendants,
    ...(currentParentId ? [currentParentId] : ['root']),
  ]

  return (
    <>
      <Dropdown>
        <Dropdown.Trigger aria-label={`Actions for ${folderName}`} className="flex size-9 items-center justify-center rounded-full text-muted-foreground">
          <EllipsisHorizontalIcon aria-hidden="true" className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu aria-label={`Actions for ${folderName}`} onAction={(key) => {
            const action = String(key)
            if (action === 'rename') onRename()
            else if (action === 'favorite') onToggleFavorite?.()
            else if (action === 'move') setIsMoveOpen(true)
            else if (action === 'delete') onDelete()
          }}>
            <Dropdown.Item id="rename"><PencilSquareIcon aria-hidden="true" className="size-5" />Rename</Dropdown.Item>
            {onToggleFavorite ? <Dropdown.Item id="favorite" aria-label={`${isFavorite ? 'Remove from' : 'Add to'} favorites`}><FavoriteIcon aria-hidden="true" className="size-5" />{isFavorite ? 'Remove from favorites' : 'Add to favorites'}</Dropdown.Item> : null}
            <Dropdown.Item id="move"><FolderArrowDownIcon aria-hidden="true" className="size-5" />Move…</Dropdown.Item>
            <Dropdown.Item id="delete" variant="danger"><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-5" />Delete</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <MoveItemDialog
        isOpen={isMoveOpen}
        itemKind="folder"
        itemName={folderName}
        folders={folders}
        disabledFolderIds={disabledFolderIds}
        onClose={() => setIsMoveOpen(false)}
        onMove={onMove}
        onCreateFolder={onCreateFolder}
      />
    </>
  )
}
