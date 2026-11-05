import {
  ArrowLeft02Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { TextSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'
import { useEffect, useState } from 'react'

import { Button } from '../ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet'
import type { GenerativeActionId, TransformationEngine } from '../../features/writing-assistant/contracts'
import { GenerativeResultPreview } from '../../features/writing-assistant/GenerativeResultPreview'
import { TranslationActionView } from '../../features/writing-assistant/TranslationActionView'
import {
  SELECTION_AI_ACTIONS,
  SELECTION_TONE_OPTIONS,
  useContextualSelectionAi,
} from '../../features/writing-assistant/useContextualSelectionAi'

export interface MobileSelectionAiBarProps {
  editor: Editor
  fileId?: string
  languageId?: string
  customEngine?: TransformationEngine
}

export function MobileSelectionAiBar({
  editor,
  fileId = 'default-doc',
  languageId = 'en',
  customEngine,
}: MobileSelectionAiBarProps) {
  const [hasSelection, setHasSelection] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [subView, setSubView] = useState<'main' | 'translate' | 'tone' | 'ask'>('main')
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
    preferredProvider,
    switchToOnDeviceProvider,
    reset,
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
      const isValid = Boolean(
        selection instanceof TextSelection &&
          !selection.empty &&
          (editor.isFocused || sheetOpen),
      )
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

  const getActionTitle = (id: GenerativeActionId | null) => {
    const item = SELECTION_AI_ACTIONS.find((a) => a.id === id)
    return item ? item.label.replace('…', '') : 'AI Action'
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

  return (
    <>
      {/* Floating Accessory Pill — only visible on mobile when valid selection exists */}
      {hasSelection && !sheetOpen ? (
        <div
          data-mobile-ai-pill="true"
          className="fixed bottom-6 right-4 z-40 flex items-center shadow-lg md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <button
            type="button"
            aria-label="AI Actions on selection"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleOpenSheet}
            className="flex h-10 items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-foreground shadow-md transition hover:bg-[var(--app-subtle)] active:scale-95"
          >
            <HugeiconsIcon icon={SparklesIcon} size={16} className="text-purple-600 dark:text-purple-400" />
            <span>AI Actions</span>
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
                    : subView === 'tone'
                      ? 'Change Tone'
                      : subView === 'ask'
                        ? 'Ask AI about selection'
                        : 'AI Actions on Selection'}
                </SheetTitle>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  preferredProvider === 'local'
                    ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                    : preferredProvider === 'ollama'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                }`}
              >
                {preferredProvider === 'local'
                  ? 'On-Device'
                  : preferredProvider === 'ollama'
                    ? 'Ollama'
                    : 'Cloud'}
              </span>
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
                    onClick={handleConsentApprove}
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
                      ? 'Downloading Writing Assistant…'
                      : downloadProgress.state === 'initializing'
                        ? 'Preparing Writing Assistant…'
                        : 'Generating proposal…'}
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
                  {preferredProvider !== 'local' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      onClick={() => {
                        switchToOnDeviceProvider()
                        void handleRetry()
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Use On-Device Assistant
                    </Button>
                  ) : null}
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
                          } else if (action.id === 'change-tone') {
                            setSubView('tone')
                          } else if (action.id === 'ask-ai') {
                            setSubView('ask')
                          } else {
                            void executeAction(action.id)
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

                {subView === 'tone' ? (
                  <div className="space-y-1">
                    <div className="px-2 pb-1 text-xs text-muted-foreground">Select desired tone:</div>
                    {SELECTION_TONE_OPTIONS.map((tone) => (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => void executeAction('change-tone', { tone: tone.id })}
                        className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-medium text-foreground hover:bg-[var(--app-subtle)] active:bg-[var(--app-subtle)]"
                      >
                        <span>{tone.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {subView === 'ask' ? (
                  <div className="space-y-3">
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="e.g. Turn this into 3 bullet points, fix passive voice..."
                      rows={3}
                      className="w-full resize-none rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!customPrompt.trim()}
                        onClick={() => void executeAction('ask-ai', { instruction: customPrompt.trim() })}
                      >
                        Generate
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
