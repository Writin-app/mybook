import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'

import { Button } from '../../components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { EngineRegistry } from './engineRegistry'
import { createWritingInsightsEngine, WRITING_INSIGHTS_CAPABILITIES } from './insightsEngine'
import { AssistantOrchestrator } from './orchestrator'
import type { EngineContext } from './contracts'
import type { TextMatch, WritingAnalysis } from './types'
import { buildProseMirrorTextMap, mapDocumentRangeToText, mapTextRangeToDocument } from './proseMirrorTextMap'
import type { ProofreadFinding, ProofreadWorkerRequest, ProofreadWorkerResponse } from './proofreadingTypes'
import {
  getEngineLanguageTag,
  getWritingLanguageProfile,
  normalizeDocumentWritingLanguagePreference,
  WRITING_LANGUAGE_PROFILES,
} from './languages'

interface AnalysisWorkerResponse {
  requestId: number
  analysis?: WritingAnalysis
}

interface AnalysisSnapshot {
  fileId: string
  editor: Editor
  document: Editor['state']['doc']
  sourceText: string
  analysis: WritingAnalysis
}

type AnalysisStatus = 'idle' | 'unresolved' | 'analyzing' | 'ready' | 'unsupported' | 'error' | 'stale'
const SUGGESTIONS_PER_PAGE = 50
const languageCapabilityRegistry = new EngineRegistry([{
  id: 'writin.writing-insights',
  capabilities: WRITING_INSIGHTS_CAPABILITIES,
}])

export interface WritingAssistantPanelHandle {
  open: () => void
}

interface WritingAssistantPanelProps {
  editor: Editor
  fileId: string
  isMobile: boolean
  writingLanguage?: string
  onWritingLanguageChange: (preferenceId: string) => Promise<void>
}

function SuggestionSection({
  title,
  matches,
  onSelect,
}: {
  title: string
  matches: readonly TextMatch[]
  onSelect: (match: TextMatch) => void
}) {
  const [visibleCount, setVisibleCount] = useState(SUGGESTIONS_PER_PAGE)

  useEffect(() => {
    setVisibleCount(SUGGESTIONS_PER_PAGE)
  }, [matches])

  if (matches.length === 0) return null

  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="space-y-2">
        {matches.slice(0, visibleCount).map((match, index) => (
          <li
            key={`${match.start}:${match.end}:${index}`}
            data-start={match.start}
            data-end={match.end}
            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] text-sm text-foreground"
          >
            <button
              type="button"
              aria-label={`Navigate to suggestion: ${match.text}`}
              onClick={() => onSelect(match)}
              className="w-full rounded-lg px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="whitespace-pre-wrap break-words">{match.text}</span>
              <span className="sr-only">, characters {match.start} to {match.end}</span>
            </button>
          </li>
        ))}
      </ul>
      {matches.length > visibleCount ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setVisibleCount((count) => Math.min(count + SUGGESTIONS_PER_PAGE, matches.length))}>
          Show {Math.min(SUGGESTIONS_PER_PAGE, matches.length - visibleCount)} more suggestions
        </Button>
      ) : null}
    </section>
  )
}

const WritingAssistantPanelComponent = forwardRef<WritingAssistantPanelHandle, WritingAssistantPanelProps>(
  function WritingAssistantPanel({ editor, fileId, isMobile, writingLanguage, onWritingLanguageChange }, ref) {
    const [isOpen, setIsOpen] = useState(false)
    const [activeView, setActiveView] = useState<'overview' | 'actions'>('overview')
    const [status, setStatus] = useState<AnalysisStatus>('idle')
    const [navigationMessage, setNavigationMessage] = useState<string | null>(null)
    const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null)
    const [languageOverride, setLanguageOverride] = useState<string | undefined>(undefined)
    const [languageSaveError, setLanguageSaveError] = useState<string | null>(null)
    const requestIdRef = useRef(0)
    const workerRef = useRef<Worker | null>(null)
    const pendingRejectRef = useRef<((error: Error) => void) | null>(null)
    const latestFileIdRef = useRef(fileId)
    const latestEditorRef = useRef(editor)
    latestFileIdRef.current = fileId
    latestEditorRef.current = editor
    const effectiveLanguageValue = languageOverride ?? writingLanguage
    const languagePreference = normalizeDocumentWritingLanguagePreference(effectiveLanguageValue)
    const selectedLanguageId = languagePreference.mode === 'manual' ? languagePreference.profileId : 'automatic'
    const selectedProfile = languagePreference.mode === 'manual'
      ? getWritingLanguageProfile(languagePreference.profileId)
      : undefined

    const cancelPendingAnalysis = useCallback(() => {
      requestIdRef.current += 1
      workerRef.current?.terminate()
      workerRef.current = null
      const rejectPending = pendingRejectRef.current
      pendingRejectRef.current = null
      rejectPending?.(new Error('Analysis request was cancelled.'))
    }, [])

    const analyzeCurrentDocument = useCallback(async () => {
      cancelPendingAnalysis()
      const requestId = requestIdRef.current
      const sourceFileId = fileId
      const sourceEditor = editor
      setSnapshot(null)
      setNavigationMessage(null)

      const preference = normalizeDocumentWritingLanguagePreference(languageOverride ?? writingLanguage)
      if (preference.mode === 'automatic') {
        setStatus('unresolved')
        return
      }
      const languageTag = getEngineLanguageTag(preference)
      if (languageCapabilityRegistry.find('insights', languageTag).status !== 'supported') {
        setStatus('unsupported')
        return
      }
      setStatus('analyzing')

      try {
        if (sourceEditor.isDestroyed) throw new Error('The editor is unavailable.')
        const sourceDocument = sourceEditor.state.doc
        const text = sourceEditor.getText()
        const context: EngineContext = {
          requestId,
          documentId: sourceFileId,
          snapshotId: `${sourceFileId}:${requestId}`,
          languageTag,
          text,
        }

        const isCurrent = () =>
          requestId === requestIdRef.current &&
          sourceFileId === latestFileIdRef.current &&
          sourceEditor === latestEditorRef.current &&
          !sourceEditor.isDestroyed &&
          sourceEditor.state.doc === sourceDocument

        const runInWorker = (workerRequestId: number, workerText: string) => new Promise<WritingAnalysis>((resolve, reject) => {
          let worker: Worker
          try {
            worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
          } catch (error) {
            reject(error instanceof Error ? error : new Error('Could not start the analysis Worker.'))
            return
          }
          workerRef.current = worker
          let settled = false
          const finish = (error?: Error, analysis?: WritingAnalysis) => {
            if (settled) return
            settled = true
            if (workerRef.current === worker) workerRef.current = null
            if (pendingRejectRef.current === rejectPending) pendingRejectRef.current = null
            worker.terminate()
            if (error) reject(error)
            else if (analysis) resolve(analysis)
            else reject(new Error('The analysis Worker returned no result.'))
          }
          const rejectPending = (error: Error) => finish(error)
          pendingRejectRef.current = rejectPending

          worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
            const response = event.data
            if (response.requestId !== workerRequestId) {
              finish(new Error('The analysis Worker returned a mismatched request ID.'))
              return
            }
            if (!isCurrent() || workerRef.current !== worker) {
              if (requestId === requestIdRef.current) setStatus('stale')
              finish(new Error('The document changed during analysis.'))
              return
            }
            if (!response.analysis) {
              finish(new Error('The analysis Worker returned no result.'))
              return
            }
            finish(undefined, response.analysis)
          }
          worker.onerror = (event) => finish(new Error(event?.message || 'The analysis Worker failed.'))
          worker.onmessageerror = () => finish(new Error('The analysis Worker returned an unreadable response.'))
          try {
            worker.postMessage({ requestId: workerRequestId, text: workerText })
          } catch (error) {
            finish(error instanceof Error ? error : new Error('Could not send text to the analysis Worker.'))
          }
        })

        const engine = createWritingInsightsEngine(runInWorker)
        const orchestrator = new AssistantOrchestrator(new EngineRegistry([engine]))
        const outcome = await orchestrator.analyze({ capability: 'insights', context, isCurrent })
        if (requestId !== requestIdRef.current) return
        if (outcome.status === 'completed') {
          setSnapshot({
            fileId: outcome.documentId,
            editor: sourceEditor,
            document: sourceDocument,
            sourceText: text,
            analysis: outcome.result.data,
          })
          setStatus('ready')
        } else if (outcome.status === 'stale') {
          setSnapshot(null)
          setStatus('stale')
        } else if (outcome.status === 'unsupported') {
          setStatus('unsupported')
        } else {
          setStatus('error')
        }
      } catch {
        if (requestId !== requestIdRef.current) return
        setStatus('error')
      }
    }, [cancelPendingAnalysis, editor, fileId, languageOverride, writingLanguage])

    const open = useCallback(() => {
      setIsOpen(true)
      setActiveView('overview')
      setNavigationMessage(null)
      analyzeCurrentDocument()
    }, [analyzeCurrentDocument])

    useImperativeHandle(ref, () => ({ open }), [open])

    useEffect(() => {
      cancelPendingAnalysis()
      setIsOpen(false)
      setSnapshot(null)
      setStatus('idle')
      setLanguageOverride(undefined)
      setLanguageSaveError(null)
      return cancelPendingAnalysis
    }, [cancelPendingAnalysis, editor, fileId])

    useEffect(() => {
      if (languageOverride !== undefined && languageOverride === writingLanguage) {
        setLanguageOverride(undefined)
        return
      }
      cancelPendingAnalysis()
      setSnapshot(null)
      setStatus('idle')
      setLanguageOverride(undefined)
      setLanguageSaveError(null)
    // A persisted language change invalidates an analysis snapshot. An echoed override is already handled above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [writingLanguage])

    const handleLanguageChange = useCallback(async (value: string) => {
      const normalized = normalizeDocumentWritingLanguagePreference(value)
      const preferenceId = normalized.mode === 'manual' ? normalized.profileId : 'automatic'
      cancelPendingAnalysis()
      setSnapshot(null)
      setNavigationMessage(null)
      setLanguageSaveError(null)
      setLanguageOverride(preferenceId)
      setStatus(normalized.mode === 'automatic'
        ? 'unresolved'
        : languageCapabilityRegistry.find('insights', getEngineLanguageTag(normalized)).status === 'supported'
          ? 'idle'
          : 'unsupported')
      try {
        await onWritingLanguageChange(preferenceId)
      } catch {
        setLanguageOverride(undefined)
        setStatus(writingLanguage
          ? languageCapabilityRegistry.find('insights', getEngineLanguageTag(normalizeDocumentWritingLanguagePreference(writingLanguage))).status === 'supported'
            ? 'idle'
            : normalizeDocumentWritingLanguagePreference(writingLanguage).mode === 'automatic' ? 'unresolved' : 'unsupported'
          : 'unresolved')
        setLanguageSaveError('Could not save the document writing language. Try again.')
      }
    }, [cancelPendingAnalysis, onWritingLanguageChange, writingLanguage])

    const closePanel = useCallback(() => {
      setIsOpen(false)
      setActiveView('overview')
      cancelPendingAnalysis()
      setSnapshot(null)
      setStatus('idle')
      setNavigationMessage(null)
    }, [cancelPendingAnalysis])

    const handleOpenChange = (openState: boolean) => {
      if (openState) setIsOpen(true)
      else closePanel()
    }

    const navigateToSuggestion = useCallback((match: TextMatch) => {
      setNavigationMessage(null)
      if (
        !snapshot ||
        snapshot.fileId !== fileId ||
        snapshot.editor !== editor ||
        editor.isDestroyed ||
        editor.state.doc !== snapshot.document
      ) {
        setSnapshot(null)
        setStatus('stale')
        setNavigationMessage('Document changed. Refresh Writing Assistant before navigating.')
        return
      }

      const belongsToSnapshot =
        snapshot.analysis.repeatedWords.includes(match) ||
        snapshot.analysis.repeatedPhrases.includes(match) ||
        snapshot.analysis.fillerWords.includes(match) ||
        snapshot.analysis.insights.some((insight) => insight.type === 'long-sentence' && insight === match)
      if (
        !belongsToSnapshot ||
        !Number.isInteger(match.start) ||
        !Number.isInteger(match.end) ||
        match.start < 0 ||
        match.end <= match.start ||
        snapshot.sourceText.slice(match.start, match.end) !== match.text
      ) {
        setNavigationMessage('This suggestion could not be mapped safely. No text was selected.')
        return
      }

      let textMap: ReturnType<typeof buildProseMirrorTextMap>
      try {
        textMap = buildProseMirrorTextMap(snapshot.document)
      } catch {
        setNavigationMessage('This suggestion could not be mapped safely. No text was selected.')
        return
      }
      if (textMap.text !== snapshot.sourceText) {
        setNavigationMessage('This suggestion could not be mapped safely. No text was selected.')
        return
      }

      const range = mapTextRangeToDocument(textMap, match.start, match.end)
      if (!range || editor.state.doc !== snapshot.document) {
        setNavigationMessage('This suggestion could not be mapped safely. No text was selected.')
        return
      }

      try {
        const selection = TextSelection.create(snapshot.document, range.from, range.to)
        if (!selection.$from.parent.inlineContent || !selection.$to.parent.inlineContent) {
          setNavigationMessage('This suggestion could not be mapped safely. No text was selected.')
          return
        }
        editor.view.dispatch(
          editor.state.tr
            .setSelection(selection)
            .setMeta('addToHistory', false)
            .scrollIntoView(),
        )
        closePanel()
        const focusEditor = () => {
          if (
            !editor.isDestroyed &&
            latestEditorRef.current === editor &&
            latestFileIdRef.current === snapshot.fileId
          ) editor.view.focus()
        }
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusEditor)
        else focusEditor()
      } catch {
        setNavigationMessage('This suggestion could not be mapped safely. No text was selected.')
      }
    }, [closePanel, editor, fileId, snapshot])

    const analysis = snapshot?.fileId === fileId && snapshot.editor === editor
      ? snapshot.analysis
      : null
    const longSentences = analysis?.insights.filter((insight) => insight.type === 'long-sentence') ?? []
    const suggestionCount = analysis
      ? analysis.repeatedWords.length + analysis.repeatedPhrases.length + analysis.fillerWords.length + longSentences.length
      : 0

    return (
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={isMobile
            ? 'gap-0 overflow-hidden rounded-t-2xl border-[var(--app-border)] bg-[var(--app-surface)] p-0 data-[side=bottom]:max-h-[85dvh]'
            : 'gap-0 overflow-hidden border-l border-[var(--app-border)] bg-[var(--app-surface)] p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[28rem]'}
        >
          <Tabs
            value={activeView}
            onValueChange={(value) => setActiveView(value as 'overview' | 'actions')}
            className="flex min-h-0 flex-1 flex-col"
          >
            <SheetHeader className="shrink-0 border-b border-[var(--app-border)] px-5 pb-4 pt-5 pr-14">
              <SheetTitle>Writing Assistant</SheetTitle>
              <SheetDescription>
                Review this document or explore available writing tools. Your text changes only when you edit it in the document.
              </SheetDescription>
              <TabsList aria-label="Writing Assistant views" className="mt-3 grid w-full grid-cols-2">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>
            </SheetHeader>

            <TabsContent value="overview" className="min-h-0 flex-1 overflow-hidden outline-none">
              <div className="min-h-0 h-full space-y-6 overflow-y-auto overscroll-contain px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
                <section aria-label="Document writing language" className="space-y-2">
                  <label htmlFor="writing-insights-language" className="block text-sm font-medium text-foreground">Document writing language</label>
                  <select
                    id="writing-insights-language"
                    aria-label="Document writing language"
                    className="min-h-10 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm text-foreground"
                    value={selectedLanguageId}
                    onChange={(event) => { void handleLanguageChange(event.currentTarget.value) }}
                  >
                    <option value="automatic">Automatic</option>
                    {WRITING_LANGUAGE_PROFILES.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.displayName}</option>
                    ))}
                  </select>
                  <p className="text-xs font-medium text-muted-foreground">
                    {languagePreference.mode === 'automatic' ? 'Automatic' : 'Manual'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {languagePreference.mode === 'automatic'
                      ? 'Automatic detection is not available yet. Choose a writing language manually.'
                      : selectedProfile && languageCapabilityRegistry.find('insights', getEngineLanguageTag(languagePreference)).status === 'supported'
                        ? `${selectedProfile.displayName} is selected. Refresh to run English-oriented analysis.`
                        : `${selectedProfile?.displayName ?? 'This language'} analysis is not available yet. English-oriented results will not be shown.`}
                  </p>
                  {languageSaveError ? <p role="alert" className="text-sm text-destructive">{languageSaveError}</p> : null}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <p className="text-xs text-muted-foreground">Refresh after editing to update this snapshot.</p>
                    <Button type="button" variant="outline" size="sm" onClick={analyzeCurrentDocument} disabled={status === 'analyzing'}>
                      {status === 'analyzing' ? 'Analyzing…' : 'Refresh'}
                    </Button>
                  </div>
                </section>

                <div className="space-y-6">
                  {status === 'analyzing' ? (
                    <p role="status" className="text-sm text-muted-foreground">Analyzing this document…</p>
                  ) : null}
                  {status === 'unresolved' ? (
                    <p role="status" className="text-sm text-muted-foreground">Automatic detection is not available yet. Choose a writing language manually.</p>
                  ) : null}
                  {status === 'error' ? (
                    <p role="alert" className="text-sm text-destructive">Analysis could not be completed. Try refreshing.</p>
                  ) : null}
                  {status === 'unsupported' ? (
                    <p role="status" className="text-sm text-muted-foreground">{selectedProfile?.displayName ?? 'This language'} analysis is not available yet. English-oriented results will not be shown.</p>
                  ) : null}
                  {status === 'stale' && !navigationMessage ? (
                    <p role="status" className="text-sm text-muted-foreground">Document changed. Refresh Writing Assistant before navigating.</p>
                  ) : null}
                  {navigationMessage ? (
                    <p role="status" className="text-sm text-muted-foreground">{navigationMessage}</p>
                  ) : null}

                  {analysis ? (
                    <>
                      <section aria-labelledby="writing-insights-statistics" className="space-y-3">
                        <h2 id="writing-insights-statistics" className="text-base font-semibold text-foreground">Statistics</h2>
                        <dl className="grid grid-cols-2 gap-2">
                          <Statistic label="Words" value={analysis.stats.wordCount} />
                          <Statistic label="Characters" value={analysis.stats.characterCount} />
                          <Statistic label="Sentences" value={analysis.stats.sentenceCount} />
                          <Statistic label="Paragraphs" value={analysis.stats.paragraphCount} />
                          <Statistic label="Average words per sentence" value={analysis.stats.averageWordsPerSentence.toFixed(1)} />
                        </dl>
                      </section>

                      {analysis.stats.wordCount === 0 ? (
                        <p className="rounded-lg bg-[var(--app-subtle)] p-3 text-sm text-muted-foreground">
                          Start writing to see statistics and suggestions.
                        </p>
                      ) : suggestionCount === 0 ? (
                        <p className="rounded-lg bg-[var(--app-subtle)] p-3 text-sm text-muted-foreground">
                          No writing suggestions were found in this snapshot.
                        </p>
                      ) : null}

                      {analysis.insights.some((insight) => insight.type === 'excessive-filler') ? (
                        <p className="rounded-lg border border-[var(--app-border)] bg-[var(--app-subtle)] p-3 text-sm text-foreground">
                          This snapshot contains several optional filler words or phrases.
                        </p>
                      ) : null}

                      <div className="space-y-5">
                        <SuggestionSection title="Repeated words" matches={analysis.repeatedWords} onSelect={navigateToSuggestion} />
                        <SuggestionSection title="Repeated phrases" matches={analysis.repeatedPhrases} onSelect={navigateToSuggestion} />
                        <SuggestionSection title="Filler words and phrases" matches={analysis.fillerWords} onSelect={navigateToSuggestion} />
                        <SuggestionSection title="Long sentences" matches={longSentences} onSelect={navigateToSuggestion} />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="actions" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 outline-none">
              <WritingAssistantActions
                editor={editor}
                fileId={fileId}
                languageId={selectedLanguageId}
                isActive={isOpen && activeView === 'actions'}
              />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    )
  },
)

export const WritingAssistantPanel = memo(WritingAssistantPanelComponent)

function Statistic({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-[var(--app-subtle)] px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

type ProofreadStatus = 'idle' | 'loading' | 'ready' | 'stale' | 'unsupported' | 'error'

function WritingAssistantActions({
  editor,
  fileId,
  languageId,
  isActive,
}: {
  editor: Editor
  fileId: string
  languageId: string
  isActive: boolean
}) {
  const [scopeChoice, setScopeChoice] = useState<'selected' | 'document'>('selected')
  const [proofreadStatus, setProofreadStatus] = useState<ProofreadStatus>('idle')
  const [message, setMessage] = useState('')
  const [findings, setFindings] = useState<ProofreadFinding[]>([])
  const [suggestionsByFinding, setSuggestionsByFinding] = useState<Record<string, string[]>>({})
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null)
  const [scopeLabel, setScopeLabel] = useState('')
  const [timings, setTimings] = useState<{ initMs: number; analysisMs: number } | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const sessionRef = useRef<string | null>(null)
  const snapshotRef = useRef<{
    sessionId: string
    fileId: string
    editor: Editor
    document: Editor['state']['doc']
    text: string
    sourceStart: number
    selectionRange: { from: number; to: number } | null
    languageId: string
    scopeChoice: 'selected' | 'document'
    map: ReturnType<typeof buildProseMirrorTextMap>
  } | null>(null)
  const latestFileIdRef = useRef(fileId)
  const latestEditorRef = useRef(editor)
  latestFileIdRef.current = fileId
  latestEditorRef.current = editor
  const supported = languageId === 'en-IN' || languageId === 'en-GB' || languageId === 'en-US'

  const stop = useCallback((nextStatus: ProofreadStatus = 'idle', nextMessage = '') => {
    requestIdRef.current += 1
    const worker = workerRef.current
    const sessionId = sessionRef.current
    if (worker && sessionId) {
      try { worker.postMessage({ type: 'dispose', sessionId } satisfies ProofreadWorkerRequest) } catch { /* termination still releases the Worker */ }
    }
    worker?.terminate()
    workerRef.current = null
    sessionRef.current = null
    snapshotRef.current = null
    setFindings([])
    setSuggestionsByFinding({})
    setActiveFindingId(null)
    setTimings(null)
    setProofreadStatus(nextStatus)
    setMessage(nextMessage)
  }, [])

  useEffect(() => {
    if (!isActive) stop()
    return () => stop()
  }, [isActive, stop])

  useEffect(() => {
    if (!supported) stop('unsupported', 'Proofread supports English (India), English (UK), and English (US) only. Select an English document language to use it.')
    else if (proofreadStatus === 'unsupported') stop()
  }, [languageId, proofreadStatus, stop, supported])

  useEffect(() => {
    const current = snapshotRef.current
    if (current && (current.fileId !== fileId || current.editor !== editor || current.languageId !== languageId)) {
      stop('stale', 'The document or language changed. Run Proofread again for a fresh snapshot.')
    }
  }, [editor, fileId, languageId, stop])

  useEffect(() => {
    const invalidateDocument = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (!transaction.docChanged) return
      if (!snapshotRef.current) return
      stop('stale', 'The document or selection changed. Run Proofread again for a fresh snapshot.')
    }
    const invalidateSelection = () => {
      if (snapshotRef.current?.scopeChoice !== 'selected') return
      stop('stale', 'The document or selection changed. Run Proofread again for a fresh snapshot.')
    }
    editor.on('transaction', invalidateDocument)
    editor.on('selectionUpdate', invalidateSelection)
    return () => {
      editor.off('transaction', invalidateDocument)
      editor.off('selectionUpdate', invalidateSelection)
    }
  }, [editor, stop])

  const run = useCallback(() => {
    stop()
    if (!supported) {
      setProofreadStatus('unsupported')
      setMessage('Proofread supports English (India), English (UK), and English (US) only.')
      return
    }
    if (editor.isDestroyed) {
      setProofreadStatus('error')
      setMessage('The editor is unavailable.')
      return
    }
    const sourceDocument = editor.state.doc
    const map = buildProseMirrorTextMap(sourceDocument)
    let start = 0
    let end = map.text.length
    let selectionRange: { from: number; to: number } | null = null
    if (scopeChoice === 'selected') {
      selectionRange = { from: editor.state.selection.from, to: editor.state.selection.to }
      const selection = mapDocumentRangeToText(map, selectionRange.from, selectionRange.to)
      if (!selection || selection.end <= selection.start || !map.text.slice(selection.start, selection.end).trim()) {
        setProofreadStatus('error')
        setMessage('Select text in a regular text block before running Proofread, or choose Entire document.')
        return
      }
      start = selection.start
      end = selection.end
    }
    const text = map.text.slice(start, end)
    const sessionId = crypto.randomUUID()
    const requestId = ++requestIdRef.current
    snapshotRef.current = { sessionId, fileId, editor, document: sourceDocument, text, sourceStart: start, selectionRange, languageId, scopeChoice, map }
    setScopeLabel(scopeChoice === 'selected' ? `Selected text · ${text.length.toLocaleString()} characters` : `Entire document · ${text.length.toLocaleString()} characters`)
    setFindings([])
    setSuggestionsByFinding({})
    setActiveFindingId(null)
    setTimings(null)
    setMessage('Starting the local Proofread engine…')
    setProofreadStatus('loading')
    let worker: Worker
    try {
      worker = new Worker(new URL('./proofreading.worker.ts', import.meta.url), { type: 'module', name: 'writin-proofread' })
    } catch {
      snapshotRef.current = null
      setProofreadStatus('error')
      setMessage('Could not start Proofread. Try again in a supported browser.')
      return
    }
    workerRef.current = worker
    sessionRef.current = sessionId
    let initMs = 0
    worker.onmessage = (event: MessageEvent<ProofreadWorkerResponse>) => {
      const response = event.data
      if (response.sessionId !== sessionRef.current || response.sessionId !== sessionId) return
      if (response.requestId !== requestIdRef.current) return
      const current = snapshotRef.current
      if (!current || current.fileId !== latestFileIdRef.current || current.editor !== latestEditorRef.current || current.editor.isDestroyed || current.editor.state.doc !== current.document || current.languageId !== languageId) {
        stop('stale', 'The document changed during Proofread. Run it again.')
        return
      }
      if (response.type === 'ready') {
        initMs = response.initMs
        setTimings({ initMs, analysisMs: 0 })
        setMessage('Checking spelling, grammar, and punctuation…')
      } else if (response.type === 'findings') {
        setFindings(response.findings)
        setTimings({ initMs, analysisMs: response.analysisMs })
        setMessage(response.findings.length ? '' : 'No proofreading suggestions were found.')
        setProofreadStatus('ready')
      } else if (response.type === 'error') {
        stop('error', response.message || 'Proofread could not complete. Try again.')
      } else if (response.type === 'suggestions') {
        setSuggestionsByFinding((currentSuggestions) => ({ ...currentSuggestions, [response.findingId]: response.suggestions }))
        setMessage(response.suggestions.length ? '' : 'Harper has no replacement suggestions for this finding.')
      }
    }
    worker.onerror = () => stop('error', 'The Proofread Worker stopped unexpectedly. Run Proofread again.')
    worker.onmessageerror = () => stop('error', 'The Proofread Worker returned an unreadable result. Run Proofread again.')
    const dialect = languageId as 'en-IN' | 'en-GB' | 'en-US'
    try {
      worker.postMessage({ type: 'analyze', requestId, sessionId, dialect, text } satisfies ProofreadWorkerRequest)
    } catch {
      stop('error', 'Could not send the selected text to Proofread. Try again.')
    }
  }, [editor, fileId, languageId, scopeChoice, stop, supported])

  const openFinding = (finding: ProofreadFinding) => {
    setActiveFindingId(finding.id)
    if (suggestionsByFinding[finding.id] !== undefined) return
    const worker = workerRef.current
    const sessionId = sessionRef.current
    if (!worker || !sessionId) return
    const requestId = ++requestIdRef.current
    try {
      worker.postMessage({ type: 'suggest', requestId, sessionId, findingId: finding.id } satisfies ProofreadWorkerRequest)
    } catch {
      stop('error', 'Could not request suggestions. Run Proofread again.')
    }
  }

  const accept = (finding: ProofreadFinding, replacement: string) => {
    const current = snapshotRef.current
    if (!current || current.fileId !== fileId || current.editor !== editor || current.document !== editor.state.doc || current.fileId !== latestFileIdRef.current || current.editor !== latestEditorRef.current || current.languageId !== languageId || current.text.slice(finding.start, finding.end) !== finding.text) {
      stop('stale', 'The document changed. Run Proofread again before accepting a correction.')
      return
    }
    const range = mapTextRangeToDocument(current.map, current.sourceStart + finding.start, current.sourceStart + finding.end)
    if (!range || editor.state.doc.textBetween(range.from, range.to) !== finding.text) {
      setMessage('This finding crosses a document boundary and cannot be corrected directly. You can ignore it.')
      return
    }
    try {
      const applied = replacement
        ? editor.chain().focus().insertContentAt({ from: range.from, to: range.to }, replacement).run()
        : editor.chain().focus().deleteRange(range).run()
      if (!applied) throw new Error('Correction was not applied.')
      stop('stale', 'Correction applied. Run Proofread again to review the updated document.')
    } catch {
      setMessage('Could not apply this correction. The document was left unchanged.')
    }
  }

  const categories: Array<{ key: ProofreadFinding['category']; label: string }> = [
    { key: 'spelling', label: 'Spelling' }, { key: 'grammar', label: 'Grammar' },
    { key: 'punctuation', label: 'Punctuation' }, { key: 'style', label: 'Style' },
  ]

  return (
    <section aria-labelledby="writing-assistant-actions-title" className="space-y-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-subtle)] p-4">
      <div>
        <h2 id="writing-assistant-actions-title" className="text-base font-semibold text-foreground">Proofread</h2>
        <p className="mt-1 text-sm text-muted-foreground">Local spelling and writing checks for supported English dialects. Your text is not sent to a service.</p>
      </div>
      {!supported ? <p role="status" className="rounded-lg border border-[var(--app-border)] p-3 text-sm text-muted-foreground">Proofread is unavailable for this language. Choose English (India), English (UK), or English (US) in the language setting. Writin will not apply English rules to this document.</p> : (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Text to check</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="proofread-scope" value="selected" checked={scopeChoice === 'selected'} onChange={() => setScopeChoice('selected')} />Selected text</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="proofread-scope" value="document" checked={scopeChoice === 'document'} onChange={() => setScopeChoice('document')} />Entire document</label>
          </fieldset>
          <Button type="button" onClick={run} disabled={!isActive || proofreadStatus === 'loading'}>{proofreadStatus === 'loading' ? 'Proofreading…' : 'Run Proofread'}</Button>
          {proofreadStatus === 'loading' ? <Button type="button" variant="ghost" onClick={() => stop('idle', 'Proofread cancelled.')}>Cancel</Button> : null}
          {scopeLabel ? <p className="text-xs text-muted-foreground">{scopeLabel}</p> : null}
          {message ? <p role="status" className="rounded-lg border border-[var(--app-border)] p-3 text-sm text-muted-foreground">{message}</p> : null}
          {timings ? <p className="text-xs text-muted-foreground">Engine setup {Math.round(timings.initMs)} ms · analysis {Math.round(timings.analysisMs)} ms</p> : null}
          {findings.length ? <div className="space-y-4">{categories.map(({ key, label }) => {
            const categoryFindings = findings.filter((finding) => finding.category === key)
            if (!categoryFindings.length) return null
            return <section key={key} aria-label={label} className="space-y-2"><h3 className="text-sm font-semibold text-foreground">{label} ({categoryFindings.length})</h3><ul className="space-y-2">{categoryFindings.map((finding) => {
              const opened = activeFindingId === finding.id
              const options = suggestionsByFinding[finding.id]
              return <li key={`${finding.id}:${finding.start}`} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-sm"><button type="button" className="w-full text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={opened} onClick={() => openFinding(finding)}><span className="break-words">{finding.text}</span><span className="sr-only">, characters {finding.start} to {finding.end}</span></button><p className="mt-1 text-muted-foreground">{finding.message}</p>{opened ? <div className="mt-3 space-y-2"><p className="text-xs text-muted-foreground">Source range: {finding.start}–{finding.end}</p>{options === undefined ? <p role="status" className="text-xs text-muted-foreground">Getting suggestions…</p> : options.map((replacement, index) => <div key={`${replacement}:${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded bg-[var(--app-subtle)] p-2"><span className="break-words">{replacement || '(delete text)'}</span><Button type="button" size="sm" onClick={() => accept(finding, replacement)}>Accept</Button></div>)}<Button type="button" size="sm" variant="ghost" onClick={() => setActiveFindingId(null)}>Ignore</Button></div> : null}</li>
            })}</ul></section>
          })}</div> : null}
        </>
      )}
    </section>
  )
}
