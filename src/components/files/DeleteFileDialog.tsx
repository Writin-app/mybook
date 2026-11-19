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

interface DeleteFileDialogProps {
  isOpen: boolean
  fileName: string
  itemKind?: 'file' | 'folder'
  mode?: 'trash' | 'permanent'
  onClose: () => void
  onConfirm: () => void
}

export function DeleteFileDialog({
  isOpen,
  fileName,
  itemKind = 'file',
  mode = 'trash',
  onClose,
  onConfirm,
}: DeleteFileDialogProps) {
  const isPermanent = mode === 'permanent'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-md p-5 sm:max-w-md">
        <DialogHeader className="gap-0">
          <ExclamationTriangleIcon aria-hidden="true" className="size-7 text-danger" />
          <DialogTitle id="delete-file-title" className="mt-3 text-lg font-semibold">
            {isPermanent ? `Delete "${fileName}" permanently?` : `Move "${fileName}" to Trash?`}
          </DialogTitle>
          <DialogDescription id="delete-file-description" className="mt-2 text-base leading-7 text-muted-foreground">
            {isPermanent
              ? `This ${itemKind} will be permanently deleted and cannot be restored.`
              : `This ${itemKind} will move to Trash, where you can restore it later.`}
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
            {isPermanent ? 'Delete permanently' : 'Move to Trash'}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

