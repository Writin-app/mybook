import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { Button } from '../../components/ui/button'
import {
  classifyTextLanguage,
  validateTranslationRequest,
  type DetailedLanguageClassification,
} from './translationCapabilityRegistry'
import { modelAssetManager } from './modelAssetManager'
import type { TranslationDirection } from '../../prototype/translation/types'

export interface TranslationActionViewProps {
  sourceText: string
  onTranslate: (options: { sourceLanguage: string; targetLanguage: string }) => void
  onCancel: () => void
  isTranslating?: boolean
  downloadProgress?: {
    state: string
    progress: number
    message?: string
    currentFile?: string
  }
  errorMessage?: string | null
  onClearError?: () => void
}

export const TARGET_LANGUAGE_CHOICES = [
  { id: 'hi', label: 'Hindi (हिंदी, Devanagari)', isOffline: true },
  { id: 'en', label: 'English', isOffline: true },
  { id: 'es', label: 'Spanish (Español)', isOffline: false },
  { id: 'fr', label: 'French (Français)', isOffline: false },
  { id: 'de', label: 'German (Deutsch)', isOffline: false },
  { id: 'ja', label: 'Japanese (日本語)', isOffline: false },
] as const

export function TranslationActionView({
  sourceText,
  onTranslate,
  onCancel,
  isTranslating = false,
  downloadProgress,
  errorMessage,
  onClearError,
}: TranslationActionViewProps) {
  // 1. Language Classification
  const classification: DetailedLanguageClassification = useMemo(() => {
    return classifyTextLanguage(sourceText)
  }, [sourceText])

  // 2. Initial state setup based on detected source language
  const initialTargetLang = classification.language === 'Hindi' ? 'en' : 'hi'
  const [targetLang, setTargetLang] = useState<string>(initialTargetLang)
  const [sourceLangOverride, setSourceLangOverride] = useState<string | null>(null)

  const activeSourceLang = sourceLangOverride ?? (
    classification.language === 'Hindi'
      ? 'hi'
      : classification.language === 'English'
      ? 'en'
      : classification.language === 'Roman Hindi'
      ? 'hi-Latn'
      : classification.language === 'Hinglish'
      ? 'mixed-hi-en'
      : 'en'
  )

  // 3. Determine Translation Direction
  const translationDirection: TranslationDirection | null = useMemo(() => {
    if (activeSourceLang === 'en' && targetLang === 'hi') return 'en-hi'
    if (activeSourceLang === 'hi' && targetLang === 'en') return 'hi-en'
    return null
  }, [activeSourceLang, targetLang])

  // 4. Model Cache Status
  const [isModelCached, setIsModelCached] = useState<boolean | null>(null)
  const [checkingCache, setCheckingCache] = useState(false)

  const checkCache = useCallback(async () => {
    if (!translationDirection) {
      setIsModelCached(false)
      return
    }
    setCheckingCache(true)
    try {
      const cached = await modelAssetManager.isModelCached(translationDirection)
      setIsModelCached(cached)
    } catch {
      setIsModelCached(false)
    } finally {
      setCheckingCache(false)
    }
  }, [translationDirection])

  useEffect(() => {
    void checkCache()
  }, [checkCache])

  // 5. Swap Control
  const canSwap = (activeSourceLang === 'en' && targetLang === 'hi') ||
                  (activeSourceLang === 'hi' && targetLang === 'en')

  const handleSwap = () => {
    if (!canSwap) return
    onClearError?.()
    if (activeSourceLang === 'en') {
      setSourceLangOverride('hi')
      setTargetLang('en')
    } else {
      setSourceLangOverride('en')
      setTargetLang('hi')
    }
  }

  // 6. Pre-flight Validation
  const validation = useMemo(() => {
    return validateTranslationRequest(sourceText, activeSourceLang, targetLang)
  }, [sourceText, activeSourceLang, targetLang])

  // 7. Handle Translate Trigger
  const handleStartTranslation = () => {
    onClearError?.()
    if (!validation.isValid) return
    onTranslate({
      sourceLanguage: activeSourceLang,
      targetLanguage: targetLang,
    })
  }

  const isDownloading = downloadProgress?.state === 'downloading'
  const isInitializing = downloadProgress?.state === 'initializing' || downloadProgress?.state === 'loading'

  return (
    <div
      role="region"
      aria-label="Offline translation options"
      className="space-y-3.5 text-xs text-foreground"
    >
      {/* Language Selection Row */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span>Source &amp; Target Languages</span>
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
            Offline Supported (en ↔ hi)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Source Box */}
          <div className="flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-2">
            <span className="block text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              From
            </span>
            <div className="mt-0.5 font-semibold text-foreground truncate">
              {activeSourceLang === 'en'
                ? 'English'
                : activeSourceLang === 'hi'
                ? 'Hindi (हिंदी)'
                : activeSourceLang === 'hi-Latn'
                ? 'Roman Hindi'
                : activeSourceLang === 'mixed-hi-en'
                ? 'Hinglish'
                : 'English'}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {classification.language === 'English' && activeSourceLang === 'en'
                ? 'Detected'
                : classification.language === 'Hindi' && activeSourceLang === 'hi'
                ? 'Detected (Devanagari)'
                : classification.language === 'Roman Hindi'
                ? 'Detected (Latin script)'
                : classification.language === 'Hinglish'
                ? 'Detected (Mixed)'
                : 'Selected'}
            </span>
          </div>

          {/* Swap Button */}
          <button
            type="button"
            onClick={handleSwap}
            disabled={!canSwap || isTranslating || isDownloading}
            aria-label="Swap source and target languages"
            title={canSwap ? 'Swap source and target' : 'Only English ↔ Hindi can be swapped'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-subtle)] text-muted-foreground hover:bg-[var(--app-surface)] hover:text-foreground disabled:opacity-40 transition-colors"
          >
            <ArrowsRightLeftIcon className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Target Selector */}
          <div className="flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-2">
            <label
              htmlFor="translation-target-select"
              className="block text-[10px] text-muted-foreground font-medium uppercase tracking-wider"
            >
              To
            </label>
            <select
              id="translation-target-select"
              aria-label="Select target language"
              value={targetLang}
              onChange={(e) => {
                onClearError?.()
                setTargetLang(e.target.value)
              }}
              disabled={isTranslating || isDownloading}
              className="mt-0.5 w-full bg-transparent font-semibold text-foreground focus:outline-none"
            >
              {TARGET_LANGUAGE_CHOICES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label} {lang.isOffline ? '(Offline)' : '(Cloud only)'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Language Validation Warnings (e.g. Roman Hindi, Hinglish, Unsupported) */}
      {!validation.isValid ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/60 p-2.5 text-xs text-amber-900 dark:text-amber-200 space-y-1"
        >
          <div className="font-semibold flex items-center gap-1.5">
            <span>Unsupported Language Input</span>
          </div>
          <p className="text-[11px] leading-relaxed">{validation.reason}</p>
        </div>
      ) : null}

      {/* General Error Message */}
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold">Translation Error</p>
            {onClearError ? (
              <button
                type="button"
                onClick={onClearError}
                className="text-[11px] underline opacity-80 hover:opacity-100"
              >
                Dismiss
              </button>
            ) : null}
          </div>
          <p className="text-[11px]">{errorMessage}</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleStartTranslation}
              disabled={!validation.isValid}
            >
              Retry Translation
            </Button>
          </div>
        </div>
      ) : null}

      {/* Download Required State */}
      {!checkingCache && isModelCached === false && validation.isValid && !isDownloading && !isTranslating ? (
        <div
          role="region"
          aria-label="Model download required"
          className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2.5"
        >
          <div className="space-y-1">
            <h4 className="font-semibold text-foreground flex items-center justify-between">
              <span>Offline Translation Model Required</span>
              <span className="text-[11px] font-mono text-muted-foreground font-normal">~14.9 MB</span>
            </h4>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Downloading the {translationDirection === 'en-hi' ? 'English → Hindi' : 'Hindi → English'} model
              enables 100% offline, private translation on this device (~40 MB installed memory).
            </p>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <Button
              type="button"
              size="sm"
              onClick={handleStartTranslation}
              aria-label="Download translation model and translate"
            >
              Download &amp; Translate
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              aria-label="Cancel translation"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {/* Downloading Progress Bar */}
      {isDownloading ? (
        <div
          role="region"
          aria-label="Model download progress"
          aria-live="polite"
          className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2.5"
        >
          <div className="flex items-center justify-between font-medium">
            <span className="text-foreground">Downloading Translation Model…</span>
            <span className="font-mono text-foreground">{downloadProgress?.progress ?? 0}%</span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={downloadProgress?.progress ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-full bg-[var(--app-border)]"
          >
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${Math.max(3, downloadProgress?.progress ?? 0)}%` }}
            />
          </div>

          <p className="text-[11px] text-muted-foreground truncate">
            {downloadProgress?.message || `Downloading ${downloadProgress?.currentFile || 'model files'}…`}
          </p>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              aria-label="Cancel model download"
            >
              Cancel Download
            </Button>
          </div>
        </div>
      ) : null}

      {/* Model Initializing / Translating Spinner */}
      {(isTranslating || isInitializing) && !isDownloading ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="font-medium text-foreground">
              {isInitializing ? 'Preparing translation engine…' : 'Translating text offline…'}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Inference runs locally using Bergamot Marian WASM. Your text never leaves your device.
          </p>
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              aria-label="Cancel active translation"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {/* Ready / Action Footer */}
      {!isDownloading && !isTranslating && !isInitializing && (isModelCached !== false || !validation.isValid) ? (
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {validation.isValid ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                <span>Ready offline</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                <span>Unavailable offline</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleStartTranslation}
              disabled={!validation.isValid || checkingCache}
              aria-label="Start offline translation"
            >
              Translate
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              aria-label="Cancel translation"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
