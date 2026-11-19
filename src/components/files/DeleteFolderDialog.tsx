import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

import { AppButton } from '../common/AppButton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

interface DeleteFolderDialogProps {
  isOpen: boolean
  folderName: string
  hasContents?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function DeleteFolderDialog({
  isOpen,
  folderName,
  hasContents = false,
  onClose,
  onConfirm,
}: DeleteFolderDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-md p-5 sm:max-w-md">
        <DialogHeader className="gap-0">
          <ExclamationTriangleIcon aria-hidden="true" className="size-7 text-danger" />
          <DialogTitle id="delete-folder-title" className="mt-3 text-lg font-semibold">
            Move "{folderName}" to Trash?
          </DialogTitle>
          <DialogDescription id="delete-folder-description" className="mt-2 text-base leading-7 text-muted-foreground">
            {hasContents
              ? 'This folder is not empty. Its files and nested folders will also be moved to Trash.'
              : 'This folder will move to Trash. You can restore it later from Trash.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 flex flex-wrap justify-end gap-2 sm:justify-end">
          <AppButton variant="secondary" onPress={onClose}>Cancel</AppButton>
          <AppButton
            variant="danger"
            onPress={() => {
              onConfirm()
              onClose()
            }}
          >
            Move to Trash
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

