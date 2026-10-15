import { DocumentDuplicateIcon, EllipsisHorizontalIcon, FolderArrowDownIcon, PencilSquareIcon, StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline'
import { Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid'
import { useState } from 'react'
import { Dropdown } from '../ui/compat-dropdown'
import { MoveItemDialog } from './MoveItemDialog'

import type { MyBookFolder } from '../../types/files'
import type { RepositoryResult } from '../../database/repositories'

interface FileActionsMenuProps {
  fileName: string
  folders: MyBookFolder[]
  currentFolderId: string | null
  isFavorite?: boolean
  onRename: () => void
  onDuplicate: () => void
  onMove: (folderId: string | null) => Promise<RepositoryResult>
  onCreateFolder: (name: string, parentId: string) => Promise<RepositoryResult<MyBookFolder>>
  onToggleFavorite?: () => void
  onDelete: () => void
}

export function FileActionsMenu({ fileName, folders, currentFolderId, isFavorite = false, onRename, onDuplicate, onMove, onCreateFolder, onToggleFavorite, onDelete }: FileActionsMenuProps) {
  const FavoriteIcon = isFavorite ? StarSolidIcon : StarOutlineIcon
  const [isMoveOpen, setIsMoveOpen] = useState(false)

  return (
    <>
      <Dropdown>
        <Dropdown.Trigger aria-label={`More actions for ${fileName}`} className="flex size-9 items-center justify-center rounded-full text-muted-foreground"><EllipsisHorizontalIcon aria-hidden="true" className="size-4" /></Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu aria-label={`Actions for ${fileName}`} onAction={(key) => {
            const action = String(key)
            if (action === 'rename') onRename()
            else if (action === 'duplicate') onDuplicate()
            else if (action === 'favorite') onToggleFavorite?.()
            else if (action === 'move') setIsMoveOpen(true)
            else if (action === 'delete') onDelete()
          }}>
            <Dropdown.Item id="rename"><PencilSquareIcon aria-hidden="true" className="size-5" />Rename</Dropdown.Item>
            <Dropdown.Item id="duplicate"><DocumentDuplicateIcon aria-hidden="true" className="size-5" />Duplicate</Dropdown.Item>
            {onToggleFavorite ? <Dropdown.Item id="favorite" aria-label={`${isFavorite ? 'Remove from' : 'Add to'} favorites`}><FavoriteIcon aria-hidden="true" className="size-5" />{isFavorite ? 'Remove from favorites' : 'Add to favorites'}</Dropdown.Item> : null}
            <Dropdown.Item id="move"><FolderArrowDownIcon aria-hidden="true" className="size-5" />Move…</Dropdown.Item>
            <Dropdown.Item id="delete" variant="danger"><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-5" />Move to Trash</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
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
