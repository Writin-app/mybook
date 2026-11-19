import { FolderIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'

import { AppButton } from '../common/AppButton'
import { FieldError } from '../ui/field'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

type FolderNameDialogResult = {
  success: boolean
  error?: string
  data?: { id: string; name: string } | void
}

interface FolderNameDialogProps {
  isOpen: boolean
  title: string
  submitLabel: string
  initialName?: string
  existingFolderNames?: string[]
  onClose: () => void
  onSubmit: (name: string) => Promise<FolderNameDialogResult>
  onSuccess?: (result: FolderNameDialogResult) => void
}

export function FolderNameDialog({
  isOpen,
  title,
  submitLabel,
  initialName = '',
  existingFolderNames = [],
  onClose,
  onSubmit,
  onSuccess,
}: FolderNameDialogProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const normalizedName = cleanFolderName(name)
  const duplicateFolderName = existingFolderNames.find((folderName) =>
    cleanFolderName(folderName).toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
  )
  const hasDuplicateName = normalizedName.length > 0 && Boolean(duplicateFolderName)
  const validationError = hasDuplicateName ? `"${duplicateFolderName ?? normalizedName}" already exists. Use a different name.` : null
  const displayedError = error ?? (isSubmitting ? null : validationError)

  useEffect(() => {
    if (isOpen) {
      setName(initialName)
      setError(null)
      setIsSubmitting(false)
    }
  }, [initialName, isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-md p-5 sm:max-w-md">
        <form
          className="p-0"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!isSubmitting && validationError) {
              setError(validationError)
              return
            }
            setIsSubmitting(true)
            const result = await onSubmit(name)
            if (result.success) {
              onClose()
              onSuccess?.(result)
            } else {
              setIsSubmitting(false)
              setError(result.error ?? 'Unable to save this folder.')
            }
          }}
        >
          <DialogHeader className="gap-0">
            <div className="flex items-center gap-3">
              <FolderIcon aria-hidden="true" className="size-6 text-warning" />
              <DialogTitle id="folder-dialog-title" className="text-lg font-semibold">
                {title}
              </DialogTitle>
            </div>
          </DialogHeader>
          <label htmlFor="folder-name" className="mt-5 block text-sm font-medium">Folder name</label>
          <input
            id="folder-name"
            autoFocus
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
              setIsSubmitting(false)
            }}
            aria-describedby={displayedError ? 'folder-name-error' : undefined}
            aria-invalid={Boolean(displayedError)}
            className="mt-2 min-h-11 w-full rounded-[10px] border border-[var(--app-border)] bg-background px-3 text-base outline-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
          />
          {displayedError ? <FieldError id="folder-name-error" className="mt-2">{displayedError}</FieldError> : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <AppButton type="button" variant="secondary" onPress={onClose}>Cancel</AppButton>
            <AppButton type="submit" variant="primary" isLoading={isSubmitting} loadingLabel="Creating...">
              {submitLabel}
            </AppButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function cleanFolderName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}
