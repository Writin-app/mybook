import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import type { Editor } from '@tiptap/react'
import { useEffect, useState } from 'react'

import type { GenerativeActionId, TransformationEngine } from './contracts'
import { GenerativeResultPreview } from './GenerativeResultPreview'
import {
  getSharedLocalLlamaEngine,
  LOCAL_AI_MODEL_DISPLAY_NAME,
  LocalLlamaTransformationEngine,
  persistLocalConsent,
  type LocalEngineStatusReport,
} from './localLlamaEngine'
import { TranslationActionView } from './TranslationActionView'
import {
  SELECTION_AI_ACTIONS,
  SELECTION_TONE_OPTIONS,
  SELECTION_TRANSLATE_ACTION,
  useContextualSelectionAi,
} from './useContextualSelectionAi'

export interface SelectionAiPopoverProps {
  editor: Editor
  fileId?: string
  languageId?: string
  customEngine?: TransformationEngine
  onClose: () => void
  onActiveStateChange?: (active: boolean) => void
  placement?: 'top' | 'bottom'
}

function asLocalLlamaEngine(engine?: TransformationEngine | null): LocalLlamaTransformationEngine | null {
  if (engine && 'subscribeStatus' in engine && typeof (engine as LocalLlamaTransformationEngine).subscribeStatus === 'function') {
    return engine as LocalLlamaTransformationEngine
  }
  return null
}

export function SelectionAiPopover({
  editor,
  fileId = 'default-doc',
  languageId = 'en',
  customEngine,
  onClose,
  onActiveStateChange,
  placement = 'bottom',
}: SelectionAiPopoverProps) {
  const [subView, setSubView] = useState<'main' | 'translate' | 'adjust' | 'ask'>('main')
  const [customPrompt, setCustomPrompt] = useState('')

  const rawEngine = customEngine ?? getSharedLocalLlamaEngine()
  const localEngine = asLocalLlamaEngine(rawEngine)
  const [modelStatus, setModelStatus] = useState<LocalEngineStatusReport>(() =>
    localEngine?.getStatus() ?? {
      state: 'unavailable',
      progress: 0,
      message: '',
      modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      isCached: false,
    },
  )

  useEffect(() => {
    if (!localEngine) return
    return localEngine.subscribeStatus(setModelStatus)
  }, [localEngine])

  const {
    status,
    activeActionId,
    snapshot,
    proposedText,
    resultExplanation,
    errorMessage,
    downloadProgress,
    executeAction,
    handleCancel,
    handleAccept,
    handleDiscard,
    handleRegenerate,
    handleRetry,
  } = useContextualSelectionAi({
    editor,
    fileId,
    languageId,
    customEngine,
    onClose,
  })

  const getActionTitle = (id: GenerativeActionId | null) => {
    if (id === 'shorten') return 'Shortened the text'
    if (id === 'expand') return 'Lengthened the text'
    if (id === 'change-tone') return 'Adjusted the tone'
    if (id === 'summarize') return 'Summarized the text'
    if (id === 'ask-ai') return 'Updated the text'
    if (id === 'translate') return 'Translated the text'
    return 'Rewrote the text'
  }

  const isModelDownloading =
    downloadProgress.state === 'downloading' ||
    downloadProgress.state === 'initializing' ||
    modelStatus.state === 'downloading' ||
    modelStatus.state === 'initializing'

  const currentDownloadProgress = downloadProgress.progress || modelStatus.progress || 0
  const isModelReady = modelStatus.state === 'ready' || downloadProgress.state === 'ready'

  const handleDownloadModel = async () => {
    persistLocalConsent(true)
    localEngine?.grantUserConsent()
    try {
      await localEngine?.init()
    } catch (err) {
      console.error('Failed to download local AI model:', err)
    }
  }

  const isWritingAction = activeActionId !== 'translate'
  const isReviewState =
    isWritingAction &&
    (status === 'preview' ||
      status === 'loading' ||
      status === 'error' ||
      status === 'stale')
  const isEditorPromptState = status === 'idle' && subView === 'ask'
  const isEditorOverlayState = isReviewState || isEditorPromptState

  useEffect(() => {
    onActiveStateChange?.(isEditorOverlayState)
    return () => {
      onActiveStateChange?.(false)
    }
  }, [isEditorOverlayState, onActiveStateChange])

  const reviewStyle = (() => {
    const selection = editor.state.selection
    const range = snapshot?.range ?? (!selection.empty ? { from: selection.from, to: selection.to } : null)
    if (!isEditorOverlayState || !range) return undefined
    try {
      const editorRect = editor.view.dom.getBoundingClientRect()
      const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth
      let selectionRect: { top: number; bottom: number; left: number } | undefined
      try {
        selectionRect = editor.view.coordsAtPos(range.from)
      } catch {
        // Fallback
      }

      let textLeft: number | undefined
      try {
        const resolved = editor.state.doc.resolve(range.from)
        const blockStart = resolved.start(resolved.depth)
        const blockCoords = editor.view.coordsAtPos(blockStart)
        textLeft = blockCoords.left
      } catch {
        // Fallback
      }

      const selectionTop = selectionRect?.top ?? editorRect.top
      const selectionBottom = selectionRect?.bottom ?? editorRect.bottom
      const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight

      const enoughRoomAbove = isReviewState
        ? selectionTop > 180
        : viewportHeight - selectionBottom < 80 && selectionTop > 80

      const maxAllowedWidth = 440
      const width = Math.max(280, Math.min(maxAllowedWidth, editorRect.width, viewportWidth - 32))

      // Left-align the sleek floating bar with the text start, clamped within viewport padding
      const targetLeft = textLeft ?? selectionRect?.left ?? editorRect.left
      const padding = 16
      const maxLeft = Math.max(padding, viewportWidth - width - padding)
      const clampedLeft = Math.max(padding, Math.min(maxLeft, targetLeft))

      return {
        position: 'fixed' as const,
        left: clampedLeft,
        top: enoughRoomAbove ? selectionTop - 8 : Math.max(8, selectionBottom + 8),
        width,
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'min(42dvh, 24rem)',
        transform: enoughRoomAbove ? 'translateY(-100%)' : 'none',
        zIndex: 100,
      }
    } catch {
      return undefined
    }
  })()

  // 1. Sleek Floating Prompt Bar (Step 4 "Write with AI" input)
  if (isEditorPromptState) {
    return (
      <form
        role="region"
        aria-label="Write with Writin Assist"
        data-selection-ai-popover="true"
        className="fixed z-[100] flex items-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-foreground shadow-[0_12px_28px_rgba(0,0,0,0.16)]"
        style={reviewStyle}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          if (customPrompt.trim()) void executeAction('ask-ai', { instruction: customPrompt.trim() })
        }}
      >
        <SparklesIcon className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
        <input
          autoFocus
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Write with Writin Assist…"
          aria-label="Write with Writin Assist"
          className="h-7 w-60 border-0 bg-transparent px-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Send prompt to Writin Assist"
          disabled={!customPrompt.trim()}
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition shadow-sm"
        >
          <ArrowUpIcon className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Cancel"
          onClick={() => setSubView('main')}
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--app-subtle)] hover:text-foreground transition"
        >
          <XMarkIcon className="size-3.5" />
        </button>
      </form>
    )
  }

  // 2. Sleek Floating Bar (Step 4 Generating "Writing..." or Finished Review with 3 round buttons)
  if (isReviewState) {
    return (
      <div
        role="region"
        aria-label="Writin Assist review"
        data-selection-ai-popover="true"
        className="fixed z-[100] flex items-center justify-between gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-foreground shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
        style={reviewStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          role="region"
          aria-label={status === 'loading' ? 'Generation Progress' : 'Generation Result Preview'}
          className="flex items-center gap-4 w-full"
        >
          {status === 'loading' ? (
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <SparklesIcon className="size-4 text-purple-600 dark:text-purple-400 animate-pulse shrink-0" />
                <span>Writing...</span>
              </div>
              <button
                type="button"
                aria-label="Cancel"
                onClick={handleCancel}
                className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--app-subtle)] hover:text-foreground transition"
              >
                <XMarkIcon className="size-3.5" />
              </button>
            </div>
          ) : status === 'preview' ? (
            <div className="flex items-center justify-between gap-6 w-full">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground whitespace-nowrap">
                <SparklesIcon className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>{getActionTitle(activeActionId)}</span>
                {proposedText ? <span className="sr-only">{proposedText}</span> : null}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  aria-label="Regenerate"
                  title="Regenerate"
                  onClick={handleRegenerate}
                  className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--app-subtle)] hover:text-foreground transition"
                >
                  <ArrowPathIcon className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Discard"
                  title="Discard"
                  onClick={handleDiscard}
                  className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-[var(--app-subtle)] hover:text-foreground transition"
                >
                  <ArrowUturnLeftIcon className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Accept"
                  title="Accept"
                  onClick={handleAccept}
                  className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
                >
                  <CheckIcon className="size-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          ) : status === 'stale' ? (
            <div className="flex items-center justify-between gap-4 w-full text-xs text-amber-800 dark:text-amber-200">
              <span className="font-medium">Selection or Document Changed</span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={handleDiscard}
                className="rounded px-2 py-0.5 font-medium hover:bg-amber-100 dark:hover:bg-amber-900 transition"
              >
                Dismiss
              </button>
            </div>
          ) : status === 'error' ? (
            <div className="flex items-center justify-between gap-4 w-full text-xs text-destructive">
              <span>{errorMessage || 'Writin Assist could not finish'}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Retry"
                  onClick={() => void handleRetry()}
                  className="flex size-6 items-center justify-center rounded-full hover:bg-[var(--app-subtle)] transition"
                >
                  <ArrowPathIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={handleDiscard}
                  className="flex size-6 items-center justify-center rounded-full hover:bg-[var(--app-subtle)] transition"
                >
                  <XMarkIcon className="size-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  // 3. Compact AI Dropdown Menu (Step 2 & Step 3 with Adjust flyout submenu)
  return (
    <div
      role="dialog"
      aria-label="Writin Assist"
      data-selection-ai-popover="true"
      className={`absolute right-0 ${
        placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
      } z-[100] w-64 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-foreground shadow-[0_12px_28px_rgba(0,0,0,0.16)]`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-[var(--app-border)] pb-2.5">
        <div>
          <div className="text-sm font-semibold text-purple-600 dark:text-purple-400">
            Writin Assist
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Local AI Model - {LOCAL_AI_MODEL_DISPLAY_NAME}
          </div>
        </div>
        {isModelDownloading ? (
          <span
            role="status"
            className="rounded-full border border-[var(--app-border)] bg-[var(--app-subtle)] px-2.5 py-0.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
          >
            {currentDownloadProgress > 0 ? `${currentDownloadProgress}% Downloading..` : 'Downloading..'}
          </span>
        ) : !isModelReady ? (
          <button
            type="button"
            aria-label="Download local AI model"
            onClick={() => void handleDownloadModel()}
            className="flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-[var(--app-subtle)] transition shadow-sm whitespace-nowrap"
          >
            <ArrowDownTrayIcon className="size-3.5 text-muted-foreground" />
            <span>Download</span>
          </button>
        ) : null}
      </div>

      {subView === 'translate' || activeActionId === 'translate' ? (
        <div className="mt-2">
          <TranslationActionView
            sourceText={
              editor?.state?.selection
                ? editor.state.doc.textBetween(
                    editor.state.selection.from,
                    editor.state.selection.to,
                    ' ',
                  )
                : ''
            }
            onTranslate={(opts) =>
              void executeAction('translate', { targetLanguage: opts.targetLanguage })
            }
            onCancel={() => {
              if (status === 'loading') {
                handleCancel()
              }
              setSubView('main')
            }}
            isTranslating={status === 'loading' && activeActionId === 'translate'}
            downloadProgress={downloadProgress}
            errorMessage={errorMessage}
          />
          {status === 'preview' && snapshot ? (
            <div className="mt-3">
              <GenerativeResultPreview
                actionId="translate"
                actionTitle="Translated the selected text."
                scopeLabel="Selected text"
                sourceText={snapshot.sourceText}
                proposedText={proposedText}
                explanation={resultExplanation}
                isStale={false}
                onAccept={handleAccept}
                onRegenerate={handleRegenerate}
                onDiscard={handleDiscard}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 space-y-0.5 relative">
          <button
            type="button"
            onClick={() => void executeAction('improve-writing')}
            className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-[var(--app-subtle)] transition"
          >
            <span>Rewrite</span>
            <span className="sr-only">{SELECTION_AI_ACTIONS.find(a => a.id === 'improve-writing')?.description}</span>
          </button>

          <button
            type="button"
            onClick={() => void executeAction('summarize')}
            className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-[var(--app-subtle)] transition"
          >
            <span>Summarize</span>
            <span className="sr-only">{SELECTION_AI_ACTIONS.find(a => a.id === 'summarize')?.description}</span>
          </button>

          {/* Adjust... with flyout submenu */}
          <div className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={subView === 'adjust'}
              onMouseEnter={() => setSubView('adjust')}
              onClick={() => setSubView(subView === 'adjust' ? 'main' : 'adjust')}
              className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-foreground transition ${
                subView === 'adjust' ? 'bg-[var(--app-subtle)] font-medium' : 'hover:bg-[var(--app-subtle)]'
              }`}
            >
              <span>Adjust...</span>
              <span className="sr-only">Adjust…</span>
              <span className="sr-only">{SELECTION_AI_ACTIONS.find(a => a.id === 'adjust')?.description}</span>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </button>

            {subView === 'adjust' ? (
              <div
                aria-label="Adjust options"
                className="absolute left-full top-0 ml-1.5 w-44 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.16)] text-foreground z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-2 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">Make it</div>
                <button
                  type="button"
                  onClick={() => void executeAction('shorten')}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-foreground hover:bg-[var(--app-subtle)] transition"
                >
                  Shorter
                </button>
                <button
                  type="button"
                  onClick={() => void executeAction('expand')}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-foreground hover:bg-[var(--app-subtle)] transition"
                >
                  Longer
                </button>

                <div className="px-2 pt-2 pb-0.5 text-xs font-medium text-muted-foreground border-t border-[var(--app-border)] mt-1">
                  Change tone
                </div>
                {SELECTION_TONE_OPTIONS.map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => void executeAction('change-tone', { tone: tone.id })}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-foreground hover:bg-[var(--app-subtle)] transition"
                  >
                    {tone.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setSubView('ask')}
            className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-[var(--app-subtle)] transition"
          >
            <span>Write with AI</span>
            <span className="sr-only">Write with Writin Assist…</span>
            <span className="sr-only">{SELECTION_AI_ACTIONS.find(a => a.id === 'ask-ai')?.description}</span>
          </button>

          <div className="border-t border-[var(--app-border)] pt-1 mt-1">
            <button
              type="button"
              onClick={() => setSubView('translate')}
              className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-[var(--app-subtle)] transition"
            >
              <span>Translate</span>
              <span className="sr-only">{SELECTION_TRANSLATE_ACTION.description}</span>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
