import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'

import { Button } from '../../components/ui/button'
import type {
  GenerationContext,
  GenerativeActionId,
  TransformationEngine,
} from './contracts'
import { EngineRegistry } from './engineRegistry'
import { prepareContentForInsertion } from './generativeInsertion'
import { createHttpTransformationEngine } from './httpTransformationEngine'
import { getSharedBergamotEngine } from './bergamotEngine'
import { detectTextScript } from './translationCapabilityRegistry'
import {
  ContextWindowExceededError,
  getSharedLocalLlamaEngine,
  hasPersistedLocalConsent,
  LocalLlamaTransformationEngine,
  LocalModelRefusalError,
  persistLocalConsent,
  type LocalEngineStatusReport,
} from './localLlamaEngine'
import { AssistantOrchestrator } from './orchestrator'
import { validateAndCleanGenerativeOutput } from './outputValidation'
import {
  assertProviderIsolation,
  GENERATION_PROVIDER_PROFILES,
  getAiRoutingDiagnostics,
  getEffectiveEndpoint,
  getGenerationProviderProfile,
  getPreferredAiProvider,
  logAiRoutingDiagnostic,
  setPreferredAiProvider,
  subscribePreferredAiProvider,
} from './providerProfiles'
import { ProviderConfigCard } from './ProviderConfigCard'
import { GenerativeResultPreview } from './GenerativeResultPreview'
import { sessionCredentialStore, type SessionCredentialStore } from './sessionCredentialStore'

export interface GenerativeActionsSectionProps {
  editor: Editor
  fileId: string
  languageId: string
  credentialStore?: SessionCredentialStore
  customEngine?: TransformationEngine
  localEngine?: LocalLlamaTransformationEngine
  initialProviderId?: string
  initialActionId?: GenerativeActionId
}

interface ActionMeta {
  id: GenerativeActionId
  label: string
  description: string
}

const GENERATIVE_ACTIONS: readonly ActionMeta[] = [
  { id: 'correct', label: 'Correct', description: 'Fix grammar, spelling, punctuation, and phrasing with minimal edits.' },
  { id: 'improve-writing', label: 'Improve Writing', description: 'General rewrite: enhance clarity, grammar, and flow while preserving meaning.' },
  { id: 'summarize', label: 'Summarize', description: 'Produce a concise or balanced summary of key points.' },
  { id: 'translate', label: 'Translate', description: 'Translate text into an explicitly chosen target language.' },
  { id: 'shorten', label: 'Shorten', description: 'Tighten phrasing and remove redundancy without altering facts.' },
  { id: 'expand', label: 'Expand', description: 'Elaborate on ideas with greater depth without inventing facts.' },
  { id: 'change-tone', label: 'Change Tone', description: 'Rewrite in a specific tone (professional, friendly, casual, etc.).' },
  { id: 'continue-writing', label: 'Continue Writing', description: 'Generate natural continuation following your text or cursor.' },
  { id: 'ask-ai', label: 'Ask AI', description: 'Ask questions or request specific changes with custom instructions.' },
]

const TONE_OPTIONS = [
  'professional',
  'friendly',
  'formal',
  'casual',
  'confident',
  'empathetic',
] as const

const TARGET_LANGUAGES = [
  { id: 'Hindi', label: 'Hindi (Devanagari)' },
  { id: 'English', label: 'English' },
  { id: 'Spanish', label: 'Spanish' },
  { id: 'French', label: 'French' },
  { id: 'German', label: 'German' },
  { id: 'Portuguese', label: 'Portuguese' },
  { id: 'Italian', label: 'Italian' },
  { id: 'Japanese', label: 'Japanese' },
  { id: 'Chinese', label: 'Chinese' },
  { id: 'Russian', label: 'Russian' },
  { id: 'Arabic', label: 'Arabic' },
] as const

interface CapturedSnapshot {
  requestId: number
  fileId: string
  editor: Editor
  doc: Editor['state']['doc']
  sourceText: string
  scope: 'selected' | 'document'
  range?: { from: number; to: number }
  actionId: GenerativeActionId
  languageTag: string
}

interface PendingExecution {
  actionId: GenerativeActionId
  scope: 'selected' | 'document'
  range?: { from: number; to: number }
  sourceText: string
  doc: Editor['state']['doc']
  editor: Editor
  fileId: string
  languageId: string
  customInstruction?: string
  summaryFormat?: 'paragraph' | 'bullets'
  summaryLength?: 'concise' | 'balanced' | 'detailed'
  targetLanguage?: string
  selectedTone?: string
  askAiPrompt?: string
}

export function GenerativeActionsSection({
  editor,
  fileId,
  languageId,
  credentialStore = sessionCredentialStore,
  customEngine,
  localEngine: propsLocalEngine,
  initialProviderId,
  initialActionId,
}: GenerativeActionsSectionProps) {
  const localEngine = useMemo(() => {
    return propsLocalEngine ?? getSharedLocalLlamaEngine()
  }, [propsLocalEngine])

  const [engineStatus, setEngineStatus] = useState<LocalEngineStatusReport>(() => localEngine.getStatus())
  const [hasConsent, setHasConsent] = useState<boolean>(() => localEngine.hasUserConsent() || hasPersistedLocalConsent())
  const [, setDismissedConsent] = useState(false)
  const [showConsentPrompt, setShowConsentPrompt] = useState(false)
  const [isWebGPUSupported, setIsWebGPUSupported] = useState<boolean>(true)
  const [streamingText, setStreamingText] = useState('')

  const [selectedActionId, setSelectedActionId] = useState<GenerativeActionId>(initialActionId ?? 'summarize')
  const [scopeChoice, setScopeChoice] = useState<'selected' | 'document'>('selected')
  const [activeProviderId, setActiveProviderId] = useState(() => {
    if (initialProviderId) return initialProviderId
    if (customEngine) return 'custom'
    if (propsLocalEngine) return 'local'
    return getPreferredAiProvider()
  })

  useEffect(() => {
    const unsub = subscribePreferredAiProvider((newProviderId) => {
      setActiveProviderId(newProviderId)
    })
    return unsub
  }, [])

  const handleProviderChange = useCallback((newId: string) => {
    setActiveProviderId(newId)
    setPreferredAiProvider(newId)
  }, [])
  const [showConfig, setShowConfig] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'preview-ready' | 'error' | 'stale'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Action options
  const [customInstruction, setCustomInstruction] = useState('')
  const [summaryFormat, setSummaryFormat] = useState<'paragraph' | 'bullets'>('paragraph')
  const [summaryLength, setSummaryLength] = useState<'concise' | 'balanced' | 'detailed'>('balanced')
  const [targetLanguage, setTargetLanguage] = useState('Hindi')
  const [selectedTone, setSelectedTone] = useState<string>('professional')
  const [askAiPrompt, setAskAiPrompt] = useState('')

  // Active result
  const [proposedText, setProposedText] = useState('')
  const [resultExplanation, setResultExplanation] = useState<string | undefined>(undefined)
  const [snapshot, setSnapshot] = useState<CapturedSnapshot | null>(null)
  const [editorStateVersion, setEditorStateVersion] = useState(0)

  const requestIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const pendingActionRef = useRef<PendingExecution | null>(null)
  const latestEditorRef = useRef(editor)
  const latestFileIdRef = useRef(fileId)
  latestEditorRef.current = editor
  latestFileIdRef.current = fileId

  // Probe WebGPU availability
  useEffect(() => {
    let mounted = true
    const probe = async () => {
      const avail = await localEngine.getAvailability()
      if (!mounted) return
      if (avail.reason?.includes('WebGPU is not supported')) {
        setIsWebGPUSupported(false)
      } else {
        setIsWebGPUSupported(true)
      }
    }
    void probe()
    return () => {
      mounted = false
    }
  }, [localEngine])

  // Subscribe to local engine lifecycle
  useEffect(() => {
    return localEngine.subscribeStatus((report) => {
      setEngineStatus(report)
    })
  }, [localEngine])

  // Live transaction and selection listeners for real-time stale status & selection sync
  useEffect(() => {
    if (!editor || typeof editor.on !== 'function') return

    const handleEditorChange = () => {
      setEditorStateVersion((v) => v + 1)
    }

    editor.on('transaction', handleEditorChange)
    editor.on('selectionUpdate', handleEditorChange)

    return () => {
      if (typeof editor.off === 'function') {
        editor.off('transaction', handleEditorChange)
        editor.off('selectionUpdate', handleEditorChange)
      }
    }
  }, [editor])

  // Update selection-aware scope choice on editor state or selection check
  useEffect(() => {
    const sel = editor?.state?.selection
    if (sel && !sel.empty) {
      setScopeChoice('selected')
    } else {
      setScopeChoice('document')
    }
  }, [editor, editorStateVersion])

  // Track session store updates
  const [, setStoreVersion] = useState(0)
  useEffect(() => {
    return credentialStore.subscribe(() => {
      setStoreVersion((v) => v + 1)
    })
  }, [credentialStore])

  const profile = getGenerationProviderProfile(activeProviderId) ?? GENERATION_PROVIDER_PROFILES[0]!
  const cred = credentialStore.getCredential(activeProviderId)
  const effectiveEndpoint = getEffectiveEndpoint(activeProviderId, cred?.endpointUrl)
  const isAcknowledged = credentialStore.isDisclosureAcknowledged(activeProviderId, effectiveEndpoint)
  const hasKey = credentialStore.hasCredential(activeProviderId)

  const isConfigured =
    customEngine !== undefined ||
    (activeProviderId === 'local'
      ? isWebGPUSupported
      : profile.privacy.requiresApiKey
        ? hasKey && isAcknowledged
        : isAcknowledged)

  const handleEnableLocalModel = useCallback(async () => {
    setErrorMessage(null)
    setShowConsentPrompt(false)
    setHasConsent(true)
    persistLocalConsent(true)
    localEngine.grantUserConsent()
    try {
      await localEngine.init()
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Could not initialize on-device assistant.')
    }
  }, [localEngine])

  const handleCancelInit = useCallback(async () => {
    pendingActionRef.current = null
    try {
      await localEngine.unload()
    } catch {
      // Ignore unload errors
    }
    setErrorMessage(null)
    setSuccessMessage('Download cancelled.')
  }, [localEngine])

  const handleDismissConsent = useCallback(() => {
    setShowConsentPrompt(false)
    setDismissedConsent(true)
    pendingActionRef.current = null
    setErrorMessage(null)
  }, [])

  const cancelGeneration = useCallback(() => {
    pendingActionRef.current = null
    requestIdRef.current += 1
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    localEngine.setTokenDeltaListener?.(undefined)
    setStreamingText('')
    setStatus('idle')
    setErrorMessage(null)
    setSuccessMessage('Generation cancelled.')
  }, [localEngine])

  const executeTransformation = useCallback(
    async (actionData: PendingExecution) => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const currentRequestId = ++requestIdRef.current
      const controller = new AbortController()
      abortControllerRef.current = controller

      const currentSnapshot: CapturedSnapshot = {
        requestId: currentRequestId,
        fileId: actionData.fileId,
        editor: actionData.editor,
        doc: actionData.doc,
        sourceText: actionData.sourceText,
        scope: actionData.scope,
        range: actionData.range,
        actionId: actionData.actionId,
        languageTag:
          actionData.languageId && actionData.languageId !== 'und'
            ? actionData.languageId
            : (detectTextScript(actionData.sourceText) === 'Devanagari' ? 'hi-IN' : 'en'),
      }

      setSnapshot(currentSnapshot)
      setStatus('loading')
      setStreamingText('')
      setProposedText('')
      setResultExplanation(undefined)
      setErrorMessage(null)
      setSuccessMessage(null)

      // Prepare engine and orchestrator
      let engine: TransformationEngine
      if (customEngine) {
        engine = customEngine
      } else if (activeProviderId === 'local') {
        if (!propsLocalEngine && actionData.actionId === 'translate') {
          engine = getSharedBergamotEngine()
        } else {
          if (!localEngine.hasUserConsent()) {
            setErrorMessage('User consent is required before using the on-device assistant.')
            setStatus('idle')
            return
          }

          if (localEngine.getStatus().state !== 'ready') {
            try {
              await localEngine.init()
            } catch (err) {
              setStatus('error')
              setErrorMessage(err instanceof Error ? err.message : 'Could not initialize on-device assistant.')
              return
            }
          }

          localEngine.setTokenDeltaListener?.((_delta, accumulated) => {
            setStreamingText(accumulated)
          })
          engine = localEngine
        }
      } else {
        assertProviderIsolation(activeProviderId)
        engine = createHttpTransformationEngine({
          providerId: activeProviderId,
          credentialStore,
        })
      }

      const diag = getAiRoutingDiagnostics(
        'sidebar-generative-section',
        actionData.actionId,
        activeProviderId,
        engine.id,
      )
      logAiRoutingDiagnostic(diag)
      assertProviderIsolation(activeProviderId)

      const registry = new EngineRegistry([engine])
      const orchestrator = new AssistantOrchestrator(registry)

      // Build context
      const contextOptions: Record<string, unknown> = {}
      if (actionData.actionId === 'summarize') {
        contextOptions.format = actionData.summaryFormat ?? summaryFormat
        contextOptions.length = actionData.summaryLength ?? summaryLength
      } else if (actionData.actionId === 'translate') {
        contextOptions.targetLanguage = actionData.targetLanguage ?? targetLanguage
      } else if (actionData.actionId === 'change-tone') {
        contextOptions.tone = actionData.selectedTone ?? selectedTone
      }

      const instruction =
        actionData.actionId === 'ask-ai'
          ? (actionData.askAiPrompt ?? askAiPrompt).trim()
          : (actionData.customInstruction ?? customInstruction).trim() || undefined

      const genContext: GenerationContext = {
        requestId: currentRequestId,
        documentId: actionData.fileId,
        snapshotId: `${actionData.fileId}:${currentRequestId}`,
        languageTag:
          actionData.languageId && actionData.languageId !== 'und'
            ? actionData.languageId
            : (detectTextScript(actionData.sourceText) === 'Devanagari' ? 'hi-IN' : 'en'),
        text: actionData.sourceText,
        actionId: actionData.actionId,
        scope: actionData.scope,
        range: actionData.range,
        instruction,
        options: contextOptions,
      }

      const capability = actionData.actionId === 'translate' ? 'translation' : 'rewrite'

      try {
        const result = await orchestrator.transform({
          capability,
          context: genContext,
          signal: controller.signal,
          isCurrent: () =>
            latestFileIdRef.current === actionData.fileId &&
            latestEditorRef.current === actionData.editor &&
            actionData.editor.state.doc === actionData.doc &&
            requestIdRef.current === currentRequestId,
        })

        localEngine.setTokenDeltaListener?.(undefined)
        setStreamingText('')

        if (requestIdRef.current !== currentRequestId) return

        if (result.status === 'preview-ready') {
          const validation = validateAndCleanGenerativeOutput({
            rawText: result.proposedText,
            actionId: actionData.actionId,
            sourceText: actionData.sourceText,
            targetLanguage:
              actionData.actionId === 'translate' ? (actionData.targetLanguage ?? targetLanguage) : undefined,
            languageTag:
          actionData.languageId && actionData.languageId !== 'und'
            ? actionData.languageId
            : (detectTextScript(actionData.sourceText) === 'Devanagari' ? 'hi-IN' : 'en'),
          })

          if (!validation.isValid) {
            setStatus('error')
            setErrorMessage(validation.errorMessage ?? 'Generated output was invalid. Please try again.')
            return
          }

          setProposedText(validation.cleanedText)
          setResultExplanation(result.explanation)
          setStatus('preview-ready')
        } else if (result.status === 'cancelled') {
          setStatus('idle')
          setSuccessMessage('Generation cancelled.')
        } else if (result.status === 'stale') {
          setStatus('stale')
          setErrorMessage('The document changed while generation was running. Please generate again.')
        } else if (result.status === 'unavailable') {
          setStatus('error')
          setErrorMessage(result.reason)
          if (activeProviderId !== 'local') setShowConfig(true)
        } else {
          setStatus('error')
          setErrorMessage(result.reason)
        }
      } catch (err) {
        localEngine.setTokenDeltaListener?.(undefined)
        setStreamingText('')
        if (requestIdRef.current !== currentRequestId) return
        setStatus('error')

        if (err instanceof LocalModelRefusalError) {
          setErrorMessage(
            'The on-device assistant could not process this text due to safety guidelines. Try rephrasing the text or choosing a different writing action.',
          )
        } else if (err instanceof ContextWindowExceededError) {
          setErrorMessage(
            `The selected text is too long for on-device processing (~${err.estimatedTokens} tokens). Please select a shorter section (up to ~${err.suggestedMaxWords} words).`,
          )
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'Transformation failed.')
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
      }
    },
    [
      activeProviderId,
      askAiPrompt,
      credentialStore,
      customEngine,
      customInstruction,
      localEngine,
      propsLocalEngine,
      selectedTone,
      summaryFormat,
      summaryLength,
      targetLanguage,
    ],
  )

  // Auto-execute pending action once local engine reaches 'ready' state
  useEffect(() => {
    if (engineStatus.state === 'ready' && pendingActionRef.current) {
      const pending = pendingActionRef.current
      pendingActionRef.current = null

      const isDocCurrent =
        latestFileIdRef.current === pending.fileId &&
        latestEditorRef.current === pending.editor &&
        pending.editor.state.doc === pending.doc

      if (isDocCurrent) {
        void executeTransformation(pending)
      } else {
        setStatus('stale')
        setErrorMessage('The document changed while preparing the writing assistant. Please click Run again.')
      }
    }
  }, [engineStatus.state, executeTransformation])

  const handleGenerate = useCallback(async () => {
    setErrorMessage(null)
    setSuccessMessage(null)

    const doc = editor?.state?.doc
    const selection = editor?.state?.selection
    const isSelectionScope = Boolean(scopeChoice === 'selected' && selection && !selection.empty)

    let textToTransform = ''
    let selectionRange: { from: number; to: number } | undefined = undefined

    if (isSelectionScope && doc?.textBetween && selection) {
      textToTransform = doc.textBetween(selection.from, selection.to, '\n').trim()
      selectionRange = { from: selection.from, to: selection.to }
    } else if (selectedActionId === 'continue-writing' && selection && doc?.textBetween) {
      // Capture cursor position for continuation
      selectionRange = { from: selection.from, to: selection.to }
      textToTransform = doc.textBetween(0, selection.from, '\n').trim()
      if (!textToTransform && doc.content) {
        textToTransform = doc.textBetween(0, doc.content.size, '\n').trim()
      }
    } else if (doc?.textBetween && doc?.content) {
      textToTransform = doc.textBetween(0, doc.content.size, '\n').trim()
    } else if (typeof editor.getText === 'function') {
      textToTransform = editor.getText().trim()
    }

    if (!textToTransform) {
      setErrorMessage(
        isSelectionScope
          ? 'Selected text is empty. Highlight text in the editor or select Entire document.'
          : 'Document is empty. Enter some text in the editor before generating.',
      )
      return
    }

    if (selectedActionId === 'ask-ai' && !askAiPrompt.trim()) {
      setErrorMessage('Please enter a question or instruction for Ask AI.')
      return
    }

    const payload: PendingExecution = {
      actionId: selectedActionId,
      scope: scopeChoice,
      range: selectionRange,
      sourceText: textToTransform,
      doc,
      editor,
      fileId,
      languageId,
      customInstruction,
      summaryFormat,
      summaryLength,
      targetLanguage,
      selectedTone,
      askAiPrompt,
    }

    // Contextual consent check (for on-device Llama writing transformations)
    if (activeProviderId === 'local' && payload.actionId !== 'translate' && !hasConsent) {
      pendingActionRef.current = payload
      setShowConsentPrompt(true)
      return
    }

    // If local provider and consented, but Llama engine not yet initialized
    if (activeProviderId === 'local' && payload.actionId !== 'translate' && engineStatus.state !== 'ready') {
      pendingActionRef.current = payload
      try {
        await localEngine.init()
      } catch (err) {
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Could not initialize on-device assistant.')
      }
      return
    }

    await executeTransformation(payload)
  }, [
    activeProviderId,
    askAiPrompt,
    customInstruction,
    editor,
    engineStatus.state,
    executeTransformation,
    fileId,
    hasConsent,
    languageId,
    localEngine,
    scopeChoice,
    selectedActionId,
    selectedTone,
    summaryFormat,
    summaryLength,
    targetLanguage,
  ])

  const handleAccept = useCallback(() => {
    if (!snapshot) return

    // Stale verification checks
    if (latestFileIdRef.current !== snapshot.fileId || latestEditorRef.current !== snapshot.editor) {
      setErrorMessage('The document was switched. Cannot accept stale result.')
      setStatus('stale')
      return
    }

    if (editor.state.doc !== snapshot.doc) {
      setErrorMessage('The document was edited after generation. Please generate again.')
      setStatus('stale')
      return
    }

    if (snapshot.scope === 'selected' && snapshot.range && snapshot.actionId !== 'continue-writing') {
      // Validate source range text match
      const currentSelectedText = editor.state.doc.textBetween(snapshot.range.from, snapshot.range.to, '\n').trim()
      if (currentSelectedText !== snapshot.sourceText) {
        setErrorMessage('Selected text was modified. Please generate again.')
        setStatus('stale')
        return
      }
    }

    try {
      const { target, content } = prepareContentForInsertion(
        editor.state.doc,
        snapshot.actionId,
        snapshot.scope,
        snapshot.range,
        proposedText,
      )

      const applied = editor.chain().focus().insertContentAt(target, content).run()
      if (!applied) throw new Error('Transaction rejected by editor.')

      setStatus('idle')
      setSnapshot(null)
      setProposedText('')
      setSuccessMessage('Changes applied to document. You can press Undo (Ctrl+Z / Cmd+Z) to revert.')
    } catch {
      setErrorMessage('Could not apply changes to document. The document was left unchanged.')
    }
  }, [editor, proposedText, snapshot])

  const handleDiscard = useCallback(() => {
    setStatus('idle')
    setSnapshot(null)
    setProposedText('')
    setErrorMessage(null)
    setSuccessMessage('Generated result discarded. Document was left unchanged.')
  }, [])

  const currentActionMeta = GENERATIVE_ACTIONS.find((a) => a.id === selectedActionId) ?? GENERATIVE_ACTIONS[0]!
  const hasSelection = Boolean(editor?.state?.selection && !editor.state.selection.empty)
  const isDocumentStale = Boolean(snapshot && editor?.state?.doc && (editor.state.doc !== snapshot.doc || fileId !== snapshot.fileId))

  return (
    <section
      aria-labelledby="generative-assistant-title"
      className="space-y-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-subtle)] p-4 text-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 id="generative-assistant-title" className="text-base font-semibold text-foreground">
            Generative Writing
          </h2>
          <p className="text-xs text-muted-foreground">
            Transform text or generate content. Changes apply only when you explicitly accept them.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowConfig(!showConfig)}
          aria-expanded={showConfig}
        >
          {showConfig ? 'Hide Config' : 'AI Settings'}
        </Button>
      </div>

      {showConfig ? (
        <ProviderConfigCard
          providerId={activeProviderId}
          credentialStore={credentialStore}
          onProviderChange={handleProviderChange}
          onClose={() => setShowConfig(false)}
        />
      ) : null}

      {/* On-Device Local AI Contextual States */}
      {activeProviderId === 'local' && !showConfig ? (
        !isWebGPUSupported ? (
          <div
            role="region"
            aria-label="On-device AI not supported"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 space-y-2"
          >
            <p className="font-semibold">On-Device Assistant Unavailable</p>
            <p>
              Private on-device AI is not supported on this browser. You can use our cloud AI assistant or switch to a modern version of Chrome, Edge, or Brave.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                handleProviderChange('groq')
                setShowConfig(true)
              }}
            >
              Configure Cloud AI
            </Button>
          </div>
        ) : showConsentPrompt ? (
          <div
            role="region"
            aria-label="Enable Private Writing Assistant"
            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 space-y-3"
          >
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-foreground">Enable Private Writing Assistant</h3>
              <p className="text-xs text-muted-foreground">
                Use AI to summarize, translate, and improve your writing directly on this device.
              </p>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Your document content is processed locally.</li>
              <li>Works offline after the initial download.</li>
              <li>One-time download of approximately 680 MB.</li>
              <li>Requires approximately 880 MB of device memory while running.</li>
            </ul>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                onClick={handleEnableLocalModel}
                aria-label="Download & Enable on-device assistant"
              >
                Download &amp; Enable
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleDismissConsent}
                aria-label="Do not enable on-device assistant now"
              >
                Not Now
              </Button>
            </div>
          </div>
        ) : engineStatus.state === 'downloading' || engineStatus.state === 'initializing' ? (
          <div
            role="region"
            aria-label="On-Device Assistant Setup Progress"
            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground">
                {engineStatus.state === 'downloading'
                  ? 'Downloading Writing Assistant…'
                  : 'Preparing Writing Assistant…'}
              </h3>
              <span className="text-xs font-mono font-medium text-foreground">{engineStatus.progress}%</span>
            </div>
            <div className="w-full bg-[var(--app-subtle)] rounded-full h-2 overflow-hidden border border-[var(--app-border)]">
              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(2, Math.min(100, engineStatus.progress))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {engineStatus.state === 'downloading'
                ? 'Downloading writing assistant files…'
                : 'Loading writing assistant into memory…'}
            </p>
            <p className="text-xs text-muted-foreground">
              This happens once. After downloading, generation runs locally and works offline.
            </p>
            <div className="pt-1">
              <Button type="button" variant="outline" size="sm" onClick={handleCancelInit}>
                Cancel
              </Button>
            </div>
          </div>
        ) : engineStatus.state === 'error' ? (
          <div
            role="region"
            aria-label="On-device assistant error"
            className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive space-y-2"
          >
            <p className="font-semibold">Setup Issue with On-Device Assistant</p>
            <p>{engineStatus.error || 'Failed to download or prepare on-device model.'}</p>
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" onClick={handleEnableLocalModel}>
                Retry Download
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setActiveProviderId('groq')
                  setShowConfig(true)
                }}
              >
                Use Cloud AI Instead
              </Button>
            </div>
          </div>
        ) : null
      ) : null}

      {/* Cloud Provider Setup Alert (when activeProviderId is remote) */}
      {activeProviderId !== 'local' && !isConfigured && !showConfig ? (
        <div
          role="region"
          aria-label="Provider configuration needed"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 space-y-2"
        >
          <p className="font-semibold">AI Provider Setup Required</p>
          <p>
            {profile.displayName} ({profile.privacy.processingType === 'local' ? 'Local' : 'Remote'}) needs configuration or privacy acknowledgement before sending text.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowConfig(true)}>
            Configure {profile.displayName}
          </Button>
        </div>
      ) : null}

      {/* Action Picker */}
      <div className="space-y-2">
        <label htmlFor="generative-action-select" className="block text-xs font-medium text-foreground">
          Writing Action
        </label>
        <select
          id="generative-action-select"
          aria-label="Select Writing Action"
          value={selectedActionId}
          onChange={(e) => {
            setSelectedActionId(e.target.value as GenerativeActionId)
            setErrorMessage(null)
          }}
          disabled={status === 'loading'}
          className="min-h-9 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm text-foreground"
        >
          {GENERATIVE_ACTIONS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{currentActionMeta.description}</p>
      </div>

      {/* Scope Selector */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-foreground">Text Scope</legend>
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="gen-scope"
              aria-label="AI Selected text"
              value="selected"
              checked={scopeChoice === 'selected'}
              onChange={() => setScopeChoice('selected')}
              disabled={status === 'loading' || !hasSelection}
            />
            <span className={!hasSelection ? 'text-muted-foreground line-through' : 'text-foreground'}>
              Selected text {!hasSelection ? '(No text highlighted)' : ''}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="gen-scope"
              aria-label="AI Entire document"
              value="document"
              checked={scopeChoice === 'document'}
              onChange={() => setScopeChoice('document')}
              disabled={status === 'loading'}
            />
            <span className="text-foreground">Entire document</span>
          </label>
        </div>
      </fieldset>

      {/* Action-Specific Options */}
      {selectedActionId === 'summarize' ? (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <label htmlFor="summary-length-select" className="block font-medium text-foreground">
              Length
            </label>
            <select
              id="summary-length-select"
              aria-label="Summary length"
              value={summaryLength}
              onChange={(e) => setSummaryLength(e.target.value as typeof summaryLength)}
              disabled={status === 'loading'}
              className="min-h-8 w-full rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-xs text-foreground"
            >
              <option value="concise">Concise</option>
              <option value="balanced">Balanced</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="summary-format-select" className="block font-medium text-foreground">
              Format
            </label>
            <select
              id="summary-format-select"
              aria-label="Summary format"
              value={summaryFormat}
              onChange={(e) => setSummaryFormat(e.target.value as typeof summaryFormat)}
              disabled={status === 'loading'}
              className="min-h-8 w-full rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-xs text-foreground"
            >
              <option value="paragraph">Paragraph</option>
              <option value="bullets">Bullet Points</option>
            </select>
          </div>
        </div>
      ) : null}

      {selectedActionId === 'translate' ? (
        <div className="space-y-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-2.5 text-xs">
          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
            <span>Translation Options</span>
            {activeProviderId === 'local' ? (
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                Offline (en ↔ hi)
              </span>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="target-language-select" className="block font-medium text-foreground">
              Target Language
            </label>
            <select
              id="target-language-select"
              aria-label="Target language"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              disabled={status === 'loading'}
              className="min-h-8 w-full rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-xs text-foreground"
            >
              {TARGET_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}{' '}
                  {activeProviderId === 'local'
                    ? lang.id === 'Hindi' || lang.id === 'English'
                      ? '(Offline)'
                      : '(Cloud required)'
                    : ''}
                </option>
              ))}
            </select>
          </div>

          {activeProviderId === 'local' && (targetLanguage === 'Hindi' || targetLanguage === 'English') ? (
            <p className="text-[11px] text-muted-foreground">
              Uses Mozilla Bergamot Marian NMT (~14.9 MB). Runs 100% offline in browser memory.
            </p>
          ) : activeProviderId === 'local' ? (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Offline translation is currently available for English ↔ Hindi. Select a cloud provider above to translate to {targetLanguage}.
            </p>
          ) : null}
        </div>
      ) : null}

      {selectedActionId === 'change-tone' ? (
        <div className="space-y-1 text-xs">
          <label htmlFor="tone-select" className="block font-medium text-foreground">
            Desired Tone
          </label>
          <select
            id="tone-select"
            aria-label="Desired tone"
            value={selectedTone}
            onChange={(e) => setSelectedTone(e.target.value)}
            disabled={status === 'loading'}
            className="min-h-8 w-full rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-xs text-foreground capitalize"
          >
            {TONE_OPTIONS.map((tone) => (
              <option key={tone} value={tone}>
                {tone.charAt(0).toUpperCase() + tone.slice(1)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {selectedActionId === 'ask-ai' ? (
        <div className="space-y-1 text-xs">
          <label htmlFor="ask-ai-prompt" className="block font-medium text-foreground">
            Your Question or Instruction (Required)
          </label>
          <textarea
            id="ask-ai-prompt"
            aria-label="Your Question or Instruction"
            rows={3}
            value={askAiPrompt}
            onChange={(e) => setAskAiPrompt(e.target.value)}
            disabled={status === 'loading'}
            placeholder="e.g., What are the key decisions here? Rewrite the second bullet to sound more decisive."
            className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-2 text-xs text-foreground placeholder:text-muted-foreground"
          />
        </div>
      ) : selectedActionId === 'improve-writing' || selectedActionId === 'continue-writing' ? (
        <div className="space-y-1 text-xs">
          <label htmlFor="custom-instruction-input" className="block font-medium text-foreground">
            Specific Guidance (Optional)
          </label>
          <input
            id="custom-instruction-input"
            aria-label="Specific Guidance"
            type="text"
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            disabled={status === 'loading'}
            placeholder="e.g., Executive style, keep it punchy"
            className="min-h-8 w-full rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-xs text-foreground placeholder:text-muted-foreground"
          />
        </div>
      ) : null}

      {/* Streaming Preview */}
      {status === 'loading' && streamingText ? (
        <div
          role="region"
          aria-label="Streaming Generation"
          className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-xs space-y-1"
        >
          <p className="font-medium text-muted-foreground">Streaming response…</p>
          <div className="font-mono text-xs text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
            {streamingText}
          </div>
        </div>
      ) : null}

      {/* Execution Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={status === 'loading' || !isConfigured}
          aria-label={status === 'loading' ? 'Generating…' : `Run ${currentActionMeta.label}`}
        >
          {status === 'loading' ? 'Generating…' : `Run ${currentActionMeta.label}`}
        </Button>
        {status === 'loading' ? (
          <Button type="button" variant="ghost" onClick={cancelGeneration}>
            Cancel
          </Button>
        ) : null}
      </div>

      {/* Notifications */}
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive space-y-2"
        >
          <p>{errorMessage}</p>
          {activeProviderId === 'ollama' ? (
            <div className="pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  handleProviderChange('local')
                  setErrorMessage(null)
                }}
              >
                Switch to Writin On-Device Assistant
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {successMessage ? (
        <p role="status" className="text-xs text-green-600 dark:text-green-400 font-medium">
          {successMessage}
        </p>
      ) : null}

      {/* Result Preview */}
      {status === 'preview-ready' && snapshot ? (
        <GenerativeResultPreview
          actionId={snapshot.actionId}
          actionTitle={currentActionMeta.label}
          scopeLabel={snapshot.scope === 'selected' ? 'Selected text' : 'Entire document'}
          sourceText={snapshot.sourceText}
          proposedText={proposedText}
          explanation={resultExplanation}
          isStale={isDocumentStale}
          onAccept={handleAccept}
          onRegenerate={handleGenerate}
          onDiscard={handleDiscard}
        />
      ) : null}
    </section>
  )
}
