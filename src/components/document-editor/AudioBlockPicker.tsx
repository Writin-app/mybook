import {
  ArrowUpTrayIcon,
  LinkIcon,
  MusicalNoteIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { parseAudioUrl } from './audioClipboard'
import { getVisualViewportBounds } from '../../hooks/useVisualViewport'

const MAX_AUDIO_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

export interface AudioBlockPickerProps {
  position?: { left: number; top: number } | null
  onClose: () => void
  onInsert: (
    src: string,
    title: string,
    provider?: 'html5' | 'embed'
  ) => void
  title?: string
  submitLabel?: string
  initialTab?: 'upload' | 'embed'
  initialUrl?: string
  isInline?: boolean
  className?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AudioBlockPicker({
  position,
  onClose,
  onInsert,
  title = 'Add audio',
  submitLabel = 'Add audio',
  initialTab = 'upload',
  initialUrl = '',
  isInline = false,
  className,
}: AudioBlockPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const embedInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<'upload' | 'embed'>(initialTab)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const [embedUrl, setEmbedUrl] = useState(initialUrl)
  const [embedError, setEmbedError] = useState<string | null>(null)
  const [isEmbedding, setIsEmbedding] = useState(false)

  // Auto-focus embed input when embed tab is active
  useEffect(() => {
    if (activeTab === 'embed') {
      const timer = window.setTimeout(() => {
        embedInputRef.current?.focus()
        embedInputRef.current?.select()
      }, 50)
      return () => window.clearTimeout(timer)
    }
  }, [activeTab])

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

  // Cleanup object URL preview
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileSelection = useCallback((file: File | undefined) => {
    if (!file) return
    setUploadError(null)

    const isAudioType =
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|ogg|m4a|aac|flac|weba|opus)$/i.test(file.name)
    if (!isAudioType) {
      setUploadError('Please choose an audio file (MP3, WAV, OGG, M4A, AAC, FLAC).')
      setSelectedFile(null)
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      return
    }

    if (file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
      setUploadError('Audio file is too large. Choose an audio file under 50 MB.')
      setSelectedFile(null)
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      return
    }

    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }, [previewUrl])

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingOver(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingOver(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      handleFileSelection(file)
    }
  }

  const handleUploadSubmit = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    setUploadError(null)

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error ?? new Error('Audio read failed.'))
        reader.readAsDataURL(selectedFile)
      })

      const trackTitle = selectedFile.name.replace(/\.[^.]+$/u, '')
      onInsert(dataUrl, trackTitle, 'html5')
    } catch {
      setUploadError('Could not process audio file. Please try again.')
      setIsUploading(false)
    }
  }

  const handleEmbedSubmit = (event?: FormEvent) => {
    event?.preventDefault()
    const trimmed = embedUrl.trim()
    setEmbedError(null)

    if (!trimmed) {
      setEmbedError('Please enter an audio link.')
      return
    }

    const parsed = parseAudioUrl(trimmed)
    if (!parsed) {
      setEmbedError('Please enter a valid audio link (e.g. direct MP3, WAV, OGG, or audio stream URL).')
      return
    }

    setIsEmbedding(true)
    let trackTitle = parsed.title || ''
    if (!trackTitle) {
      try {
        const urlObj = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
        const pathname = urlObj.pathname
        const filename = pathname.substring(pathname.lastIndexOf('/') + 1)
        if (filename) trackTitle = decodeURIComponent(filename.replace(/\.[^.]+$/u, ''))
      } catch {
        // ignore
      }
    }

    onInsert(parsed.embedUrl, trackTitle || 'Audio Track', parsed.provider)
  }

  const clearSelectedFile = () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const isCentered = !isInline && (isMobile || !position || (position.left === 0 && position.top === 0))

  const popoverWidth = 384 // 24rem
  const popoverHeight = 340
  const left = position ? Math.max(8, Math.min(position.left, window.innerWidth - popoverWidth - 16)) : undefined
  const top = position ? Math.max(8, Math.min(position.top, (typeof window !== 'undefined' ? getVisualViewportBounds().visibleBottom : 768) - popoverHeight - 16)) : undefined

  const pickerDialog = (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={title}
      className={
        className
          ? className
          : isInline
            ? 'absolute top-11 right-0 z-40 w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.18)] outline-none'
            : isCentered
              ? 'w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.18)] outline-none'
              : 'fixed z-50 w-[min(24rem,calc(100vw-1rem))] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.18)] outline-none'
      }
      data-audio-picker="true"
      data-command-menu-scroller="true"
      style={isInline || isCentered ? undefined : { left, top }}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={onClose}
          className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <XMarkIcon className="size-4" />
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as 'upload' | 'embed')
          setUploadError(null)
          setEmbedError(null)
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/70 p-1">
          <TabsTrigger value="upload" aria-label="Upload" className="flex items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-medium">
            <ArrowUpTrayIcon className="size-3.5" />
            <span>Upload</span>
          </TabsTrigger>
          <TabsTrigger value="embed" aria-label="Embed link" className="flex items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-medium">
            <LinkIcon className="size-3.5" />
            <span>Embed link</span>
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="mt-3 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.weba,.opus"
            className="hidden"
            tabIndex={-1}
            aria-label="Upload audio file"
            onChange={(e) => handleFileSelection(e.target.files?.[0])}
          />

          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                isDraggingOver
                  ? 'border-primary bg-primary/5'
                  : 'border-[var(--app-border)] bg-[var(--app-subtle)]/40 hover:bg-[var(--app-subtle)]'
              }`}
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MusicalNoteIcon className="size-5" />
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">
                Drag &amp; drop an audio file here
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Supports MP3, WAV, OGG, M4A, AAC up to 50 MB
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 rounded-lg text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse files
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-2.5">
                <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MusicalNoteIcon className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground" title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove selected audio"
                  onClick={clearSelectedFile}
                  className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <XMarkIcon className="size-4" />
                </Button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg text-xs"
                >
                  Change
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={isUploading}
                  onClick={handleUploadSubmit}
                  className="rounded-lg text-xs"
                >
                  {isUploading ? 'Saving…' : submitLabel}
                </Button>
              </div>
            </div>
          )}

          {uploadError ? (
            <p role="alert" className="text-xs text-destructive">
              {uploadError}
            </p>
          ) : null}
        </TabsContent>

        {/* Embed Link Tab */}
        <TabsContent value="embed" className="mt-3 space-y-3">
          <form noValidate onSubmit={handleEmbedSubmit} className="space-y-3">
            <div>
              <Input
                ref={embedInputRef}
                type="url"
                value={embedUrl}
                onChange={(event) => {
                  setEmbedUrl(event.target.value)
                  if (embedError) setEmbedError(null)
                }}
                placeholder="Paste audio link (MP3, WAV, OGG URL…)"
                className="h-9 rounded-xl text-xs"
                autoFocus
              />
            </div>

            {embedError ? (
              <p role="alert" className="text-xs text-destructive">
                {embedError}
              </p>
            ) : null}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground">
                Works with direct audio files and streaming URLs
              </span>
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={!embedUrl.trim() || isEmbedding}
                className="rounded-lg text-xs"
              >
                {isEmbedding ? 'Saving…' : submitLabel}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )

  if (isCentered) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
        {pickerDialog}
      </div>
    )
  }

  return pickerDialog
}
