import {
  ArrowLeft02Icon,
  Cancel01Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Editor } from '@tiptap/react'
import { useState } from 'react'

import { Button } from '../../components/ui/button'
import type { GenerativeActionId, TransformationEngine } from './contracts'
import { GenerativeResultPreview } from './GenerativeResultPreview'
import { TranslationActionView } from './TranslationActionView'
import {
  SELECTION_AI_ACTIONS,
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
  } = useContextualSelectionAi({
    editor,
    fileId,
    languageId,
    customEngine,
    onClose,
  })

  const getActionTitle = (id: GenerativeActionId | null) => {
    const item = SELECTION_AI_ACTIONS.find((a) => a.id === id)
    return item ? item.label.replace('…', '') : 'AI Action'
  }

  return (
    <div
      role="dialog"
      aria-label="Contextual AI Actions"
      data-selection-ai-popover="true"
      className={`absolute left-0 z-50 w-80 md:w-96 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3.5 text-foreground shadow-[0_16px_36px_rgba(0,0,0,0.18)] ${
        placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
      }`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
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
              : subView === 'tone'
                ? 'Change Tone'
                : subView === 'ask'
                  ? 'Ask AI about selection'
                  : 'AI Actions'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
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
              ? 'On-Device AI'
              : preferredProvider === 'ollama'
                ? 'Ollama (Daemon)'
                : 'Cloud AI'}
          </span>
          <button
            type="button"
            aria-label="Close AI popover"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-[var(--app-subtle)] hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>
      </div>

      {/* Body Views */}
      <div className="mt-3">
        {/* Consent Card */}
        {status === 'consent-needed' ? (
          <div
            role="region"
            aria-label="Enable Private Writing Assistant"
            className="space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-subtle)] p-3 text-xs"
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
            className="space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-subtle)] p-3 text-xs"
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
                className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--app-border)]"
              >
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-300"
                  style={{ width: `${downloadProgress.progress}%` }}
                />
              </div>
            ) : null}

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
            <p className="font-medium">Transformation Error</p>
            <p>{errorMessage || 'An error occurred during generation.'}</p>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
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

        {/* Idle Views (Action Selection) or Active Translation View */}
        {status === 'idle' || (status === 'loading' && activeActionId === 'translate') ? (
          <>
            {/* SubView: Main 7 actions */}
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
                    className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--app-subtle)]"
                  >
                    <div className="flex-1">
                      <div className="text-xs font-medium text-foreground">{action.label}</div>
                      <div className="text-[11px] text-muted-foreground">{action.description}</div>
                    </div>
                  </button>
                ))}
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

            {/* SubView: Change Tone */}
            {subView === 'tone' ? (
              <div className="space-y-1">
                <div className="px-1 pb-1 text-[11px] text-muted-foreground">Select desired tone:</div>
                {SELECTION_TONE_OPTIONS.map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => void executeAction('change-tone', { tone: tone.id })}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground hover:bg-[var(--app-subtle)]"
                  >
                    <span>{tone.label}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {/* SubView: Ask AI */}
            {subView === 'ask' ? (
              <div className="space-y-3">
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Turn this into 3 bullet points, fix passive voice..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
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
    </div>
  )
}
