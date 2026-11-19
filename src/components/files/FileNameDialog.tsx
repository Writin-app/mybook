import { DocumentTextIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'

import { AppButton } from '../common/AppButton'
import { FieldError } from '../ui/field'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

function cleanFileName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

interface FileNameDialogProps {
  fileName: string
  isOpen: boolean
  existingFileNames?: string[]
  onClose: () => void
  onSubmit: (name: string) => Promise<{ success: boolean; error?: string }>
}

export function FileNameDialog({ fileName, isOpen, existingFileNames = [], onClose, onSubmit }: FileNameDialogProps) {
  const [name, setName] = useState(fileName)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const normalizedName = cleanFileName(name)
  const duplicateFileName = existingFileNames.find((existing) =>
    cleanFileName(existing).toLocaleLowerCase() === normalizedName.toLocaleLowerCase() &&
    cleanFileName(existing).toLocaleLowerCase() !== cleanFileName(fileName).toLocaleLowerCase()
  )
  const hasDuplicateName = normalizedName.length > 0 && Boolean(duplicateFileName)
  const validationError = hasDuplicateName ? `"${duplicateFileName ?? normalizedName}" already exists. Use a different name.` : null
  const displayedError = error ?? (isSubmitting ? null : validationError)

  useEffect(() => {
    if (isOpen) {
      setName(fileName)
      setError(null)
      setIsSubmitting(false)
    }
  }, [fileName, isOpen])

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
            } else {
              setIsSubmitting(false)
              setError(result.error ?? 'Unable to rename file.')
            }
          }}
        >
          <DialogHeader className="gap-0">
            <div className="flex items-center gap-3">
              <DocumentTextIcon className="size-6 text-primary" />
              <DialogTitle id="rename-file-title" className="text-lg font-semibold">
                Rename file
              </DialogTitle>
            </div>
          </DialogHeader>
          <label htmlFor="file-name" className="mt-5 block text-sm font-medium">File name</label>
          <input
            id="file-name"
            autoFocus
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
              setIsSubmitting(false)
            }}
            aria-invalid={Boolean(displayedError)}
            aria-describedby={displayedError ? 'file-name-error' : undefined}
            className="mt-2 min-h-11 w-full rounded-[10px] border border-[var(--app-border)] bg-background px-3 text-base outline-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
          />
          {displayedError ? <FieldError id="file-name-error" className="mt-2">{displayedError}</FieldError> : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <AppButton type="button" variant="secondary" onPress={onClose}>Cancel</AppButton>
            <AppButton type="submit" variant="primary" isLoading={isSubmitting}>Save</AppButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

