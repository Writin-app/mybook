import {
  ArrowLeft02Icon,
  Cancel01Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Editor } from '@tiptap/react'
import { useState } from 'react'
import { ArrowUpIcon } from '@heroicons/react/24/outline'

import { Button } from '../../components/ui/button'
import type { GenerativeActionId, TransformationEngine } from './contracts'
import { GenerativeResultPreview } from './GenerativeResultPreview'
import { LOCAL_AI_MODEL_DISPLAY_NAME } from './localLlamaEngine'
import { TranslationActionView } from './TranslationActionView'
import {
  SELECTION_AI_ACTIONS,
  SELECTION_TRANSLATE_ACTION,
  SELECTION_TONE_OPTIONS,
  useContextualSelectionAi,
} from './useContextualSelectionAi'

export interface SelectionAiPopoverProps {
  editor: Editor
  fileId?: string
  languageId?: string
  customEngine?: TransformationEngine
  onClose: () => void
  placement?: 'top' | 'bottom'
}

export function SelectionAiPopover({
  editor,
  fileId = 'default-doc',
  languageId = 'en',
  customEngine,
  onClose,
  placement = 'bottom',
}: SelectionAiPopoverProps) {
  const [subView, setSubView] = useState<'main' | 'translate' | 'adjust' | 'ask'>('main')
  const [customPrompt, setCustomPrompt] = useState('')

  const {
    status,
    activeActionId,
    snapshot,
    proposedText,
    resultExplanation,
    streamingText,
    errorMessage,
    downloadProgress,
    executeAction,
    handleConsentApprove,
    handleConsentDismiss,
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
    if (id === 'translate') return 'Translated the selected text.'
    if (id === 'improve-writing') return 'Rewrote the selected text.'
    if (id === 'summarize') return 'Summarized the selected text.'
    if (id === 'shorten') return 'Shortened the selected text.'
    if (id === 'expand') return 'Lengthened the selected text.'
    if (id === 'change-tone') return 'Adjusted the tone of the selected text.'
    if (id === 'ask-ai') return 'Updated the selected text with Writin Assist.'
    const item = SELECTION_AI_ACTIONS.find((a) => a.id === id)
    return item ? item.label.replace('…', '') : 'AI Action'
  }

  const getProgressLabel = (id: GenerativeActionId | null) => {
    if (id === 'summarize') return 'Summarizing selected text…'
    if (id === 'shorten') return 'Making the text shorter…'
    if (id === 'expand') return 'Making the text longer…'
    if (id === 'change-tone') return 'Adjusting the tone…'
    if (id === 'ask-ai') return 'Writing with Writin Assist…'
    return 'Rewriting selected text…'
  }

  const isReviewState = status === 'preview' || (status === 'loading' && activeActionId !== 'translate')
  const isEditorPromptState = status === 'idle' && subView === 'ask'
  const isEditorOverlayState = isReviewState || isEditorPromptState
  const reviewStyle = (() => {
    const selection = editor.state.selection
    const range = snapshot?.range ?? (!selection.empty ? { from: selection.from, to: selection.to } : null)
    if (!isEditorOverlayState || !range) return undefined
    try {
      const editorRect = editor.view.dom.getBoundingClientRect()
      const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth
      const width = Math.max(280, Math.min(editorRect.width, viewportWidth - 32))
      let selectionRect: { top: number; bottom: number } | undefined
      try {
        selectionRect = editor.view.coordsAtPos(range.from)
      } catch {
        // Keep the review card usable in environments without layout measurements.
      }
      const selectionTop = selectionRect?.top ?? editorRect.top
      const selectionBottom = selectionRect?.bottom ?? editorRect.bottom
      const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight
      const enoughRoomAbove = isReviewState
        ? selectionTop > 180
        : viewportHeight - selectionBottom < 80 && selectionTop > 80
      return {
        position: 'fixed' as const,
        left: editorRect.left + editorRect.width / 2,
        top: enoughRoomAbove ? selectionTop - 8 : Math.max(8, selectionBottom + 8),
        width,
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'min(42dvh, 24rem)',
        overflowY: 'auto' as const,
        transform: enoughRoomAbove ? 'translate(-50%, -100%)' : 'translateX(-50%)',
        zIndex: 100,
      }
    } catch {
      return undefined
    }
  })()

  return (
    <div
      role={isEditorOverlayState ? 'region' : 'dialog'}
      aria-label={isReviewState ? 'Writin Assist review' : isEditorPromptState ? 'Write with Writin Assist' : 'Writin Assist'}
      data-selection-ai-popover="true"
      className={`${isEditorOverlayState ? 'fixed -translate-x-1/2' : `absolute right-0 ${placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`} z-[100] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-foreground shadow-[0_12px_28px_rgba(0,0,0,0.16)] ${isEditorOverlayState ? 'p-0' : 'w-[min(32rem,calc(100vw-1rem))] p-3.5'}`}
      style={reviewStyle}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Keep the action menu out of the way while a result is being prepared or reviewed. */}
      {status !== 'preview' && !(status === 'loading' && activeActionId !== 'translate') && !isEditorPromptState ? <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
        <div className="flex items-center gap-2">
          {subView !== 'main' && status === 'idle' ? (
            <button
              type="button"
              aria-label="Back to actions list"
              onClick={() => setSubView('main')}
              className="rounded p-1 text-muted-foreground hover:bg-[var(--app-subtle)] hover:text-foreground"
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} size={16} />
            </button>
          ) : (
            <HugeiconsIcon icon={SparklesIcon} size={16} className="text-purple-600 dark:text-purple-400" />
          )}
          <span className="text-xs font-semibold text-foreground">
            {subView === 'translate'
              ? 'Translate Selection'
              : subView === 'adjust'
                ? 'Adjust'
                  : subView === 'ask'
                  ? 'Write with Writin Assist'
                  : 'Writin Assist'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300">Local AI Model - {LOCAL_AI_MODEL_DISPLAY_NAME}</span>
          <button
            type="button"
            aria-label="Close AI popover"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-[var(--app-subtle)] hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>
      </div> : null}

      {/* Body Views */}
      <div className={isEditorOverlayState ? '' : 'mt-3'}>
        {/* Consent Card */}
        {status === 'consent-needed' ? (
          <div
            role="region"
            aria-label="Enable Private Writing Assistant"
            className="space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-xs"
          >
            <div>
              <h4 className="font-semibold text-foreground">Enable Private Writing Assistant</h4>
              <p className="mt-1 text-muted-foreground">
                Process selected text locally on device. Requires a one-time download of approximately 680 MB.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Do not enable on-device assistant now"
                onClick={handleConsentDismiss}
              >
                Not Now
              </Button>
              <Button
                type="button"
                size="sm"
                aria-label="Download & Enable on-device assistant"
                onClick={handleConsentApprove}
              >
                Download & Enable
              </Button>
            </div>
          </div>
        ) : null}

        {/* Loading / Progress State */}
        {status === 'loading' && activeActionId !== 'translate' ? (
          <div
            role="region"
            aria-label="Generation Progress"
            className="space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">
                {downloadProgress.state === 'downloading'
                  ? 'Downloading local model…'
                  : downloadProgress.state === 'initializing'
                    ? 'Preparing local model…'
                    : getProgressLabel(activeActionId)}
              </span>
              {downloadProgress.progress > 0 ? (
                <span className="text-muted-foreground">{downloadProgress.progress}%</span>
              ) : null}
            </div>

            {downloadProgress.progress > 0 ? (
              <div
                role="progressbar"
                aria-valuenow={downloadProgress.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--app-border)]"
              >
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-300"
                  style={{ width: `${downloadProgress.progress}%` }}
                />
              </div>
            ) : null}

            {!streamingText ? <div aria-hidden="true" className="space-y-2 py-1">
              <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--app-subtle)]" />
              <div className="h-3 w-full animate-pulse rounded bg-[var(--app-subtle)]" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--app-subtle)]" />
            </div> : null}
            {streamingText ? (
              <div className="max-h-24 overflow-y-auto rounded bg-[var(--app-surface)] p-2 font-mono text-[11px] text-muted-foreground whitespace-pre-wrap break-words">
                {streamingText}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {/* Preview State */}
        {status === 'preview' && snapshot ? (
          <div className="max-h-[60vh] overflow-y-auto">
            <GenerativeResultPreview
              actionId={activeActionId ?? undefined}
              actionTitle={getActionTitle(activeActionId)}
              scopeLabel="Selected text"
              sourceText={snapshot.sourceText}
              proposedText={proposedText}
              explanation={resultExplanation}
              isStale={false}
              compact={activeActionId !== 'translate'}
              onAccept={handleAccept}
              onRegenerate={handleRegenerate}
              onDiscard={handleDiscard}
            />
          </div>
        ) : null}

        {/* Stale State */}
        {status === 'stale' ? (
          <div
            role="alert"
            className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            <p className="font-medium">Selection or Document Changed</p>
            <p>{errorMessage || 'The document was edited. Please select the text again.'}</p>
            <div className="flex justify-end pt-1">
              <Button type="button" size="sm" variant="ghost" onClick={handleDiscard}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}

        {/* Error State */}
        {status === 'error' ? (
          <div
            role="alert"
            className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
          >
            <p className="font-medium">Writin Assist could not finish</p>
            <p>{errorMessage || 'An error occurred during generation.'}</p>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="ghost" onClick={handleDiscard}>
                Close
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void handleRetry()}>
                Retry
              </Button>
            </div>
          </div>
        ) : null}

        {/* Idle Views (Action Selection) or Active Translation View */}
        {status === 'idle' || (status === 'loading' && activeActionId === 'translate') ? (
          <>
            {/* SubView: Main writing actions */}
            {subView === 'main' ? (
              <div className="space-y-1">
                {SELECTION_AI_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => {
                      if (action.id === 'translate') {
                        setSubView('translate')
                      } else if (action.id === 'adjust') {
                        setSubView('adjust')
                      } else if (action.id === 'ask-ai') {
                        setSubView('ask')
                      } else {
                        void executeAction(action.id)
                      }
                    }}
                    className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--app-subtle)]"
                  >
                    <div className="flex-1">
                      <div className="text-xs font-medium text-foreground">{action.label}</div>
                      <div className="text-[11px] text-muted-foreground">{action.description}</div>
                    </div>
                  </button>
                ))}
                <div className="mt-1 border-t border-[var(--app-border)] pt-1">
                  <button
                    type="button"
                    onClick={() => setSubView('translate')}
                    className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--app-subtle)]"
                  >
                    <div className="flex-1">
                      <div className="text-xs font-medium text-foreground">{SELECTION_TRANSLATE_ACTION.label}</div>
                      <div className="text-[11px] text-muted-foreground">{SELECTION_TRANSLATE_ACTION.description}</div>
                    </div>
                  </button>
                </div>
              </div>
            ) : null}

            {/* SubView: Translate */}
            {subView === 'translate' ? (
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
            ) : null}

            {/* SubView: Adjust tone or length */}
            {subView === 'adjust' ? (
              <div className="space-y-2">
                <section className="space-y-1" aria-label="Adjust length">
                    <div className="px-1 pb-1 text-[11px] font-medium text-muted-foreground">Make it</div>
                  <div className="grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => void executeAction('shorten')} className="rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground hover:bg-[var(--app-subtle)]">Shorter</button>
                    <button type="button" onClick={() => void executeAction('expand')} className="rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground hover:bg-[var(--app-subtle)]">Longer</button>
                  </div>
                </section>
                <section className="space-y-1 border-t border-[var(--app-border)] pt-2" aria-label="Adjust tone">
                  <div className="px-1 pb-1 text-[11px] font-medium text-muted-foreground">Change tone</div>
                  {SELECTION_TONE_OPTIONS.map((tone) => (
                    <button key={tone.id} type="button" onClick={() => void executeAction('change-tone', { tone: tone.id })} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground hover:bg-[var(--app-subtle)]">
                      <span>{tone.label}</span>
                    </button>
                  ))}
                </section>
              </div>
            ) : null}

            {/* SubView: Ask AI */}
            {subView === 'ask' ? (
              <div className="space-y-3">
                <form className="flex items-end gap-2 rounded-2xl bg-[var(--app-surface)] p-2" onSubmit={(event) => { event.preventDefault(); if (customPrompt.trim()) void executeAction('ask-ai', { instruction: customPrompt.trim() }) }}>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Write with Writin Assist…"
                  aria-label="Write with Writin Assist"
                  rows={1}
                  className="max-h-24 min-h-9 flex-1 resize-y border-0 bg-transparent p-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
                />
                <button type="submit" aria-label="Send prompt to Writin Assist" disabled={!customPrompt.trim()} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white disabled:opacity-40"><ArrowUpIcon className="size-5" /></button>
                </form>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
