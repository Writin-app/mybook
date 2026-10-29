import { Cancel01Icon, LinkIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'

export interface FileEditLinkPopoverProps {
  /** Current file URL to pre-fill */
  initialUrl: string
  /** Called with the new URL when the user saves */
  onSave: (url: string) => void
  /** Close without saving */
  onClose: () => void
}

export function FileEditLinkPopover({ initialUrl, onSave, onClose }: FileEditLinkPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(initialUrl)
  const [error, setError] = useState<string | null>(null)

  // Auto-focus + select all on mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 40)
    return () => window.clearTimeout(timer)
  }, [])

  // Outside click → close without saving
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && containerRef.current?.contains(event.target)) return
      onClose()
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [onClose])

  // Escape → close without saving
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Please enter a file URL.')
      return
    }
    setError(null)
    onSave(trimmed)
    onClose()
  }

  return (
    <div
      ref={containerRef}
      contentEditable={false}
      role="dialog"
      aria-label="Edit file link"
      className="absolute top-11 right-0 z-50 w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.18)] outline-none"
      data-file-edit-link-popover="true"
      data-editor-popover="true"
    >
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Edit file link
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Close edit file link"
          onClick={onClose}
          className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
        </Button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2.5">
        <div className="relative">
          <Input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (error) setError(null)
            }}
            placeholder="Paste file link (PDF, DOCX, XLSX URL…)"
            aria-label="File URL"
            className={`h-9 w-full rounded-lg text-xs ${url ? 'pr-8' : ''}`}
          />
          {url ? (
            <button
              type="button"
              aria-label="Clear URL"
              title="Clear URL"
              onClick={() => {
                setUrl('')
                setError(null)
                inputRef.current?.focus()
              }}
              className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
            </button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--app-border)]/40 pt-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-lg text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="default"
            size="sm"
            disabled={!url.trim()}
            className="rounded-lg text-xs"
          >
            Save
          </Button>
        </div>
      </form>
    </div>
  )
}
