import {
  Cancel01Icon,
  LinkIcon,
  LinkOffIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

import { useLibraryData } from '../../hooks/useLibraryData'
import type { MyBookFile } from '../../types/files'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useDocumentLinkContext } from './DocumentLinkContext'
import { documentLinkLocation, documentLinkTargets } from './documentLinkModel'
import { resolveInternalDocumentId } from './imageClipboard'

export interface ImageLinkPopoverProps {
  initialHref?: string | null
  onSave: (href: string) => void
  onRemove?: () => void
  onClose: () => void
  isInline?: boolean
}

function isUrlLike(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || /\s/u.test(trimmed)) return false
  if (/^(?:https?:\/\/|ftp:\/\/|mailto:|www\.)/i.test(trimmed)) return true
  try {
    const parsed = new URL(trimmed)
    return Boolean(parsed.protocol)
  } catch {
    return /^(?:localhost(?::\d+)?|(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?|(?:\w[\w-]*\.)+[a-zA-Z]{2,}(?::\d+)?)(?:\/.*)?$/i.test(trimmed)
  }
}

export type ImageLinkOption =
  | { type: 'url'; id: string; url: string }
  | { type: 'file'; id: string; file: MyBookFile }

export function ImageLinkPopover({
  initialHref = '',
  onSave,
  onRemove,
  onClose,
  isInline = true,
}: ImageLinkPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const docContext = useDocumentLinkContext()
  const libraryData = useLibraryData()

  const files = useMemo(() => docContext?.files ?? libraryData.files ?? [], [docContext?.files, libraryData.files])
  const folders = useMemo(() => libraryData.folders ?? [], [libraryData.folders])
  const currentFileId = docContext?.currentFileId ?? ''

  const [activeHref, setActiveHref] = useState(initialHref ?? '')
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setActiveHref(initialHref ?? '')
  }, [initialHref])

  // Find linked info if activeHref is present
  const linkedInfo = useMemo(() => {
    if (!activeHref) return null
    const docId = resolveInternalDocumentId(activeHref, files) || (activeHref.startsWith('doc:') ? activeHref.slice(4) : activeHref)
    const file = files.find((f) => f.id === docId && !f.isDeleted) ?? null
    if (file) {
      const location = documentLinkLocation(file, folders, 36)
      const iconSrc = file.type === 'spreadsheet' ? '/icons/sheet.svg' : '/icons/file.svg'
      return {
        name: file.name,
        displayPath: location.displayPath,
        iconSrc,
      }
    }
    return {
      name: activeHref,
      displayPath: undefined,
      iconSrc: undefined,
    }
  }, [files, folders, activeHref])

  // Get matching or recent documents
  const targetFiles = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      // 5 most recent pages/items
      return files
        .filter((file) => ['document', 'spreadsheet'].includes(file.type) && file.id !== currentFileId && !file.isDeleted)
        .slice(0, 5)
    }
    return documentLinkTargets(files, currentFileId, trimmed).slice(0, 8)
  }, [currentFileId, files, query])

  // Unified list of selectable options (pasted URL and/or target files)
  const options = useMemo<ImageLinkOption[]>(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      return targetFiles.map((file) => ({
        type: 'file',
        id: file.id,
        file,
      }))
    }

    const list: ImageLinkOption[] = []
    if (isUrlLike(trimmed)) {
      list.push({
        type: 'url',
        id: `url:${trimmed}`,
        url: trimmed,
      })
    }

    for (const file of targetFiles) {
      list.push({
        type: 'file',
        id: file.id,
        file,
      })
    }

    return list
  }, [query, targetFiles])

  // Keep selected index within range
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, options.length - 1)))
  }, [options.length])

  // Auto focus input on mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 40)
    return () => window.clearTimeout(timer)
  }, [])

  // Outside click listener
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && containerRef.current?.contains(target)) return
      onClose()
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [onClose])

  // Escape key listener
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

  const handleSelectFile = useCallback((file: MyBookFile) => {
    const newHref = `doc:${file.id}`
    setActiveHref(newHref)
    setQuery('')
  }, [])

  const handleSelectUrl = useCallback((url: string) => {
    setActiveHref(url)
    setQuery('')
  }, [])

  const handleUnlink = useCallback(() => {
    setActiveHref('')
    setQuery('')
  }, [])

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault()
    const trimmed = query.trim()
    let finalHref = activeHref

    if (trimmed) {
      const selectedOption = options[selectedIndex]
      if (selectedOption) {
        if (selectedOption.type === 'url') {
          const internalDocId = resolveInternalDocumentId(selectedOption.url, files)
          finalHref = internalDocId ? `doc:${internalDocId}` : selectedOption.url
        } else if (selectedOption.type === 'file') {
          finalHref = `doc:${selectedOption.file.id}`
        }
      } else {
        const internalDocId = resolveInternalDocumentId(trimmed, files)
        if (internalDocId) {
          finalHref = `doc:${internalDocId}`
        } else {
          finalHref = trimmed
        }
      }
    }

    if (finalHref) {
      const resolvedDocId = resolveInternalDocumentId(finalHref, files)
      const normalizedHref = resolvedDocId ? `doc:${resolvedDocId}` : finalHref
      onSave(normalizedHref)
    } else if (initialHref) {
      onRemove?.()
    }
    onClose()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, options.length - 1)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      handleSubmit()
    }
  }

  const title = activeHref ? 'Edit link' : 'Add link'

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={title}
      className={
        isInline
          ? 'absolute top-11 right-0 z-50 w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.18)] outline-none'
          : 'fixed z-50 w-[min(22rem,calc(100vw-1rem))] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.18)] outline-none'
      }
      data-image-link-popover="true"
      data-editor-popover="true"
    >
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={onClose}
          className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
        </Button>
      </div>

      {/* Currently linked item indicator card */}
      {linkedInfo ? (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs text-foreground">
          {linkedInfo.iconSrc ? (
            <img src={linkedInfo.iconSrc} alt="" aria-hidden="true" className="size-3.5 shrink-0" />
          ) : (
            <HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium" title={linkedInfo.name}>
              {linkedInfo.name}
            </span>
            {linkedInfo.displayPath ? (
              <span className="block truncate text-[10px] text-muted-foreground">
                {linkedInfo.displayPath}
              </span>
            ) : null}
          </div>
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Unlink"
              title="Unlink"
              onClick={handleUnlink}
              className="size-6 shrink-0 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <HugeiconsIcon icon={LinkOffIcon} strokeWidth={2} className="size-3.5" />
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Form Input & Action */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="relative">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Paste link or search pages"
            aria-label="Link destination"
            className={`h-9 w-full rounded-lg border-[var(--app-border)] bg-[var(--app-surface)] text-xs focus-visible:ring-1 ${
              query ? 'pr-8' : 'pr-3'
            }`}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear input"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
            </button>
          ) : null}
        </div>

        {/* Search Results / Pasted URL / 5 Recent Items */}
        <div
          ref={listRef}
          role="listbox"
          aria-label="Link suggestions"
          className={`my-1 flex flex-col gap-0.5 ${
            query.trim()
              ? 'max-h-56 overflow-y-auto rounded-lg p-0.5'
              : ''
          }`}
        >
          {!query.trim() ? (
            <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recent
            </div>
          ) : null}

          {options.length > 0 ? (
            options.map((option, idx) => {
              const isSelected = idx === selectedIndex

              if (option.type === 'url') {
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleSelectUrl(option.url)}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <HugeiconsIcon icon={LinkIcon} strokeWidth={2} className={`size-3.5 shrink-0 ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium" title={option.url}>
                        {option.url}
                      </span>
                    </div>
                  </button>
                )
              }

              const location = documentLinkLocation(option.file, folders, 36)
              const iconSrc = option.file.type === 'spreadsheet' ? '/icons/sheet.svg' : '/icons/file.svg'

              return (
                <button
                  key={option.file.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => handleSelectFile(option.file)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <img src={iconSrc} alt="" aria-hidden="true" className="size-3.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{option.file.name}</span>
                    <span
                      className={`block truncate text-[10px] ${
                        isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      }`}
                    >
                      {location.displayPath}
                    </span>
                  </div>
                </button>
              )
            })
          ) : (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              {query.trim() ? 'No pages match your search.' : 'No recent pages.'}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="mt-1 flex items-center justify-end gap-2 pt-1 border-t border-[var(--app-border)]/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 px-3 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!query.trim() && !activeHref && !initialHref}
            className="h-8 px-3 text-xs font-medium"
          >
            {initialHref || activeHref ? 'Save' : 'Add'}
          </Button>
        </div>
      </form>
    </div>
  )
}
