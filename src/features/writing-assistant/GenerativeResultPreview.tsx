import { useState } from 'react'
import { Button } from '../../components/ui/button'
import type { GenerativeActionId } from './contracts'

interface GenerativeResultPreviewProps {
  actionId?: GenerativeActionId
  actionTitle: string
  scopeLabel: string
  sourceText: string
  proposedText: string
  explanation?: string
  isStale: boolean
  onAccept: () => void
  onRegenerate: () => void
  onDiscard: () => void
  onCopy?: () => void
}

export function GenerativeResultPreview({
  actionId,
  actionTitle,
  scopeLabel,
  sourceText,
  proposedText,
  explanation,
  isStale,
  onAccept,
  onRegenerate,
  onDiscard,
  onCopy,
}: GenerativeResultPreviewProps) {
  const [copied, setCopied] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const isContinueWriting = actionId === 'continue-writing'
  const isAskAi = actionId === 'ask-ai'
  const isTranslation = actionId === 'translate'

  const handleCopy = async () => {
    if (onCopy) {
      onCopy()
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(proposedText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // Fallback
      }
    }
  }

  const handleApply = () => {
    if (isApplying || isStale) return
    setIsApplying(true)
    onAccept()
  }

  const originalSectionTitle = isContinueWriting
    ? `Source Context (${sourceText.length} chars) — Kept in document`
    : `Original (${sourceText.length} chars)`

  const outputSectionTitle = isContinueWriting
    ? `Continuation (${proposedText.length} chars) — To be inserted`
    : isAskAi
      ? `AI Response (${proposedText.length} chars)`
      : isTranslation
        ? `Translation (${proposedText.length} chars)`
        : `Proposed Output (${proposedText.length} chars)`

  const acceptButtonText = isContinueWriting
    ? 'Insert Continuation'
    : isTranslation
      ? 'Insert Translation'
      : isAskAi && scopeLabel === 'Selected text'
        ? 'Replace Selection'
        : 'Accept'

  return (
    <div
      role="region"
      aria-label="Generation Result Preview"
      className="space-y-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-subtle)] p-4 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--app-border)] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{actionTitle}</span>
          <span className="rounded-full bg-[var(--app-surface)] border border-[var(--app-border)] px-2 py-0.5 text-xs text-muted-foreground">
            {scopeLabel}
          </span>
          {isContinueWriting ? (
            <span className="rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800 px-2 py-0.5 text-xs font-medium">
              Insertion / Append
            </span>
          ) : null}
        </div>
        {explanation ? (
          <span className="text-xs text-muted-foreground">{explanation}</span>
        ) : null}
      </div>

      {isContinueWriting ? (
        <div
          role="note"
          aria-label="Continuation notice"
          className="rounded-md border border-blue-200 bg-blue-50/70 p-2.5 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
        >
          This continuation will be inserted following your text/cursor without replacing existing content.
        </div>
      ) : null}

      {isStale ? (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <p className="font-medium">Document changed since generation</p>
          <p className="mt-0.5">
            The document was edited after this result was generated. This preview is stale and cannot be applied. Please generate again.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        <section aria-label="Original text" className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">{originalSectionTitle}</span>
          </div>
          <div className="max-h-48 overflow-y-auto rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono">
            {sourceText}
          </div>
        </section>

        <section aria-label="Generated output" className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">{outputSectionTitle}</span>
            {proposedText.trim() ? (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">Ready to review</span>
            ) : null}
          </div>
          <div className="max-h-60 overflow-y-auto rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-sm text-foreground whitespace-pre-wrap break-words">
            {proposedText}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--app-border)] pt-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            disabled={isStale || isApplying || !proposedText.trim()}
            aria-label={isTranslation ? 'Insert translation' : 'Accept generated text'}
          >
            {isApplying ? 'Inserting…' : acceptButtonText}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={isApplying || !proposedText.trim()}
            aria-label={isTranslation ? 'Copy translation' : 'Copy generated text'}
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={isApplying}
            aria-label={isTranslation ? 'Retry translation' : 'Regenerate output'}
          >
            {isTranslation ? 'Retry' : 'Regenerate'}
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          disabled={isApplying}
          aria-label={isTranslation ? 'Cancel or close preview' : 'Discard generated preview'}
        >
          {isTranslation ? 'Cancel' : 'Discard'}
        </Button>
      </div>
    </div>
  )
}
