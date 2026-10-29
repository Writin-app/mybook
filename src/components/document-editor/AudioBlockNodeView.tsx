import {
  CaptionsIcon,
  CaptionsOffIcon,
  Copy02Icon,
  CopyIcon,
  CopyLinkIcon,
  Delete02Icon,
  Download01Icon,
  GoBackward10SecIcon,
  GoForward10SecIcon,
  LinkIcon,
  MoreHorizontalIcon,
  MusicNote01Icon,
  PauseIcon,
  PlayIcon,
  ReloadIcon,
  SquareArrowOutUpRightIcon,
  TextAlignCenterIcon,
  TextAlignEndIcon,
  TextAlignLeftIcon,
  Tick02Icon,
  ViewIcon,
  ViewOffSlashIcon,
  VolumeHighIcon,
  VolumeMute01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { Button } from '../ui/button'
import { Card } from '../ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { useDeviceMode } from '../../hooks/useDeviceMode'
import { downloadAudio } from './audioClipboard'
import { AudioBlockPicker } from './AudioBlockPicker'
import { AudioEditLinkPopover } from './AudioEditLinkPopover'

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2]
const MIN_WIDTH_PERCENT = 15
const MAX_WIDTH_PERCENT = 100

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function AudioBlockNodeView({
  editor,
  getPos,
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const {
    src = '',
    title = '',
    width = '100%',
    align = 'left',
    artwork = '',
    caption = '',
    showCaption = true,
  } = node.attrs

  const audioTitle = title || 'Audio Track'
  const containerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressTrackRef = useRef<HTMLDivElement>(null)
  const captionInputRef = useRef<HTMLInputElement>(null)

  const { isTouch } = useDeviceMode()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)

  const [isAlignOpen, setIsAlignOpen] = useState(false)
  const [isSpeedOpen, setIsSpeedOpen] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [showReplacePicker, setShowReplacePicker] = useState(false)
  const [showEditLinkPopover, setShowEditLinkPopover] = useState(false)
  const [isEditingCaption, setIsEditingCaption] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const isToolbarActive =
    isAlignOpen || isMoreOpen || showReplacePicker || showEditLinkPopover || isSpeedOpen

  const resizeStateRef = useRef<{
    startX: number
    startWidthPx: number
    containerWidthPx: number
    handle: 'nw' | 'ne' | 'se' | 'sw' | 'w' | 'e'
  } | null>(null)

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

  // Sync audio playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  // Sync volume & muted state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
      audioRef.current.muted = isMuted
    }
  }, [isMuted, volume])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play().catch(() => {
        setIsPlaying(false)
      })
    } else {
      audio.pause()
    }
  }

  const handleSkip = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    const target = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds))
    audio.currentTime = target
    setCurrentTime(target)
  }

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
      audioRef.current.muted = newVolume === 0
    }
  }

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false)
      const restored = volume === 0 ? 1 : volume
      setVolume(restored)
      if (audioRef.current) {
        audioRef.current.muted = false
        audioRef.current.volume = restored
      }
    } else {
      setIsMuted(true)
      if (audioRef.current) {
        audioRef.current.muted = true
      }
    }
  }

  const handleSeekFromPointer = (clientX: number) => {
    const track = progressTrackRef.current
    const audio = audioRef.current
    if (!track || !audio || !duration) return

    const rect = track.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const targetTime = fraction * duration
    audio.currentTime = targetTime
    setCurrentTime(targetTime)
  }

  const handleSeekMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    handleSeekFromPointer(event.clientX)

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      handleSeekFromPointer(moveEvent.clientX)
    }

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const handleSeekKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      handleSkip(-5)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      handleSkip(5)
    } else if (event.key === 'Home') {
      event.preventDefault()
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        setCurrentTime(0)
      }
    } else if (event.key === 'End') {
      event.preventDefault()
      if (audioRef.current && duration) {
        audioRef.current.currentTime = duration
        setCurrentTime(duration)
      }
    }
  }

  // Resizing handlers
  const handleResizeStart = (
    event: ReactPointerEvent,
    handle: 'nw' | 'ne' | 'se' | 'sw' | 'w' | 'e'
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const container = containerRef.current
    const wrapper = containerRef.current?.parentElement
    if (!container || !wrapper) return

    const containerRect = container.getBoundingClientRect()
    const wrapperRect = wrapper.getBoundingClientRect()

    setIsResizing(true)
    resizeStateRef.current = {
      startX: event.clientX,
      startWidthPx: containerRect.width,
      containerWidthPx: wrapperRect.width,
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
    if (!src || !isAudioFromLink) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(src)
        setCopiedLink(true)
      }
    } catch {
      // ignore
    }
  }

  const handleDuplicate = () => {
    const pos = getPos()
    if (pos === undefined) return
    editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run()
  }

  const handleDownload = () => {
    void downloadAudio(src, audioTitle)
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

  const handleOpenReplace = (event?: MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    setShowReplacePicker(true)
  }

  const handleReplaceInsert = useCallback((newSrc: string, newTitle: string) => {
    updateAttributes({
      src: newSrc,
      title: newTitle || audioTitle,
    })
    setShowReplacePicker(false)
    if (audioRef.current) {
      audioRef.current.load()
      setIsPlaying(false)
      setCurrentTime(0)
    }
  }, [audioTitle, updateAttributes])

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

  const alignmentClass =
    align === 'center'
      ? 'items-center text-center'
      : align === 'right'
        ? 'items-end text-right'
        : 'items-start text-left'

  const alignIcon =
    align === 'center'
      ? TextAlignCenterIcon
      : align === 'right'
        ? TextAlignEndIcon
        : TextAlignLeftIcon

  const isAudioFromLink = Boolean(src && (src.startsWith('http://') || src.startsWith('https://')))
  const hasCaptionContent = Boolean(caption?.trim()) || isEditingCaption
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

  return (
    <NodeViewWrapper
      as="figure"
      className={`mybook-audio-block not-prose group/audio relative my-4 flex flex-col select-none ${alignmentClass} ${
        selected ? 'ProseMirror-selectednode' : ''
      }`}
      data-type="audio"
      data-align={align}
      data-caption={caption || undefined}
      data-show-caption={showCaption ? 'true' : 'false'}
      data-menu-open={isToolbarActive ? 'true' : 'false'}
    >
      <div className={`relative flex w-full flex-col ${alignmentClass}`}>
        <div
          ref={containerRef}
          className="relative inline-block max-w-full"
          style={{ width: width || '100%' }}
        >
          {/* Action Toolbar */}
          <div
            contentEditable={false}
            data-testid="audio-toolbar"
            data-state={isToolbarActive ? 'open' : 'closed'}
            className={`mybook-image-block-toolbar group-hover/audio:opacity-100 group-hover/audio:pointer-events-auto ${
              isToolbarActive ? 'is-open' : ''
            }`}
          >
            {/* Desktop Only: 1. Replace Audio Button */}
            <div className="mybook-desktop-only-action">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Replace audio"
                title="Replace audio"
                onClick={handleOpenReplace}
                className="mybook-image-toolbar-button"
              >
                <HugeiconsIcon icon={ReloadIcon} strokeWidth={2} className="size-4" />
              </Button>
            </div>

            {/* Desktop Only: 2. Copy Audio Block */}
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
                {copied ? (
                  <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4 text-primary" />
                ) : (
                  <HugeiconsIcon icon={CopyIcon} strokeWidth={2} className="size-4" />
                )}
              </Button>
            </div>

            {/* Desktop Only: 3. Align Dropdown */}
            <div className="mybook-desktop-only-action">
              <DropdownMenu open={isAlignOpen} onOpenChange={setIsAlignOpen}>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Align audio"
                      title="Align audio"
                      className="mybook-image-toolbar-button"
                    />
                  }
                >
                  <HugeiconsIcon icon={alignIcon} strokeWidth={2} className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" sideOffset={6} className="min-w-36 rounded-xl p-1.5 shadow-lg">
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

            {/* Desktop Only: 4. Duplicate Button */}
            <div className="mybook-desktop-only-action">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Duplicate audio"
                title="Duplicate"
                onClick={handleDuplicate}
                className="mybook-image-toolbar-button"
              >
                <HugeiconsIcon icon={Copy02Icon} strokeWidth={2} className="size-4" />
              </Button>
            </div>

            {/* 5. More Dropdown / Mobile Bottom Sheet */}
            <DropdownMenu open={isMoreOpen} onOpenChange={setIsMoreOpen}>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="More audio options"
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
                {/* On mobile/touch, expose Replace, Copy, and Alignment */}
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
                      closeOnClick={false}
                      onClick={() => {
                        void handleCopy()
                      }}
                      className="flex items-center gap-2"
                    >
                      <HugeiconsIcon icon={copied ? Tick02Icon : CopyIcon} strokeWidth={2} className="size-4 shrink-0 text-foreground" />
                      <span className="whitespace-nowrap">{copied ? 'Copied' : 'Copy audio'}</span>
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
                {isAudioFromLink ? (
                  <DropdownMenuItem
                    onClick={() => {
                      window.open(src, '_blank', 'noopener,noreferrer')
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
                    handleDownload()
                    setIsMoreOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-4 shrink-0" />
                  <span className="whitespace-nowrap">Download</span>
                </DropdownMenuItem>

                {isAudioFromLink ? (
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

          {/* Hidden Native Audio Element */}
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false)
              setCurrentTime(0)
            }}
            onTimeUpdate={() => {
              if (audioRef.current) {
                setCurrentTime(audioRef.current.currentTime)
              }
            }}
            onLoadedMetadata={() => {
              if (audioRef.current) {
                setDuration(audioRef.current.duration || 0)
              }
            }}
            onError={() => {
              setIsPlaying(false)
            }}
            className="hidden"
          />

          {/* Audio Card (Bookmark-Style: no shadow, clean border) */}
          <Card className="mybook-audio-card relative flex flex-col sm:flex-row items-stretch gap-3 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-foreground ring-0 shadow-none transition-colors hover:border-[var(--accent)]">
            {/* Left side: Artwork with absolute Play/Pause button */}
            <div className="relative flex size-20 sm:size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary/15 via-primary/5 to-muted border border-border/40">
              {artwork ? (
                <img
                  src={artwork}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <HugeiconsIcon icon={MusicNote01Icon} strokeWidth={1.5} className="size-9 text-primary/70" />
              )}

              {/* Absolute Play / Pause Button */}
              <Button
                type="button"
                variant="default"
                size="icon"
                aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                title={isPlaying ? 'Pause' : 'Play'}
                onClick={togglePlayPause}
                className="absolute inset-auto size-10 rounded-full bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95 transition-transform"
              >
                <HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} strokeWidth={2.5} className="size-5" />
              </Button>
            </div>

            {/* Right side: Title, Timer below title, Seek bar, Controls, Speed */}
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 py-0.5">
              {/* Top Row: Title on top, Timer directly underneath */}
              <div className="flex flex-col gap-0.5 min-w-0">
                <h4 className="truncate text-sm font-semibold text-foreground leading-snug" title={audioTitle}>
                  {audioTitle}
                </h4>
                <div className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              {/* Middle Row: Seek / Progress Bar (reduced spacing) */}
              <div
                ref={progressTrackRef}
                role="slider"
                tabIndex={0}
                aria-label="Seek time"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(currentTime)}
                aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
                onMouseDown={handleSeekMouseDown}
                onKeyDown={handleSeekKeyDown}
                className="group/seek relative flex h-3.5 w-full cursor-pointer items-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-full"
              >
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted transition-all group-hover/seek:h-2">
                  <div
                    className="h-full bg-primary transition-all duration-75 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div
                  className="absolute size-3 -translate-x-1/2 rounded-full border-2 border-primary bg-background shadow transition-transform group-hover/seek:scale-125"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>

              {/* Bottom Row: Audio Controls, Volume Slider & Speed */}
              <div className="flex items-center justify-between gap-2">
                {/* Left Controls: Skip -10s, Skip +10s, Mute & Volume Hover Slider */}
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Rewind 10 seconds"
                    title="Rewind 10s"
                    onClick={() => handleSkip(-10)}
                    className="rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <HugeiconsIcon icon={GoBackward10SecIcon} strokeWidth={2} className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Fast forward 10 seconds"
                    title="Forward 10s"
                    onClick={() => handleSkip(10)}
                    className="rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <HugeiconsIcon icon={GoForward10SecIcon} strokeWidth={2} className="size-4" />
                  </Button>

                  {/* Volume Control: hover on desktop, visible by default on mobile */}
                  <div className="group/vol relative flex items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                      title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                      onClick={toggleMute}
                      className="rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <HugeiconsIcon
                        icon={isMuted || volume === 0 ? VolumeMute01Icon : VolumeHighIcon}
                        strokeWidth={2}
                        className="size-4"
                      />
                    </Button>
                    <div className="flex items-center overflow-hidden transition-all duration-200 w-14 opacity-100 sm:w-0 sm:opacity-0 sm:group-hover/vol:w-14 sm:group-hover/vol:opacity-100 sm:group-focus-within/vol:w-14 sm:group-focus-within/vol:opacity-100">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        aria-label="Volume"
                        className="h-1.5 w-12 cursor-pointer accent-primary bg-muted rounded-full outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Controls: Playback Speed */}
                <DropdownMenu open={isSpeedOpen} onOpenChange={setIsSpeedOpen}>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        aria-label="Playback speed"
                        title="Playback speed"
                        className="h-6 rounded-md px-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      />
                    }
                  >
                    <span>{playbackRate}x</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={6} className="min-w-28 rounded-xl p-1 shadow-lg">
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <DropdownMenuItem
                        key={speed}
                        onClick={() => {
                          setPlaybackRate(speed)
                          setIsSpeedOpen(false)
                        }}
                        className="flex items-center justify-between text-xs"
                      >
                        <span>{speed}x</span>
                        {playbackRate === speed ? <HugeiconsIcon icon={Tick02Icon} className="size-3.5 text-primary" /> : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </Card>

          {/* 6 Resize Handles */}
          <div
            role="slider"
            aria-label="Resize top left"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'nw')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-nw group-hover/audio:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize top right"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'ne')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-ne group-hover/audio:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize bottom right"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'se')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-se group-hover/audio:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize bottom left"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'sw')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-sw group-hover/audio:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize left"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'w')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-w group-hover/audio:opacity-100"
          />
          <div
            role="slider"
            aria-label="Resize right"
            tabIndex={-1}
            onPointerDown={(e) => handleResizeStart(e, 'e')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            className="mybook-image-resize-handle mybook-resize-e group-hover/audio:opacity-100"
          />

          {/* Inline Editable Caption */}
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
                aria-label="Audio caption"
                className="w-full bg-transparent text-left text-xs text-muted-foreground placeholder:text-muted-foreground/60 outline-none hover:text-foreground focus:text-foreground border-b border-transparent focus:border-border transition-colors py-0.5"
              />
            </figcaption>
          ) : null}

          {/* Replace Audio Picker Popover */}
          {showReplacePicker ? (
            <AudioBlockPicker
              isInline
              title="Replace audio"
              submitLabel="Replace"
              initialTab={src.startsWith('data:') || src.startsWith('blob:') ? 'upload' : 'embed'}
              initialUrl={src.startsWith('data:') || src.startsWith('blob:') ? '' : src}
              onClose={() => setShowReplacePicker(false)}
              onInsert={handleReplaceInsert}
            />
          ) : null}

          {/* Edit Link Popover */}
          {showEditLinkPopover ? (
            <AudioEditLinkPopover
              initialUrl={src}
              onSave={(newUrl) => {
                updateAttributes({ src: newUrl })
                if (audioRef.current) {
                  audioRef.current.load()
                  setIsPlaying(false)
                  setCurrentTime(0)
                }
              }}
              onClose={() => setShowEditLinkPopover(false)}
            />
          ) : null}
        </div>
      </div>
    </NodeViewWrapper>
  )
}
