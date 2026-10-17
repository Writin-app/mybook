import { DocumentDuplicateIcon, EllipsisHorizontalIcon, FolderArrowDownIcon, PencilSquareIcon, StarIcon as StarOutlineIcon, ArrowTopRightOnSquareIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline'
import { Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid'
import { Dropdown } from '../ui/compat-dropdown'

import type { MyBookFolder } from '../../types/files'

interface FileActionsMenuProps {
  fileName: string
  folders: MyBookFolder[]
  currentFolderId: string | null
  isFavorite?: boolean
  onRename: () => void
  onDuplicate: () => void
  onMove: (folderId: string | null) => void
  onToggleFavorite?: () => void
  onDelete: () => void
  onOpenInNewTab?: () => void
  onOpenInSplit?: () => void
}

export function FileActionsMenu({ fileName, folders, currentFolderId, isFavorite = false, onRename, onDuplicate, onMove, onToggleFavorite, onDelete, onOpenInNewTab, onOpenInSplit }: FileActionsMenuProps) {
  const FavoriteIcon = isFavorite ? StarSolidIcon : StarOutlineIcon

  return (
    <Dropdown>
      <Dropdown.Trigger aria-label={`More actions for ${fileName}`} className="flex size-9 items-center justify-center rounded-full text-muted-foreground"><EllipsisHorizontalIcon aria-hidden="true" className="size-4" /></Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={`Actions for ${fileName}`} onAction={(key) => {
          const action = String(key)
          if (action === 'rename') onRename()
          else if (action === 'duplicate') onDuplicate()
          else if (action === 'favorite') onToggleFavorite?.()
          else if (action === 'new-tab') onOpenInNewTab?.()
          else if (action === 'split') onOpenInSplit?.()
          else if (action === 'delete') onDelete()
          else if (action === 'root') onMove(null)
          else if (action.startsWith('move:')) onMove(action.slice(5))
        }}>
          {onOpenInNewTab ? <Dropdown.Item id="new-tab"><ArrowTopRightOnSquareIcon aria-hidden="true" className="size-5" />Open in new tab</Dropdown.Item> : null}
          {onOpenInSplit ? <Dropdown.Item id="split"><ArrowsPointingOutIcon aria-hidden="true" className="size-5" />Open in split view</Dropdown.Item> : null}
          <Dropdown.Item id="rename"><PencilSquareIcon aria-hidden="true" className="size-5" />Rename</Dropdown.Item>
          <Dropdown.Item id="duplicate"><DocumentDuplicateIcon aria-hidden="true" className="size-5" />Duplicate</Dropdown.Item>
          {onToggleFavorite ? <Dropdown.Item id="favorite" aria-label={`${isFavorite ? 'Remove from' : 'Add to'} favorites`}><FavoriteIcon aria-hidden="true" className="size-5" />{isFavorite ? 'Remove from favorites' : 'Add to favorites'}</Dropdown.Item> : null}
          {currentFolderId ? <Dropdown.Item id="root"><FolderArrowDownIcon aria-hidden="true" className="size-5" />Move to Writin root</Dropdown.Item> : null}
          {folders.filter((folder) => folder.id !== currentFolderId).map((folder) => <Dropdown.Item key={folder.id} id={`move:${folder.id}`}><FolderArrowDownIcon aria-hidden="true" className="size-5" />Move to {folder.name}</Dropdown.Item>)}
          <Dropdown.Item id="delete" variant="danger"><HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-5" />Move to Trash</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
