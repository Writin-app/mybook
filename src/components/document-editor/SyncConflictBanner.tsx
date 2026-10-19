import { useEffect, useMemo, useRef, useState } from 'react'

import { db } from '../../database/db'
import { cn } from '../../lib/utils'
import type { MyBookFile } from '../../types/files'
import { mergeDocuments } from '../../utils/documentMerge'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

export interface SyncConflictBannerProps {
  onKeepMine: () => void | Promise<boolean | void | unknown>
  onUseRemote: () => void | Promise<boolean | void | unknown>
  onMerge?: (mergedContent: string) => void | Promise<boolean | void | unknown>
  file?: MyBookFile | null
  conflictVersionId?: string
  localContent?: string
  remoteContent?: string
  remoteModifiedTime?: string
  isUnsaved?: boolean
}

function extractReadableContent(raw?: string | null): string {
  if (!raw) return '(Empty)'
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') {
      const parts: string[] = []
      const traverse = (node: unknown) => {
        if (!node || typeof node !== 'object') return
        const n = node as { type?: string; text?: string; content?: unknown[] }
        if (n.type === 'text' && typeof n.text === 'string') {
          parts.push(n.text)
        } else if (Array.isArray(n.content)) {
          for (const child of n.content) {
            traverse(child)
          }
          if (n.type === 'paragraph' || n.type === 'heading' || n.type === 'listItem') {
            parts.push('\n')
          }
        }
      }
      traverse(parsed)
      const text = parts.join('').trim()
      return text || '(Empty document)'
    }
  } catch {
    // not JSON
  }
  return raw.trim() || '(Empty document)'
}

function formatRemoteDate(dateStr?: string | null): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}

interface DiffLine {
  text: string
  status: 'same' | 'local-only' | 'remote-only'
}

function computeLineDiff(localText: string, remoteText: string) {
  const localLines = localText.split('\n')
  const remoteLines = remoteText.split('\n')
  const remoteSet = new Set(remoteLines)
  const localSet = new Set(localLines)

  const diffLocal: DiffLine[] = localLines.map((text) => ({
    text,
    status: remoteSet.has(text) ? 'same' : 'local-only',
  }))

  const diffRemote: DiffLine[] = remoteLines.map((text) => ({
    text,
    status: localSet.has(text) ? 'same' : 'remote-only',
  }))

  return { diffLocal, diffRemote }
}

export function SyncConflictBanner({
  onKeepMine,
  onUseRemote,
  onMerge,
  file,
  conflictVersionId,
  localContent,
  remoteContent,
  remoteModifiedTime,
  isUnsaved,
}: SyncConflictBannerProps) {
  const [isReviewOpen, setIsReviewOpen] = useState(false)
  const [isPostponed, setIsPostponed] = useState(false)
  const [isResolving, setIsResolving] = useState<'keep' | 'remote' | 'merge' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [mergeExplanation, setMergeExplanation] = useState<string | null>(null)
  const [fetchedRemoteContent, setFetchedRemoteContent] = useState<string | null>(null)
  const [resolvedVersionId, setResolvedVersionId] = useState<string | null>(null)
  const [activeMobileTab, setActiveMobileTab] = useState<'local' | 'remote' | 'merged'>('local')
  const [showMergedPreview, setShowMergedPreview] = useState(false)

  const activeVersionId = conflictVersionId ?? file?.syncConflict?.versionId
  const activeRemoteTime = remoteModifiedTime ?? file?.syncConflict?.remoteModifiedTime
  const activeLocalContent = localContent ?? file?.content ?? ''
  const openedVersionIdRef = useRef<string | undefined>(undefined)

  // Fetch remote content from db.fileVersions if not passed explicitly as prop
  useEffect(() => {
    if (remoteContent !== undefined) return
    const vId = activeVersionId
    if (!vId) return

    let active = true
    if (typeof db !== 'undefined' && db?.fileVersions?.get) {
      void db.fileVersions
        .get(vId)
        .then((v) => {
          if (active && v) {
            setFetchedRemoteContent(v.content)
          }
        })
        .catch(() => {})
    }

    return () => {
      active = false
    }
  }, [activeVersionId, remoteContent])

  const effectiveRemoteContent = remoteContent ?? fetchedRemoteContent ?? ''
  const formattedRemoteTime = formatRemoteDate(activeRemoteTime)

  // Detect whether conflict changed while review dialog was open
  const isStale = Boolean(
    isReviewOpen &&
      openedVersionIdRef.current &&
      activeVersionId &&
      activeVersionId !== openedVersionIdRef.current,
  )

  const readableLocalText = useMemo(() => {
    return extractReadableContent(activeLocalContent)
  }, [activeLocalContent])

  const readableRemoteText = useMemo(() => {
    return extractReadableContent(effectiveRemoteContent)
  }, [effectiveRemoteContent])

  const { diffLocal, diffRemote } = useMemo(() => {
    return computeLineDiff(readableLocalText, readableRemoteText)
  }, [readableLocalText, readableRemoteText])

  const mergeEvaluation = useMemo(() => {
    if (file?.type === 'spreadsheet') {
      return {
        canMerge: false,
        reason: 'Spreadsheet documents cannot be merged automatically. Please choose either "Keep my version" or "Use other version".',
        mergedContent: null,
      }
    }
    if (!activeLocalContent || !effectiveRemoteContent) {
      return {
        canMerge: false,
        reason: 'Missing document content to perform merge.',
        mergedContent: null,
      }
    }
    try {
      const res = mergeDocuments(file?.baseContent, activeLocalContent, effectiveRemoteContent)
      if (res.success && !res.hasConflict) {
        return {
          canMerge: true,
          reason: null,
          mergedContent: res.content,
        }
      }
      return {
        canMerge: false,
        reason:
          'Both versions modify the same section incompatibly. An automatic merge cannot be performed safely without overwriting changes. Please choose which version to keep.',
        mergedContent: res.content,
      }
    } catch {
      return {
        canMerge: false,
        reason: 'Could not calculate merge for this document type.',
        mergedContent: null,
      }
    }
  }, [file?.type, file?.baseContent, activeLocalContent, effectiveRemoteContent])

  const readableMergedText = useMemo(() => {
    return mergeEvaluation.mergedContent
      ? extractReadableContent(mergeEvaluation.mergedContent)
      : ''
  }, [mergeEvaluation.mergedContent])

  const handleOpenReview = () => {
    openedVersionIdRef.current = activeVersionId
    setErrorMessage(null)
    setMergeExplanation(null)
    setShowMergedPreview(false)
    setActiveMobileTab('local')
    setIsReviewOpen(true)
  }

  const handleKeepMine = async () => {
    if (isResolving) return
    if (isStale) {
      setErrorMessage('This conflict has changed. Please close this dialog and review the updated version.')
      return
    }
    setIsResolving('keep')
    setErrorMessage(null)
    setMergeExplanation(null)
    try {
      const result = await onKeepMine()
      if (result === false) {
        setErrorMessage('Could not preserve local version. The conflict state may have changed. Please try again.')
        setIsResolving(null)
        return
      }
      if (activeVersionId) {
        setResolvedVersionId(activeVersionId)
      }
      setIsReviewOpen(false)
      setIsResolving(null)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to keep local version. Please try again.')
      setIsResolving(null)
    }
  }

  const handleUseRemote = async () => {
    if (isResolving) return
    if (isStale) {
      setErrorMessage('This conflict has changed. Please close this dialog and review the updated version.')
      return
    }
    setIsResolving('remote')
    setErrorMessage(null)
    setMergeExplanation(null)
    try {
      const result = await onUseRemote()
      if (result === false) {
        setErrorMessage('Could not apply remote version. The document may have been updated. Please try again.')
        setIsResolving(null)
        return
      }
      if (activeVersionId) {
        setResolvedVersionId(activeVersionId)
      }
      setIsReviewOpen(false)
      setIsResolving(null)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to apply remote version. Please try again.')
      setIsResolving(null)
    }
  }

  const handleMerge = async () => {
    if (isResolving) return
    if (isStale) {
      setErrorMessage('This conflict has changed. Please close this dialog and review the updated version.')
      return
    }

    if (!mergeEvaluation.canMerge || !mergeEvaluation.mergedContent) {
      setMergeExplanation(
        mergeEvaluation.reason ??
          'These versions cannot be merged automatically because changes overlap incompatibly. Please select "Keep my version" or "Use other version".',
      )
      return
    }

    if (!onMerge) {
      setMergeExplanation('Automatic merge handler is not configured for this document.')
      return
    }

    setIsResolving('merge')
    setErrorMessage(null)
    setMergeExplanation(null)
    try {
      const result = await onMerge(mergeEvaluation.mergedContent)
      if (result === false) {
        setErrorMessage('Could not merge versions. Please try again or select one version.')
        setIsResolving(null)
        return
      }
      if (activeVersionId) {
        setResolvedVersionId(activeVersionId)
      }
      setIsReviewOpen(false)
      setIsResolving(null)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to merge versions. Please try again.')
      setIsResolving(null)
    }
  }

  if (activeVersionId && resolvedVersionId === activeVersionId) {
    return null
  }

  return (
    <>
      {isPostponed ? (
        <div
          role="region"
          aria-label="Conflicting changes"
          className="mb-3 flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground"
        >
          <span className="truncate">Conflicting changes (pending review)</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs font-medium text-foreground hover:bg-muted"
            onClick={handleOpenReview}
          >
            Review changes
          </Button>
        </div>
      ) : (
        <div
          role="region"
          aria-label="Conflicting changes"
          className="mb-4 flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs text-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Conflicting changes</p>
            <p className="text-muted-foreground">
              This document was changed on another device. Review the versions before deciding what to keep.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1 sm:pt-0">
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-7 px-2.5 text-xs font-medium"
              onClick={handleOpenReview}
            >
              Review changes
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setIsPostponed(true)}
            >
              Later
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={isReviewOpen}
        onOpenChange={(open) => {
          if (!isResolving) {
            setIsReviewOpen(open)
          }
        }}
      >
        <DialogContent
          showCloseButton={!isResolving}
          className="flex h-[90vh] max-h-[90vh] w-[96vw] max-w-[1600px] sm:max-w-[1600px] flex-col gap-3 overflow-hidden p-4 sm:p-6"
        >
          <DialogHeader className="gap-1 text-left shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold sm:text-lg">
                Review conflicting changes
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
              Choose which version to keep. Your existing local draft will be preserved when you switch versions.
            </DialogDescription>
          </DialogHeader>

          {isStale && (
            <div
              role="alert"
              className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200"
            >
              This conflict was updated by newer changes from another sync. Please close this dialog and review the updated versions.
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="shrink-0 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"
            >
              {errorMessage}
            </div>
          )}

          {mergeExplanation && (
            <div
              role="alert"
              className="shrink-0 rounded-md border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs text-blue-900 dark:text-blue-200"
            >
              <p className="font-medium mb-0.5">Merge limitation:</p>
              <p>{mergeExplanation}</p>
            </div>
          )}

          {/* Mobile Tab Switcher */}
          <div className="flex sm:hidden rounded-lg bg-muted/60 p-1 gap-1 shrink-0">
            <button
              type="button"
              className={cn(
                'flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors',
                activeMobileTab === 'local'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveMobileTab('local')}
            >
              Your version
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors',
                activeMobileTab === 'remote'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveMobileTab('remote')}
            >
              Other version
            </button>
            {mergeEvaluation.canMerge && (
              <button
                type="button"
                className={cn(
                  'flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors',
                  activeMobileTab === 'merged'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setActiveMobileTab('merged')}
              >
                Merged preview
              </button>
            )}
          </div>

          {/* Main Comparison Area */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Desktop Merged Preview Mode */}
            {showMergedPreview && mergeEvaluation.canMerge ? (
              <div className="hidden sm:flex flex-1 min-h-0 flex-col rounded-lg border border-border/60 bg-muted/10 p-4 overflow-hidden">
                <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-2 shrink-0">
                  <div>
                    <span className="text-xs font-semibold text-foreground">Merged result preview</span>
                    <p className="text-[11px] text-muted-foreground">3-way clean merge • Preserves non-conflicting edits from both devices</p>
                  </div>
                  <span className="rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-medium border border-emerald-500/20">
                    Clean 3-way merge
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-border/40 bg-background/80 p-4 font-mono text-xs leading-relaxed text-foreground select-text whitespace-pre-wrap">
                  {readableMergedText}
                </div>
              </div>
            ) : (
              /* Desktop Side-by-Side Panes */
              <div className="hidden sm:grid sm:grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
                {/* Your version (Left pane) */}
                <div className="flex flex-col h-full rounded-lg border border-border/60 bg-muted/10 p-3 overflow-hidden">
                  <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-2 shrink-0">
                    <div>
                      <span className="text-xs font-semibold text-foreground">Your version</span>
                      <p className="text-[11px] text-muted-foreground">This device • Local draft</p>
                    </div>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/40">
                      {isUnsaved ? 'Unsaved edits' : 'Current draft'}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-border/40 bg-background/80 p-3 font-mono text-xs leading-relaxed text-foreground select-text whitespace-pre-wrap">
                    {file?.type === 'spreadsheet' ? (
                      <p className="text-muted-foreground italic">Spreadsheet data on this device.</p>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {diffLocal.map((line, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'py-0.5 transition-colors',
                              line.status === 'local-only'
                                ? 'bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 border-l-2 border-emerald-500 pl-2 rounded-r'
                                : 'pl-2 text-foreground/90',
                            )}
                          >
                            {line.text || '\u00A0'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Other version (Right pane) */}
                <div className="flex flex-col h-full rounded-lg border border-border/60 bg-muted/10 p-3 overflow-hidden">
                  <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-2 shrink-0">
                    <div>
                      <span className="text-xs font-semibold text-foreground">Other version</span>
                      <p className="text-[11px] text-muted-foreground">Google Drive</p>
                    </div>
                    {formattedRemoteTime ? (
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/40">
                        {formattedRemoteTime}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-border/40 bg-background/80 p-3 font-mono text-xs leading-relaxed text-foreground select-text whitespace-pre-wrap">
                    {file?.type === 'spreadsheet' ? (
                      <p className="text-muted-foreground italic">Spreadsheet data from Google Drive.</p>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {diffRemote.map((line, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'py-0.5 transition-colors',
                              line.status === 'remote-only'
                                ? 'bg-sky-500/10 text-sky-950 dark:text-sky-200 border-l-2 border-sky-500 pl-2 rounded-r'
                                : 'pl-2 text-foreground/90',
                            )}
                          >
                            {line.text || '\u00A0'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mobile View (Tabbed Pane) */}
            <div className="flex sm:hidden flex-1 min-h-0 flex-col rounded-lg border border-border/60 bg-muted/10 p-3 overflow-hidden">
              <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-2 shrink-0">
                <div>
                  <span className="text-xs font-semibold text-foreground">
                    {activeMobileTab === 'local'
                      ? 'Your version'
                      : activeMobileTab === 'remote'
                        ? 'Other version'
                        : 'Merged preview'}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {activeMobileTab === 'local'
                      ? 'This device • Local draft'
                      : activeMobileTab === 'remote'
                        ? 'Google Drive'
                        : 'Clean 3-way merge'}
                  </p>
                </div>
                {activeMobileTab === 'local' && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {isUnsaved ? 'Unsaved edits' : 'Current draft'}
                  </span>
                )}
                {activeMobileTab === 'remote' && formattedRemoteTime && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {formattedRemoteTime}
                  </span>
                )}
                {activeMobileTab === 'merged' && (
                  <span className="rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-medium">
                    Clean merge
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-border/40 bg-background/80 p-3 font-mono text-xs leading-relaxed text-foreground select-text whitespace-pre-wrap">
                {activeMobileTab === 'local' ? (
                  file?.type === 'spreadsheet' ? (
                    'Spreadsheet data on this device.'
                  ) : (
                    readableLocalText
                  )
                ) : activeMobileTab === 'remote' ? (
                  file?.type === 'spreadsheet' ? (
                    'Spreadsheet data from Google Drive.'
                  ) : (
                    readableRemoteText
                  )
                ) : (
                  readableMergedText
                )}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between shrink-0 pt-2 border-t border-border/40">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isResolving !== null}
                onClick={() => setIsReviewOpen(false)}
              >
                Close
              </Button>
              {mergeEvaluation.canMerge && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowMergedPreview(!showMergedPreview)}
                >
                  {showMergedPreview ? 'View side-by-side comparison' : 'Preview merged result'}
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isResolving !== null || isStale}
                onClick={handleMerge}
              >
                {isResolving === 'merge' ? 'Merging both versions...' : 'Merge both versions'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isResolving !== null || isStale}
                onClick={handleUseRemote}
              >
                {isResolving === 'remote' ? 'Using other version...' : 'Use other version'}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isResolving !== null || isStale}
                onClick={handleKeepMine}
              >
                {isResolving === 'keep' ? 'Keeping my version...' : 'Keep my version'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
