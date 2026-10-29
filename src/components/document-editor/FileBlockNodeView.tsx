import {
  Copy02Icon,
  CopyIcon,
  CopyLinkIcon,
  Delete02Icon,
  Download01Icon,
  FileCodeIcon,
  LinkIcon,
  LinkOffIcon,
  MoreHorizontalIcon,
  ReloadIcon,
  SquareArrowOutUpRightIcon,
  Table01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from 'react'

import { useDeviceMode } from '../../hooks/useDeviceMode'
import { Button } from '../ui/button'
import { Card, CardAction, CardContent, CardHeader } from '../ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { useDocumentLinkContext } from './DocumentLinkContext'
import { dataUrlToBlob, decodeDataUrlToArrayBuffer, decodeDataUrlToText, downloadFile, parseFileUrl } from './fileClipboard'
import { FileBlockPicker } from './FileBlockPicker'
import { FileEditLinkPopover } from './FileEditLinkPopover'
import { getFileTypeDetails } from './fileIcons'
import { resolveInternalDocumentId } from './imageClipboard'
import { ImageLinkPopover } from './ImageLinkPopover'
import {
  convertDocxToHtml,
  csvToHtmlTable,
  getEmbeddableFileType,
  normalizeInlineFormatting,
} from '../../services/documentImport'

export function FileBlockNodeView({
  editor,
  getPos,
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const { isTouch } = useDeviceMode()
  const docContext = useDocumentLinkContext()
  const {
    src = '',
    name = '',
    mimeType = '',
    size = 0,
    href = null,
  } = node.attrs

  const fileName = name || 'File'
  // Remove extension from displayed file title
  const displayName = useMemo(() => {
    const clean = fileName.replace(/\.[^/.]+$|$/u, '').trim()
    return clean || fileName
  }, [fileName])

  const isUrl = Boolean(src && (src.startsWith('http://') || src.startsWith('https://')))
  const isLocalFile = src.startsWith('data:') || src.startsWith('blob:')
  const effectiveLink = href || (isUrl ? src : '')
  const isPdf = String(mimeType).toLowerCase() === 'application/pdf' || /\.pdf$/iu.test(fileName) || /^data:application\/pdf(?:;|,)/iu.test(src) || /\.pdf(?:$|\?)/iu.test(src)
  const canPreviewPdf = Boolean(src && isPdf)
  const isPdfPreview = canPreviewPdf && node.attrs.pdfPreview === true
  const { extension, label, icon: FileIcon, sizeFormatted } = getFileTypeDetails(fileName, mimeType, size)

  const embeddableType = getEmbeddableFileType(fileName, mimeType)
  const canEmbedAsContent = Boolean(src) && (embeddableType === 'docx' || embeddableType === 'html' || embeddableType === 'csv')

  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isPdfPreview || !src || !src.startsWith('data:')) {
      setPreviewBlobUrl(null)
      return
    }

    if (typeof window === 'undefined' || typeof window.URL?.createObjectURL !== 'function') {
      setPreviewBlobUrl(null)
      return
    }

    const blob = dataUrlToBlob(src)
    if (!blob) {
      setPreviewBlobUrl(null)
      return
    }

    const url = window.URL.createObjectURL(blob)
    setPreviewBlobUrl(url)

    return () => {
      window.URL.revokeObjectURL(url)
    }
  }, [isPdfPreview, src])

  const activePreviewSrc = previewBlobUrl || src

  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [showReplacePicker, setShowReplacePicker] = useState(false)
  const [showEditLinkPopover, setShowEditLinkPopover] = useState(false)
  const [showAttachedLinkPopover, setShowAttachedLinkPopover] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const isToolbarActive = isMoreOpen || showReplacePicker || showEditLinkPopover || showAttachedLinkPopover

  // Auto-probe HEAD request for URL-based files to get Content-Length (file size)
  useEffect(() => {
    if (!isUrl || (size && size > 0)) return
    let isMounted = true
    const controller = new AbortController()

    fetch(src, { method: 'HEAD', signal: controller.signal })
      .then((res) => {
        if (!isMounted) return
        const lengthHeader = res.headers.get('content-length')
        if (lengthHeader) {
          const parsedSize = parseInt(lengthHeader, 10)
          if (Number.isFinite(parsedSize) && parsedSize > 0) {
            updateAttributes({ size: parsedSize })
          }
        }
        const typeHeader = res.headers.get('content-type')
        if (typeHeader && !mimeType) {
          updateAttributes({ mimeType: typeHeader.split(';')[0]?.trim() })
        }
      })
      .catch(() => {
        // Silently ignore CORS / network probe failures
      })

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [isUrl, src, size, mimeType, updateAttributes])

  // Copy block timeout
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

  const domain = useMemo(() => {
    if (!isUrl) return ''
    try {
      return new URL(src).hostname.replace(/^www\./u, '')
    } catch {
      return ''
    }
  }, [isUrl, src])

  const metaText = useMemo(() => {
    const parts: string[] = []
    if (extension) {
      parts.push(extension)
    }
    if (sizeFormatted) {
      parts.push(sizeFormatted)
    } else if (domain) {
      parts.push(domain)
    } else if (isUrl) {
      parts.push('Link')
    }
    return parts.join(' · ') || 'File'
  }, [extension, sizeFormatted, domain, isUrl])

  const handleOpenLink = () => {
    if (!effectiveLink) return
    const internalDocId = resolveInternalDocumentId(effectiveLink, docContext?.files)
    if (internalDocId) {
      docContext?.openDocument(internalDocId)
    } else {
      const targetUrl = /^https?:\/\//i.test(effectiveLink) || effectiveLink.startsWith('/') ? effectiveLink : `https://${effectiveLink}`
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleCardClick = (event: MouseEvent) => {
    if (effectiveLink) {
      event.preventDefault()
      event.stopPropagation()
      handleOpenLink()
    } else {
      // Do not download or preview/open file when clicked. Select node in editor.
      const pos = getPos()
      if (pos !== undefined && editor) {
        if (typeof editor.commands?.setNodeSelection === 'function') {
          editor.commands.setNodeSelection(pos)
        }
        editor.view?.focus?.()
      }
    }
  }

  const handleDownload = () => {
    void downloadFile(src, fileName)
  }

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(src)
      }
    } catch {
      // ignore
    }
    setCopied(true)
  }

  const handleCopySrcLink = async () => {
    if (!src || !isUrl) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(src)
        setCopiedLink(true)
      }
    } catch {
      // ignore
    }
  }

  const handleCopyHrefLink = async () => {
    if (!effectiveLink) return
    let linkToCopy = effectiveLink
    const internalDocId = resolveInternalDocumentId(effectiveLink, docContext?.files)
    if (internalDocId) {
      const target = docContext?.files.find((file) => file.id === internalDocId)
      const route = target?.type === 'spreadsheet' ? `/spreadsheet/${internalDocId}` : `/document/${internalDocId}`
      linkToCopy = typeof window !== 'undefined' && window.location ? `${window.location.origin}${route}` : route
    } else if (/^https?:\/\//i.test(effectiveLink) || /^(?:mailto:|ftp:|tel:)/i.test(effectiveLink)) {
      linkToCopy = effectiveLink
    } else if (effectiveLink.startsWith('/')) {
      linkToCopy = typeof window !== 'undefined' && window.location ? `${window.location.origin}${effectiveLink}` : effectiveLink
    } else {
      linkToCopy = `https://${effectiveLink}`
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

  const togglePdfPreview = () => {
    if (!canPreviewPdf) return
    updateAttributes({ pdfPreview: !isPdfPreview })
    setIsMoreOpen(false)
  }

  const handleEmbedAsContent = async () => {
    const pos = getPos()
    if (pos === undefined) return

    try {
      let contentHtml = ''
      if (isLocalFile) {
        if (embeddableType === 'docx') {
          const buffer = decodeDataUrlToArrayBuffer(src)
          const { html } = await convertDocxToHtml(buffer)
          contentHtml = html
        } else if (embeddableType === 'html') {
          const text = decodeDataUrlToText(src)
          contentHtml = normalizeInlineFormatting(text)
        } else if (embeddableType === 'csv') {
          const text = decodeDataUrlToText(src)
          contentHtml = csvToHtmlTable(text)
        }
      } else if (isUrl) {
        const response = await fetch(src)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        if (embeddableType === 'docx') {
          const buffer = await response.arrayBuffer()
          const { html } = await convertDocxToHtml(buffer)
          contentHtml = html
        } else if (embeddableType === 'html') {
          const text = await response.text()
          contentHtml = normalizeInlineFormatting(text)
        } else if (embeddableType === 'csv') {
          const text = await response.text()
          contentHtml = csvToHtmlTable(text)
        }
      }

      if (contentHtml) {
        editor.chain().focus().insertContentAt({ from: pos, to: pos + node.nodeSize }, contentHtml).run()
      }
    } catch (err) {
      console.error('Failed to embed file content into document:', err)
    }
  }

  const handleDuplicate = () => {
    const pos = getPos()
    if (pos === undefined) return
    editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run()
  }

  const handleDelete = () => {
    if (deleteNode) {
      deleteNode()
      return
    }
    const pos = getPos()
    if (pos !== undefined) {
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
    }
  }

  const handleOpenReplace = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setShowReplacePicker(true)
  }

  const handleReplaceInsert = useCallback(
    (newSrc: string, newName: string, newMimeType = '', newSize = 0) => {
      updateAttributes({
        src: newSrc,
        name: newName || fileName,
        mimeType: newMimeType,
        size: newSize,
      })
      setShowReplacePicker(false)
    },
    [fileName, updateAttributes]
  )

  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (effectiveLink) {
        handleOpenLink()
      }
    }
  }

  const actionToolbar = (
    <>
      {/* 1. Replace Button */}
      <span className="mybook-desktop-only-action">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Replace file"
          title="Replace file"
          onClick={handleOpenReplace}
          className="mybook-image-toolbar-button"
        >
          <HugeiconsIcon icon={ReloadIcon} strokeWidth={2} className="size-4" />
        </Button>
      </span>

      {/* 2. Copy Block Button */}
      <span className="mybook-desktop-only-action">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={copied ? 'Copied' : 'Copy block'}
          title={copied ? 'Copied' : 'Copy block'}
          onClick={handleCopy}
          className="mybook-image-toolbar-button"
        >
          {copied ? (
            <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4 text-primary" />
          ) : (
            <HugeiconsIcon icon={CopyIcon} strokeWidth={2} className="size-4" />
          )}
        </Button>
      </span>

      {/* 3. Duplicate Button */}
      <span className="mybook-desktop-only-action">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Duplicate"
          title="Duplicate"
          onClick={handleDuplicate}
          className="mybook-image-toolbar-button"
        >
          <HugeiconsIcon icon={Copy02Icon} strokeWidth={2} className="size-4" />
        </Button>
      </span>

      {/* 4. More Options Dropdown */}
      <DropdownMenu open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="More file options"
              title="More options"
              className="mybook-image-toolbar-button"
            />
          }
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent bottomSheet={isTouch} align="end" sideOffset={6} className="min-w-48 rounded-xl p-1.5 shadow-lg">
          {isTouch ? (
            <>
              <DropdownMenuItem
                onClick={(e) => {
                  setIsMoreOpen(false)
                  handleOpenReplace(e)
                }}
                className="flex items-center gap-2"
              >
                <HugeiconsIcon icon={ReloadIcon} strokeWidth={2} className="size-4 shrink-0" />
                <span className="whitespace-nowrap">Replace</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                closeOnClick={false}
                onClick={() => {
                  void handleCopy()
                }}
                className="flex items-center gap-2"
              >
                <HugeiconsIcon icon={copied ? Tick02Icon : CopyIcon} strokeWidth={2} className="size-4 shrink-0" />
                <span className="whitespace-nowrap">{copied ? 'Copied' : 'Copy block'}</span>
              </DropdownMenuItem>
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
              <DropdownMenuSeparator />
            </>
          ) : null}

          {effectiveLink ? (
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

          {canPreviewPdf ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={togglePdfPreview} className="flex items-center gap-2">
                <span className="whitespace-nowrap">{isPdfPreview ? 'Show as file card' : 'Embed PDF'}</span>
              </DropdownMenuItem>
            </>
          ) : null}

          {canEmbedAsContent ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  void handleEmbedAsContent()
                  setIsMoreOpen(false)
                }}
                className="flex items-center gap-2"
              >
                <HugeiconsIcon
                  icon={embeddableType === 'csv' ? Table01Icon : FileCodeIcon}
                  strokeWidth={2}
                  className="size-4 shrink-0 text-foreground"
                />
                <span className="whitespace-nowrap">
                  {embeddableType === 'csv' ? 'Embed as table' : 'Embed in document'}
                </span>
              </DropdownMenuItem>
            </>
          ) : null}

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

          {isUrl ? (
            <>
              <DropdownMenuItem
                onClick={() => {
                  setShowEditLinkPopover(true)
                  setIsMoreOpen(false)
                }}
                className="flex items-center gap-2"
              >
                <HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                <span className="whitespace-nowrap">Edit link</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                closeOnClick={false}
                onClick={() => {
                  void handleCopySrcLink()
                }}
                className="flex items-center gap-2"
              >
                <HugeiconsIcon icon={copiedLink ? Tick02Icon : CopyLinkIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                <span className="whitespace-nowrap">{copiedLink ? 'Copied' : 'Copy link'}</span>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem
                onClick={() => {
                  setShowAttachedLinkPopover(true)
                  setIsMoreOpen(false)
                }}
                className="flex items-center gap-2"
              >
                <HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                <span className="whitespace-nowrap">{href ? 'Edit link' : 'Add link'}</span>
              </DropdownMenuItem>

              {href ? (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      updateAttributes({ href: null })
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={LinkOffIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                    <span className="whitespace-nowrap">Remove link</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    closeOnClick={false}
                    onClick={() => {
                      void handleCopyHrefLink()
                    }}
                    className="flex items-center gap-2"
                  >
                    <HugeiconsIcon icon={copiedLink ? Tick02Icon : CopyLinkIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                    <span className="whitespace-nowrap">{copiedLink ? 'Copied' : 'Copy link'}</span>
                  </DropdownMenuItem>
                </>
              ) : null}
            </>
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
    </>
  )

  return (
    <NodeViewWrapper
      as="section"
      data-drag-handle
      className="mybook-link-node-view relative"
      contentEditable={false}
      data-type="file"
      data-menu-open={isToolbarActive ? 'true' : 'false'}
    >
      <Card
        size="sm"
        data-menu-open={isToolbarActive}
        className={`mybook-bookmark-block mybook-file-block ${isPdfPreview ? 'mybook-file-pdf-preview' : ''} rounded-[10px] py-0 gap-0 ring-0 shadow-none data-[size=sm]:[--card-spacing:0px] ${
          selected ? 'ProseMirror-selectednode' : ''
        }`}
      >
        {isPdfPreview ? (
          <>
            <CardHeader className="mybook-file-pdf-header">
              <button
                type="button"
                onClick={handleCardClick}
                aria-label={effectiveLink ? `Open linked destination for ${displayName}` : displayName}
                title={effectiveLink ? (effectiveLink.startsWith('doc:') ? 'Linked page' : `Linked to: ${effectiveLink}`) : undefined}
                className={`mybook-file-pdf-meta text-left ${effectiveLink ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className="mybook-file-pdf-icon" aria-hidden="true">
                  <HugeiconsIcon icon={FileIcon} strokeWidth={1.75} className="size-4 text-primary" />
                </span>
                <span className="mybook-file-pdf-info">
                  <span className="mybook-file-pdf-title" title={fileName}>{displayName}</span>
                  <span className="mybook-file-pdf-sub" title={label}>{metaText}</span>
                </span>
              </button>
              <div className="mybook-file-pdf-actions">
                {actionToolbar}
              </div>
            </CardHeader>

            <CardContent className="mybook-bookmark-content !p-0">
              <iframe
                title={`PDF preview: ${fileName}`}
                src={activePreviewSrc}
                className="block h-[min(70dvh,56rem)] min-h-72 w-full border-0 bg-muted rounded-b-[10px]"
              >
                <p className="p-4 text-xs text-muted-foreground">
                  Your browser does not support inline PDF preview. Please download the file to view it.
                </p>
              </iframe>
            </CardContent>
          </>
        ) : (
          <>
            <CardContent className="mybook-bookmark-content px-0">
              <button
                type="button"
                onClick={handleCardClick}
                onKeyDown={handleKeyDown}
                aria-label={effectiveLink ? `Open linked destination for ${displayName}` : displayName}
                title={effectiveLink ? (effectiveLink.startsWith('doc:') ? 'Linked page' : `Linked to: ${effectiveLink}`) : undefined}
                className={`mybook-bookmark-card ${effectiveLink ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className="mybook-bookmark-logo" aria-hidden="true">
                  <HugeiconsIcon icon={FileIcon} strokeWidth={1.75} className="size-5 text-primary" />
                </span>
                <span className="mybook-bookmark-body">
                  <span className="mybook-bookmark-title" title={fileName}>{displayName}</span>
                  <span className="mybook-bookmark-domain" title={label}>{metaText}</span>
                </span>
              </button>
            </CardContent>

            {/* Right: Action Toolbar on Hover */}
            <CardAction className="mybook-link-card-action-slot">
              {actionToolbar}
            </CardAction>
          </>
        )}
      </Card>

      {/* Replace File Picker Popover */}
      {showReplacePicker ? (
        <FileBlockPicker
          position={null}
          isInline
          title="Replace file"
          submitLabel="Replace"
          initialTab={src.startsWith('data:') || src.startsWith('blob:') ? 'upload' : 'embed'}
          initialUrl={src.startsWith('data:') || src.startsWith('blob:') ? '' : src}
          onClose={() => setShowReplacePicker(false)}
          onInsert={handleReplaceInsert}
        />
      ) : null}

      {/* Edit Link Popover for URL files */}
      {showEditLinkPopover && isUrl ? (
        <FileEditLinkPopover
          initialUrl={src}
          onSave={(newUrl) => {
            const parsed = parseFileUrl(newUrl)
            if (parsed) {
              updateAttributes({
                src: parsed.src,
                name: parsed.name,
                size: 0,
                mimeType: '',
              })
            } else {
              updateAttributes({
                src: newUrl,
                size: 0,
                mimeType: '',
              })
            }
          }}
          onClose={() => setShowEditLinkPopover(false)}
        />
      ) : null}

      {/* Attached Link Popover */}
      {showAttachedLinkPopover ? (
        <ImageLinkPopover
          isInline
          initialHref={href}
          onSave={(newHref) => {
            updateAttributes({ href: newHref })
            setShowAttachedLinkPopover(false)
          }}
          onRemove={() => {
            updateAttributes({ href: null })
            setShowAttachedLinkPopover(false)
          }}
          onClose={() => setShowAttachedLinkPopover(false)}
        />
      ) : null}
    </NodeViewWrapper>
  )
}
