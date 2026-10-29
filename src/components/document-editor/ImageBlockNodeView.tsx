import {
  ArrowExpandIcon,
  CaptionsIcon,
  CaptionsOffIcon,
  Copy02Icon,
  CopyIcon,
  CopyLinkIcon,
  Delete02Icon,
  Download01Icon,
  LinkIcon,
  LinkOffIcon,
  MoreHorizontalIcon,
  Refresh01Icon,
  ReloadIcon,
  SquareArrowOutUpRightIcon,
  TextAlignCenterIcon,
  TextAlignEndIcon,
  TextAlignLeftIcon,
  Tick02Icon,
  ViewIcon,
  ViewOffSlashIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { PhotoIcon } from '@heroicons/react/24/outline'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { useDeviceMode } from '../../hooks/useDeviceMode'
import { useDocumentLinkContext } from './DocumentLinkContext'
import {
  copyImageToClipboard,
  downloadImage,
  isExternalUrl,
  resolveInternalDocumentId,
} from './imageClipboard'
import { ImageBlockPicker } from './ImageBlockPicker'
import { ImageFullscreenViewer } from './ImageFullscreenViewer'
import { ImageLinkPopover } from './ImageLinkPopover'

const MIN_WIDTH_PERCENT = 15
const MAX_WIDTH_PERCENT = 100

export function ImageBlockNodeView({
  editor,
  getPos,
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const docContext = useDocumentLinkContext()
  const {
    src = '',
    alt = '',
    width = '100%',
    align = 'left',
    caption = '',
    showCaption = true,
    href = '',
  } = node.attrs

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const captionInputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const { isTouch } = useDeviceMode()
  const [isAlignOpen, setIsAlignOpen] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [showReplacePicker, setShowReplacePicker] = useState(false)
  const [showLinkPicker, setShowLinkPicker] = useState(false)
  const [isEditingCaption, setIsEditingCaption] = useState(false)

  const isUnsupportedDataUri = (url?: string | null) =>
    Boolean(url && /^data:image\/(?:x-emf|x-wmf|x-pict|tiff);/i.test(url))

  const isRelativePath = (url?: string | null) =>
    Boolean(url && !url.startsWith('data:') && !url.startsWith('blob:') && !/^https?:\/\//i.test(url))

  const canRetryImage = (url?: string | null) =>
    Boolean(url && !isUnsupportedDataUri(url) && !isRelativePath(url))

  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>(() => {
    if (!src) return 'error'
    if (src.startsWith('data:')) return isUnsupportedDataUri(src) ? 'error' : 'loaded'
    return 'loading'
  })
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!src) {
      setImageStatus('error')
      return
    }
    if (src.startsWith('data:')) {
      if (isUnsupportedDataUri(src)) {
        setImageStatus('error')
        return
      }
      setImageStatus('loaded')
      return
    }
    const img = imageRef.current
    if (img && img.complete) {
      if (img.naturalWidth > 0) {
        setImageStatus('loaded')
        return
      }
      setImageStatus('error')
      return
    }
    setImageStatus('loading')
  }, [src, retryKey])

  const isToolbarActive = isAlignOpen || isMoreOpen || showReplacePicker || showLinkPicker

  const resizeStateRef = useRef<{
    startX: number
    startWidthPx: number
    containerWidthPx: number
    handle: 'nw' | 'ne' | 'se' | 'sw' | 'w' | 'e'
  } | null>(null)

  // Copy timeout
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  // Copy link timeout
  useEffect(() => {
    if (!copiedLink) return
    const timer = window.setTimeout(() => setCopiedLink(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copiedLink])

  const keepEditorFocus = (event: MouseEvent | ReactPointerEvent) => event.preventDefault()

  // Resizing handlers
  const handleResizeStart = (
    event: ReactPointerEvent,
    handle: 'nw' | 'ne' | 'se' | 'sw' | 'w' | 'e'
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const container = containerRef.current
    const image = imageRef.current
    if (!container || !image) return

    const containerRect = container.getBoundingClientRect()
    const imageRect = image.getBoundingClientRect()

    setIsResizing(true)
    resizeStateRef.current = {
      startX: event.clientX,
      startWidthPx: imageRect.width,
      containerWidthPx: containerRect.width,
      handle,
    }

    ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
  }

  const handleResizeMove = (event: ReactPointerEvent) => {
    if (!isResizing || !resizeStateRef.current) return

    const { startX, startWidthPx, containerWidthPx, handle } = resizeStateRef.current
    const deltaX = event.clientX - startX

    const isLeftHandle = handle === 'nw' || handle === 'sw' || handle === 'w'
    const adjustedDelta = isLeftHandle ? -deltaX : deltaX

    const newWidthPx = Math.max(80, startWidthPx + adjustedDelta)
    const newWidthPercent = Math.min(
      MAX_WIDTH_PERCENT,
      Math.max(MIN_WIDTH_PERCENT, Math.round((newWidthPx / containerWidthPx) * 100))
    )

    updateAttributes({ width: `${newWidthPercent}%` })
  }

  const handleResizeEnd = (event: ReactPointerEvent) => {
    if (!isResizing) return
    setIsResizing(false)
    resizeStateRef.current = null
    try {
      ;(event.target as HTMLElement).releasePointerCapture?.(event.pointerId)
    } catch {
      // ignore
    }
  }

  // Open Replace popover anchored to top-right of image / action toolbar
  const handleOpenReplace = (event?: MouseEvent) => {
    event?.preventDefault()
    event?.stopPropagation()
    setShowReplacePicker(true)
  }

  const handleReplaceImage = (newSrc: string, newAlt: string) => {
    updateAttributes({
      src: newSrc,
      alt: newAlt || alt,
    })
    setShowReplacePicker(false)
    editor.view.focus()
  }

  // Copy binary image to clipboard so pasting directly renders the image
  const handleCopy = async (event?: MouseEvent) => {
    if (event) {
      keepEditorFocus(event)
    }
    const success = await copyImageToClipboard(src, alt)
    if (success) {
      setCopied(true)
    }
  }

  const handleDuplicate = () => {
    const pos = getPos()
    if (pos === undefined) return
    editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run()
  }

  const handleDownload = () => {
    downloadImage(src, alt)
  }

  const handleDelete = () => {
    deleteNode()
  }

  const handleAddCaption = () => {
    setIsEditingCaption(true)
    updateAttributes({ showCaption: true })
    setTimeout(() => captionInputRef.current?.focus(), 50)
  }

  const handleToggleShowCaption = (event?: MouseEvent) => {
    event?.stopPropagation()
    updateAttributes({ showCaption: !showCaption })
  }

  const handleDeleteCaption = () => {
    setIsEditingCaption(false)
    updateAttributes({ caption: '', showCaption: false })
  }

  const handleOpenLink = () => {
    if (!href) return
    const internalDocId = resolveInternalDocumentId(href, docContext?.files)
    if (internalDocId) {
      docContext?.openDocument(internalDocId)
    } else {
      const targetUrl = /^https?:\/\//i.test(href) || href.startsWith('/') ? href : `https://${href}`
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleCopyLink = async () => {
    if (!href) return
    let linkToCopy = href
    const internalDocId = resolveInternalDocumentId(href, docContext?.files)
    if (internalDocId) {
      const target = docContext?.files.find((file) => file.id === internalDocId)
      const route = target?.type === 'spreadsheet' ? `/spreadsheet/${internalDocId}` : `/document/${internalDocId}`
      linkToCopy = typeof window !== 'undefined' && window.location ? `${window.location.origin}${route}` : route
    } else if (/^https?:\/\//i.test(href) || /^(?:mailto:|ftp:|tel:)/i.test(href)) {
      linkToCopy = href
    } else if (href.startsWith('/')) {
      linkToCopy = typeof window !== 'undefined' && window.location ? `${window.location.origin}${href}` : href
    } else {
      linkToCopy = `https://${href}`
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(linkToCopy)
        setCopiedLink(true)
      }
    } catch {
      // ignore
    }
  }

  const handleImageClick = (event: MouseEvent) => {
    if (!href || isResizing) return
    event.preventDefault()
    event.stopPropagation()
    handleOpenLink()
  }

  const isExternalLink = Boolean(href && isExternalUrl(href, docContext?.files))

  const hasCaptionContent = Boolean(caption?.trim()) || isEditingCaption

  // Alignment container classes
  const alignmentClass =
    align === 'left'
      ? 'items-start text-left'
      : align === 'right'
        ? 'items-end text-right'
        : 'items-center text-center'

  const alignIcon =
    align === 'left'
      ? TextAlignLeftIcon
      : align === 'right'
        ? TextAlignEndIcon
        : TextAlignCenterIcon

  return (
    <NodeViewWrapper
      as="figure"
      className={`mybook-image-block not-prose group/image relative my-4 flex flex-col select-none ${alignmentClass} ${
        selected ? 'ProseMirror-selectednode' : ''
      }`}
      data-type="image"
      data-align={align}
      data-caption={caption || undefined}
      data-show-caption={showCaption ? 'true' : 'false'}
      data-menu-open={isToolbarActive ? 'true' : 'false'}
      data-has-link={href ? 'true' : 'false'}
      data-href={href || undefined}
    >
      <div
        ref={containerRef}
        className={`relative flex w-full flex-col ${alignmentClass}`}
      >
        {/* Resizable Image Container */}
        <div
          className="relative inline-block max-w-full"
          style={{ width: width || '100%' }}
        >
          {/* Action Toolbar (floating top-right, Code Block pattern) */}
          <div
            ref={toolbarRef}
            className={`mybook-image-block-toolbar group-hover/image:opacity-100 group-hover/image:pointer-events-auto ${isToolbarActive ? 'is-open' : ''}`}
            data-state={isToolbarActive ? 'open' : 'closed'}
            contentEditable={false}
            data-testid="image-toolbar"
          >
            {/* Desktop Only: 1. Replace Button */}
            <div className="mybook-desktop-only-action">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Replace image"
                title="Replace image"
                onClick={handleOpenReplace}
                className="mybook-image-toolbar-button"
              >
                <HugeiconsIcon icon={ReloadIcon} strokeWidth={2} className="size-4" />
              </Button>
            </div>

            {/* Desktop Only: 2. Full screen Button */}
            <div className="mybook-desktop-only-action">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Full screen"
                title="Full screen"
                onClick={() => setShowFullscreen(true)}
                className="mybook-image-toolbar-button"
              >
                <HugeiconsIcon icon={ArrowExpandIcon} strokeWidth={2} className="size-4" />
              </Button>
            </div>

            {/* Desktop Only: 3. Copy Button */}
            <div className="mybook-desktop-only-action">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={copied ? 'Copied' : 'Copy block'}
                title={copied ? 'Copied' : 'Copy block'}
                onClick={handleCopy}
                className="mybook-image-toolbar-button"
              >
                <HugeiconsIcon icon={copied ? Tick02Icon : CopyIcon} strokeWidth={2} className="size-4" />
              </Button>
            </div>

            {/* Desktop Only: 4. Align Dropdown */}
            <div className="mybook-desktop-only-action">
              <DropdownMenu open={isAlignOpen} onOpenChange={setIsAlignOpen}>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Align image"
                      title={`Align (${align})`}
                      className="mybook-image-toolbar-button"
                    />
                  }
                >
                  <HugeiconsIcon icon={alignIcon} strokeWidth={2} className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="min-w-32 rounded-xl">
                  <DropdownMenuItem
                    onClick={() => {
                      updateAttributes({ align: 'left' })
                      setIsAlignOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={TextAlignLeftIcon} strokeWidth={2} className="size-4" />
                    <span>Left</span>
                    {align === 'left' ? <HugeiconsIcon icon={Tick02Icon} className="ml-auto size-3.5" /> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      updateAttributes({ align: 'center' })
                      setIsAlignOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={TextAlignCenterIcon} strokeWidth={2} className="size-4" />
                    <span>Center</span>
                    {align === 'center' ? <HugeiconsIcon icon={Tick02Icon} className="ml-auto size-3.5" /> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      updateAttributes({ align: 'right' })
                      setIsAlignOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={TextAlignEndIcon} strokeWidth={2} className="size-4" />
                    <span>Right</span>
                    {align === 'right' ? <HugeiconsIcon icon={Tick02Icon} className="ml-auto size-3.5" /> : null}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* 5. More Dropdown / Mobile Bottom Sheet */}
            <DropdownMenu open={isMoreOpen} onOpenChange={setIsMoreOpen}>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="More image options"
                    title="More options"
                    className="mybook-image-toolbar-button"
                  />
                }
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                bottomSheet={isTouch}
                align="end"
                sideOffset={6}
                className="min-w-56 rounded-xl p-1.5 shadow-lg"
              >
                {/* On mobile/touch, expose Replace, Fullscreen, Copy, and Alignment */}
                {isTouch ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        handleOpenReplace()
                        setIsMoreOpen(false)
                      }}
                      className="flex items-center gap-2"
                    >
                      <HugeiconsIcon icon={ReloadIcon} strokeWidth={2} className="size-4 shrink-0" />
                      <span className="whitespace-nowrap">Replace</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setShowFullscreen(true)
                        setIsMoreOpen(false)
                      }}
                      className="flex items-center gap-2"
                    >
                      <HugeiconsIcon icon={ArrowExpandIcon} strokeWidth={2} className="size-4 shrink-0" />
                      <span className="whitespace-nowrap">Full screen</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      closeOnClick={false}
                      onClick={() => {
                        void handleCopy()
                      }}
                      className="flex items-center gap-2"
                    >
                      <HugeiconsIcon icon={copied ? Tick02Icon : CopyIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                      <span className="whitespace-nowrap">{copied ? 'Copied' : 'Copy image'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const nextAlign = align === 'left' ? 'center' : align === 'center' ? 'right' : 'left'
                        updateAttributes({ align: nextAlign })
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={alignIcon} strokeWidth={2} className="size-4 shrink-0" />
                        <span>Align</span>
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{align}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                {isExternalLink ? (
                  <DropdownMenuItem
                    onClick={() => {
                      handleOpenLink()
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={SquareArrowOutUpRightIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                    <span className="whitespace-nowrap">Open</span>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onClick={() => {
                    handleDuplicate()
                    setIsMoreOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <HugeiconsIcon icon={Copy02Icon} strokeWidth={2} className="size-4 shrink-0" />
                  <span className="whitespace-nowrap">Duplicate</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    handleDownload()
                    setIsMoreOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-4 shrink-0" />
                  <span className="whitespace-nowrap">Download</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setShowLinkPicker(true)
                    setIsMoreOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                  <span className="whitespace-nowrap">{href ? 'Edit link' : 'Add link'}</span>
                </DropdownMenuItem>

                {href ? (
                  <DropdownMenuItem
                    onClick={() => {
                      updateAttributes({ href: null })
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={LinkOffIcon} strokeWidth={2} className="size-4 shrink-0" />
                    <span className="whitespace-nowrap">Remove link</span>
                  </DropdownMenuItem>
                ) : null}

                {href ? (
                  <DropdownMenuItem
                    closeOnClick={false}
                    onClick={() => {
                      void handleCopyLink()
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={copiedLink ? Tick02Icon : CopyLinkIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                    <span className="whitespace-nowrap">{copiedLink ? 'Copied' : 'Copy link'}</span>
                  </DropdownMenuItem>
                ) : null}

                {hasCaptionContent ? (
                  <DropdownMenuItem
                    onClick={() => {
                      handleDeleteCaption()
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center justify-between text-destructive focus:text-destructive whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={CaptionsOffIcon} strokeWidth={2} className="size-4 shrink-0" />
                      <span className="whitespace-nowrap">Remove caption</span>
                    </div>
                    <button
                      type="button"
                      aria-label={showCaption ? 'Hide caption' : 'Show caption'}
                      title={showCaption ? 'Hide caption' : 'Show caption'}
                      onClick={(e) => {
                        handleToggleShowCaption(e)
                      }}
                      className="ml-3 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
                    >
                      <HugeiconsIcon
                        icon={showCaption ? ViewIcon : ViewOffSlashIcon}
                        strokeWidth={2}
                        className="size-4"
                      />
                    </button>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => {
                      handleAddCaption()
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={CaptionsIcon} strokeWidth={2} className="size-4 shrink-0" />
                    <span className="whitespace-nowrap">Add caption</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    handleDelete()
                    setIsMoreOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4 shrink-0" />
                  <span className="whitespace-nowrap">Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Actual Image */}
          {Boolean(src) && (
            <img
              key={`${src}-${retryKey}`}
              ref={imageRef}
              src={src}
              alt={alt}
              loading={imageStatus === 'loaded' ? 'lazy' : 'eager'}
              decoding="async"
              referrerPolicy="no-referrer"
              draggable={false}
              onLoad={() => setImageStatus('loaded')}
              onError={() => setImageStatus('error')}
              onClick={handleImageClick}
              title={href ? (href.startsWith('doc:') ? 'Linked page' : `Linked to: ${href}`) : undefined}
              className={`mybook-image w-full rounded-lg object-contain transition-shadow duration-150 ${
                imageStatus === 'loaded'
                  ? 'block'
                  : imageStatus === 'loading'
                  ? 'absolute inset-0 size-full opacity-0 pointer-events-none'
                  : 'hidden'
              } ${
                href ? 'cursor-pointer' : ''
              } ${
                selected ? 'ring-2 ring-primary ring-offset-2' : ''
              }`}
            />
          )}

          {/* Loading Placeholder */}
          {imageStatus === 'loading' ? (
            <div
              className="flex min-h-36 w-full items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-subtle)] text-muted-foreground"
              contentEditable={false}
            >
              <div className="flex flex-col items-center gap-2">
                <PhotoIcon className="size-8 opacity-40 animate-pulse" />
                <span className="text-[11px] opacity-60">Loading image…</span>
              </div>
            </div>
          ) : null}

          {/* Error / Broken State */}
          {imageStatus === 'error' ? (
            <div
              role="alert"
              className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 p-6 text-center text-xs text-muted-foreground"
              contentEditable={false}
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <PhotoIcon className="size-5" />
              </div>
              <div className="max-w-xs space-y-0.5">
                <p className="font-medium text-foreground">
                  {!src ? (alt || 'Image source missing') : 'Unable to load image'}
                </p>
                <p
                  className="truncate text-[11px] text-muted-foreground"
                  title={
                    !src
                      ? 'No image URL provided'
                      : src.startsWith('data:')
                      ? 'Embedded image could not be loaded'
                      : src
                  }
                >
                  {!src
                    ? 'Click Replace to select or upload an image'
                    : src.startsWith('data:')
                    ? 'Embedded image could not be loaded'
                    : isRelativePath(src)
                    ? `${src} (not accessible from browser — click Replace to upload)`
                    : src}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                {canRetryImage(src) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRetryKey((k) => k + 1)}
                    className="h-7 rounded-lg text-xs"
                  >
                    <HugeiconsIcon icon={Refresh01Icon} strokeWidth={2} className="mr-1 size-3.5" />
                    Retry
                  </Button>
                )}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleOpenReplace}
                  className="h-7 rounded-lg text-xs"
                >
                  Replace
                </Button>
              </div>
            </div>
          ) : null}

          {/* 4 Corner and 2 Side Resize Handles */}
          <div
            role="slider"
            aria-label="Resize top left"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'nw')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-nw group-hover/image:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize top right"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'ne')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-ne group-hover/image:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize bottom right"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'se')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-se group-hover/image:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize bottom left"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'sw')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-sw group-hover/image:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize left"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'w')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-w group-hover/image:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize right"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'e')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-e group-hover/image:opacity-100"
          />

          {/* Inline Editable Caption (Always Left-Aligned below the image) */}
          {hasCaptionContent && showCaption ? (
            <figcaption className="mt-2 w-full text-left" contentEditable={false}>
              <input
                ref={captionInputRef}
                type="text"
                value={caption}
                onChange={(e) => updateAttributes({ caption: e.target.value })}
                onBlur={() => {
                  if (!caption.trim()) setIsEditingCaption(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    editor.view.focus()
                  }
                }}
                placeholder="Write a caption"
                aria-label="Image caption"
                className="w-full bg-transparent text-left text-xs text-muted-foreground placeholder:text-muted-foreground/60 outline-none hover:text-foreground focus:text-foreground border-b border-transparent focus:border-border transition-colors py-0.5"
              />
            </figcaption>
          ) : null}

          {/* Replace Image Popover (anchored over top-right of image directly below action toolbar, keeping with image alignment and resizing) */}
          {showReplacePicker ? (
            <ImageBlockPicker
              isInline
              title="Replace image"
              submitLabel="Replace"
              initialTab={src && (src.startsWith('http://') || src.startsWith('https://')) ? 'embed' : 'upload'}
              initialUrl={src && (src.startsWith('http://') || src.startsWith('https://')) ? src : ''}
              onClose={() => setShowReplacePicker(false)}
              onInsert={handleReplaceImage}
            />
          ) : null}

          {/* Add / Edit Link Popover (anchored over top-right of image directly below action toolbar) */}
          {showLinkPicker ? (
            <ImageLinkPopover
              isInline
              initialHref={href}
              onSave={(newHref) => {
                updateAttributes({ href: newHref })
              }}
              onRemove={() => {
                updateAttributes({ href: null })
              }}
              onClose={() => setShowLinkPicker(false)}
            />
          ) : null}
        </div>
      </div>

      {/* Fullscreen Overlay Viewer (Portal to document.body) */}
      {showFullscreen ? (
        <ImageFullscreenViewer
          src={src}
          alt={alt}
          caption={caption}
          onClose={() => setShowFullscreen(false)}
          onReplace={(newSrc, newAlt) => {
            if (newSrc) {
              handleReplaceImage(newSrc, newAlt ?? alt)
            } else {
              handleOpenReplace()
            }
          }}
          onDownload={handleDownload}
          onDelete={handleDelete}
        />
      ) : null}
    </NodeViewWrapper>
  )
}
