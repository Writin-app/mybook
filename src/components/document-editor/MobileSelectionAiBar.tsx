import {
  ArrowLeft02Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { TextSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { ArrowUpIcon } from '@heroicons/react/24/outline'

import { Button } from '../ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet'
import type { GenerativeActionId, TransformationEngine } from '../../features/writing-assistant/contracts'
import { GenerativeResultPreview } from '../../features/writing-assistant/GenerativeResultPreview'
import { LOCAL_AI_MODEL_DISPLAY_NAME } from '../../features/writing-assistant/localLlamaEngine'
import { TranslationActionView } from '../../features/writing-assistant/TranslationActionView'
import {
  SELECTION_AI_ACTIONS,
  SELECTION_TRANSLATE_ACTION,
  SELECTION_TONE_OPTIONS,
  useContextualSelectionAi,
} from '../../features/writing-assistant/useContextualSelectionAi'

export interface MobileSelectionAiBarProps {
  editor: Editor
  fileId?: string
  languageId?: string
  customEngine?: TransformationEngine
}

export interface MobileSelectionAiBarHandle {
  open: () => void
}

export const MobileSelectionAiBar = forwardRef<MobileSelectionAiBarHandle, MobileSelectionAiBarProps>(function MobileSelectionAiBar({
  editor,
  fileId = 'default-doc',
  languageId = 'en',
  customEngine,
}: MobileSelectionAiBarProps, ref) {
  const [hasSelection, setHasSelection] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
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
    reset,
    hasConsent,
  } = useContextualSelectionAi({
    editor,
    fileId,
    languageId,
    customEngine,
    onClose: () => {
      setSheetOpen(false)
      setSubView('main')
    },
  })

  useEffect(() => {
    const update = () => {
      const { selection } = editor.state
      const isValid = Boolean(selection instanceof TextSelection && !selection.empty)
      setHasSelection(isValid)
    }

    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    editor.on('focus', update)
    editor.on('blur', update)

    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
      editor.off('focus', update)
      editor.off('blur', update)
    }
  }, [editor, sheetOpen])

  useImperativeHandle(ref, () => ({
    open: () => {
      if (!(editor.state.selection instanceof TextSelection) || editor.state.selection.empty) return
      setSheetOpen(true)
      setSubView('main')
    },
  }), [editor])

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

  const handleOpenSheet = () => {
    setSheetOpen(true)
    setSubView('main')
  }

  const handleCloseSheet = () => {
    setSheetOpen(false)
    setSubView('main')
    reset()
  }

  const runInlineAction = (actionId: GenerativeActionId, options?: { tone?: string; instruction?: string }) => {
    void executeAction(actionId, options)
    if (hasConsent || customEngine) setSheetOpen(false)
  }

  const handleApproveAndMoveToInlineReview = () => {
    const pending = handleConsentApprove()
    setSheetOpen(false)
    void pending
  }

  const isInlineReview = status !== 'idle' && status !== 'consent-needed' && activeActionId !== 'translate'
  const isInlinePrompt = subView === 'ask' && !sheetOpen && status === 'idle'
  const inlineOverlayStyle = (() => {
    const selectionState = editor.state.selection
    const range = snapshot?.range ?? (!selectionState.empty ? { from: selectionState.from, to: selectionState.to } : null)
    if ((!isInlineReview && !isInlinePrompt) || !range) return undefined
    try {
      const selection = editor.view.coordsAtPos(range.from)
      const viewportHeight = window.visualViewport?.height || window.innerHeight
      const placeAbove = isInlineReview
        ? selection.top > 180
        : viewportHeight - selection.bottom < 92 && selection.top > 100
      return {
        position: 'fixed' as const,
        left: '50%',
        top: placeAbove ? selection.top - 8 : Math.max(8, selection.bottom + 8),
        width: `min(92vw, ${Math.max(280, editor.view.dom.getBoundingClientRect().width)}px)`,
        maxHeight: 'min(42dvh, 24rem)',
        overflowY: 'auto' as const,
        transform: placeAbove ? 'translate(-50%, -100%)' : 'translateX(-50%)',
        zIndex: 100,
      }
    } catch {
      return { position: 'fixed' as const, left: '4vw', right: '4vw', bottom: 'calc(var(--mybook-keyboard-offset, 0px) + 1rem)', zIndex: 100 }
    }
  })()

  const submitInlinePrompt = () => {
    if (!customPrompt.trim()) return
    if (!hasConsent && !customEngine) {
      setSheetOpen(true)
      void executeAction('ask-ai', { instruction: customPrompt.trim() })
      return
    }
    runInlineAction('ask-ai', { instruction: customPrompt.trim() })
  }

  return (
    <>
      {/* Floating Accessory Pill — only visible on mobile when valid selection exists */}
      {hasSelection && !sheetOpen && !isInlineReview && !isInlinePrompt ? (
        <div
          data-mobile-ai-pill="true"
          className="fixed right-4 z-40 flex items-center shadow-lg md:hidden"
          style={{ bottom: 'calc(var(--mybook-keyboard-offset, 0px) + 5.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            aria-label="Writin Assist"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleOpenSheet}
            className="flex h-10 items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-foreground shadow-md transition hover:bg-[var(--app-subtle)] active:scale-95"
          >
            <HugeiconsIcon icon={SparklesIcon} size={16} className="text-purple-600 dark:text-purple-400" />
            <span>Writin Assist</span>
          </button>
        </div>
      ) : null}

      {/* Mobile Bottom Sheet for Actions & Preview */}
      <Sheet open={sheetOpen} onOpenChange={(open) => (open ? setSheetOpen(true) : handleCloseSheet())}>
        <SheetContent
          side="bottom"
          className="mybook-bottom-sheet max-h-[85dvh] rounded-t-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3 md:hidden overflow-y-auto"
        >
          <SheetHeader className="border-b border-[var(--app-border)] pb-2.5 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {subView !== 'main' && status === 'idle' ? (
                  <button
                    type="button"
                    aria-label="Back to actions list"
                    onClick={() => setSubView('main')}
                    className="rounded p-1 text-muted-foreground hover:bg-[var(--app-subtle)]"
                  >
                    <HugeiconsIcon icon={ArrowLeft02Icon} size={18} />
                  </button>
                ) : (
                  <HugeiconsIcon icon={SparklesIcon} size={18} className="text-purple-600 dark:text-purple-400" />
                )}
                <SheetTitle className="text-sm font-semibold text-foreground">
                  {subView === 'translate'
                    ? 'Translate Selection'
                    : subView === 'adjust'
                      ? 'Adjust'
                      : subView === 'ask'
                        ? 'Write with Writin Assist'
                        : 'Writin Assist'}
                </SheetTitle>
              </div>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300">Local AI Model - {LOCAL_AI_MODEL_DISPLAY_NAME}</span>
            </div>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {/* Consent Card */}
            {status === 'consent-needed' ? (
              <div
                role="region"
                aria-label="Enable Private Writing Assistant"
                className="space-y-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-subtle)] p-4 text-xs"
              >
                <div>
                  <h4 className="font-semibold text-foreground">Enable Private Writing Assistant</h4>
                  <p className="mt-1 text-muted-foreground">
                    Processes your selection locally on this device. One-time download of approximately 680 MB.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
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
                    onClick={handleApproveAndMoveToInlineReview}
                  >
                    Download & Enable
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Loading / Progress */}
            {status === 'loading' && activeActionId !== 'translate' ? (
              <div
                role="region"
                aria-label="Generation Progress"
                className="space-y-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-subtle)] p-4 text-xs"
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
                    className="h-2 w-full overflow-hidden rounded-full bg-[var(--app-border)]"
                  >
                    <div
                      className="h-full bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${downloadProgress.progress}%` }}
                    />
                  </div>
                ) : null}

                {streamingText ? (
                  <div className="max-h-32 overflow-y-auto rounded-lg bg-[var(--app-surface)] p-2.5 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-words">
                    {streamingText}
                  </div>
                ) : null}

                <div className="flex justify-end pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Preview */}
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
                  onAccept={handleAccept}
                  onRegenerate={handleRegenerate}
                  onDiscard={handleDiscard}
                  compact={activeActionId !== 'translate'}
                />
              </div>
            ) : null}

            {/* Stale Alert */}
            {status === 'stale' ? (
              <div
                role="alert"
                className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
              >
                <p className="font-medium">Selection or Document Changed</p>
                <p>{errorMessage || 'The document was edited. Please select the text again.'}</p>
                <div className="flex justify-end pt-2">
                  <Button type="button" size="sm" variant="ghost" onClick={handleDiscard}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Error Alert */}
            {status === 'error' ? (
              <div
                role="alert"
                className="space-y-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive"
              >
                <p className="font-medium">Transformation Error</p>
                <p>{errorMessage || 'An error occurred during generation.'}</p>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <Button type="button" size="sm" variant="ghost" onClick={handleDiscard}>
                    Close
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void handleRetry()}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Idle Actions Menu or Active Translation View */}
            {status === 'idle' || (status === 'loading' && activeActionId === 'translate') ? (
              <>
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
                            setSheetOpen(false)
                          } else {
                            runInlineAction(action.id)
                          }
                        }}
                        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--app-subtle)] active:bg-[var(--app-subtle)]"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{action.label}</div>
                          <div className="text-xs text-muted-foreground">{action.description}</div>
                        </div>
                      </button>
                    ))}
                    <div className="mt-1 border-t border-[var(--app-border)] pt-1">
                      <button type="button" onClick={() => setSubView('translate')} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--app-subtle)] active:bg-[var(--app-subtle)]">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{SELECTION_TRANSLATE_ACTION.label}</div>
                          <div className="text-xs text-muted-foreground">{SELECTION_TRANSLATE_ACTION.description}</div>
                        </div>
                      </button>
                    </div>
                  </div>
                ) : null}

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

                {subView === 'adjust' ? (
                  <div className="space-y-3">
                    <section aria-label="Adjust length">
                      <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">Make it</div>
                      <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => runInlineAction('shorten')} className="min-h-11 rounded-xl px-3 text-left text-sm font-medium text-foreground hover:bg-[var(--app-subtle)] active:bg-[var(--app-subtle)]">Shorter</button>
                        <button type="button" onClick={() => runInlineAction('expand')} className="min-h-11 rounded-xl px-3 text-left text-sm font-medium text-foreground hover:bg-[var(--app-subtle)] active:bg-[var(--app-subtle)]">Longer</button>
                      </div>
                    </section>
                    <section className="space-y-1 border-t border-[var(--app-border)] pt-3" aria-label="Adjust tone">
                      <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">Change tone</div>
                      {SELECTION_TONE_OPTIONS.map((tone) => (
                        <button key={tone.id} type="button" onClick={() => runInlineAction('change-tone', { tone: tone.id })} className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-medium text-foreground hover:bg-[var(--app-subtle)] active:bg-[var(--app-subtle)]">
                          <span>{tone.label}</span>
                        </button>
                      ))}
                    </section>
                  </div>
                ) : null}

                {subView === 'ask' ? (
                  <div className="space-y-3">
                    <form className="flex items-end gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-sm" onSubmit={(event) => { event.preventDefault(); submitInlinePrompt() }}>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Write with Writin Assist…"
                      aria-label="Write with Writin Assist"
                      rows={1}
                      className="max-h-28 min-h-10 flex-1 resize-y border-0 bg-transparent p-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
                    />
                    <button type="submit" aria-label="Send prompt to Writin Assist" disabled={!customPrompt.trim()} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white disabled:opacity-40"><ArrowUpIcon className="size-5" /></button>
                    </form>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      {isInlinePrompt ? (
        <form
          role="region"
          aria-label="Write with Writin Assist"
          data-selection-ai-popover="true"
          style={inlineOverlayStyle}
          className="flex items-end gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-[0_12px_28px_rgba(0,0,0,0.16)] md:hidden"
          onSubmit={(event) => { event.preventDefault(); submitInlinePrompt() }}
        >
          <HugeiconsIcon icon={SparklesIcon} size={20} className="mb-2 ml-1 shrink-0 text-purple-600 dark:text-purple-400" />
          <textarea
            autoFocus
            value={customPrompt}
            onChange={(event) => setCustomPrompt(event.target.value)}
            placeholder="Write with Writin Assist…"
            aria-label="Write with Writin Assist"
            rows={1}
            className="max-h-28 min-h-10 flex-1 resize-y border-0 bg-transparent p-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          />
          <button type="submit" aria-label="Send prompt to Writin Assist" disabled={!customPrompt.trim()} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white disabled:opacity-40"><ArrowUpIcon className="size-5" /></button>
        </form>
      ) : null}
      {isInlineReview && snapshot ? (
        <div
          role="region"
          aria-label="Writin Assist review"
          data-selection-ai-popover="true"
          style={inlineOverlayStyle}
          className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-0 text-foreground shadow-[0_12px_28px_rgba(0,0,0,0.16)] md:hidden"
        >
          {status === 'loading' ? (
            <div role="region" aria-label="Generation Progress" className="space-y-3 p-3">
              <div className="flex items-center justify-between gap-2 text-sm font-medium">
                <span>{downloadProgress.state === 'downloading' ? 'Downloading local model…' : downloadProgress.state === 'initializing' ? 'Preparing local model…' : getProgressLabel(activeActionId)}</span>
                {downloadProgress.progress > 0 ? <span>{downloadProgress.progress}%</span> : null}
              </div>
              {!streamingText ? <div aria-hidden="true" className="space-y-2 py-1">
                <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--app-subtle)]" />
                <div className="h-3 w-full animate-pulse rounded bg-[var(--app-subtle)]" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--app-subtle)]" />
              </div> : <p className="max-h-20 overflow-y-auto text-sm text-muted-foreground">{streamingText}</p>}
              <div className="flex justify-end"><Button type="button" variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button></div>
            </div>
          ) : status === 'preview' ? (
            <GenerativeResultPreview
              actionId={activeActionId ?? undefined}
              actionTitle={getActionTitle(activeActionId)}
              scopeLabel="Selected text"
              sourceText={snapshot.sourceText}
              proposedText={proposedText}
              explanation={resultExplanation}
              isStale={false}
              onAccept={handleAccept}
              onRegenerate={handleRegenerate}
              onDiscard={handleDiscard}
              compact
            />
          ) : status === 'error' || status === 'stale' ? (
            <div role="alert" className="space-y-2 p-3 text-sm">
              <p className="font-medium">{status === 'stale' ? 'The selection changed' : 'Writin Assist could not finish'}</p>
              <p className="text-muted-foreground">{errorMessage || 'Please try again.'}</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={handleDiscard}>Close</Button>
                {status === 'error' ? <Button type="button" variant="outline" size="sm" onClick={() => void handleRetry()}>Retry</Button> : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
})
