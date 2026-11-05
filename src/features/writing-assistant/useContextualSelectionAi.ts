import type { Editor } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { GenerativeActionId, TransformationEngine, WritingCapability } from './contracts'
import { BergamotEngineError, getSharedBergamotEngine } from './bergamotEngine'
import { detectTextScript } from './translationCapabilityRegistry'
import { EngineRegistry } from './engineRegistry'
import { createHttpTransformationEngine } from './httpTransformationEngine'
import {
  assertProviderIsolation,
  getAiRoutingDiagnostics,
  getEffectiveEndpoint,
  getGenerationProviderProfile,
  getPreferredAiProvider,
  logAiRoutingDiagnostic,
  setPreferredAiProvider,
  subscribePreferredAiProvider,
} from './providerProfiles'
import { sessionCredentialStore } from './sessionCredentialStore'
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
  createSelectionSnapshot,
  validateAndPrepareSelectionInsertion,
  type SelectionSnapshot,
} from './staleProtection'

export type ContextualAiStatus =
  | 'idle'
  | 'consent-needed'
  | 'loading'
  | 'preview'
  | 'stale'
  | 'error'

export interface ContextualAiOptions {
  targetLanguage?: string
  tone?: string
  instruction?: string
}

export const SELECTION_AI_ACTIONS: Array<{
  id: GenerativeActionId
  label: string
  description: string
}> = [
  { id: 'correct', label: 'Correct', description: 'Fix grammar, spelling, and phrasing' },
  { id: 'summarize', label: 'Summarize', description: 'Create a concise summary of the selection' },
  { id: 'translate', label: 'Translate…', description: 'Translate selection to another language' },
  { id: 'shorten', label: 'Shorten', description: 'Make selection more concise and direct' },
  { id: 'expand', label: 'Expand', description: 'Add more detail and depth to selection' },
  { id: 'change-tone', label: 'Change Tone…', description: 'Adjust tone to professional, casual, etc.' },
  { id: 'continue-writing', label: 'Continue Writing', description: 'Generate continuation from selection' },
  { id: 'ask-ai', label: 'Ask AI…', description: 'Ask a question or enter a custom prompt' },
]

export const SELECTION_TONE_OPTIONS = [
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'direct', label: 'Direct & Concise' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'academic', label: 'Academic' },
] as const

export const SELECTION_TRANSLATION_LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi (हिंदी)' },
  { id: 'es', label: 'Spanish (Español)' },
  { id: 'fr', label: 'French (Français)' },
  { id: 'de', label: 'German (Deutsch)' },
  { id: 'ja', label: 'Japanese (日本語)' },
] as const

export interface UseContextualSelectionAiProps {
  editor: Editor
  fileId?: string
  languageId?: string
  customEngine?: TransformationEngine
  onClose?: () => void
}

function asLocalLlamaEngine(engine: TransformationEngine): LocalLlamaTransformationEngine | null {
  if ('subscribeStatus' in engine && typeof (engine as LocalLlamaTransformationEngine).subscribeStatus === 'function') {
    return engine as LocalLlamaTransformationEngine
  }
  return null
}

export function useContextualSelectionAi({
  editor,
  fileId = 'default-doc',
  languageId = 'en',
  customEngine,
  onClose,
}: UseContextualSelectionAiProps) {
  const [status, setStatus] = useState<ContextualAiStatus>('idle')
  const [activeActionId, setActiveActionId] = useState<GenerativeActionId | null>(null)
  const [activeOptions, setActiveOptions] = useState<ContextualAiOptions>({})
  const [snapshot, setSnapshot] = useState<SelectionSnapshot | null>(null)
  const [proposedText, setProposedText] = useState('')
  const [resultExplanation, setResultExplanation] = useState<string | undefined>(undefined)
  const [streamingText, setStreamingText] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasConsent, setHasConsent] = useState(() => hasPersistedLocalConsent())
  const [preferredProvider, setPreferredProvider] = useState(() => getPreferredAiProvider())
  const [pendingAction, setPendingAction] = useState<{
    actionId: GenerativeActionId
    options?: ContextualAiOptions
  } | null>(null)

  useEffect(() => {
    return subscribePreferredAiProvider((newId) => {
      setPreferredProvider(newId)
    })
  }, [])

  const [downloadProgress, setDownloadProgress] = useState<{
    state: string
    progress: number
    message?: string
    currentFile?: string
  }>({
    state: 'idle',
    progress: 0,
    message: '',
  })

  const snapshotRef = useRef<SelectionSnapshot | null>(null)
  snapshotRef.current = snapshot

  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  // Subscribe to engine download / initialization progress for both Llama and Bergamot
  useEffect(() => {
    const rawEngine = customEngine ?? getSharedLocalLlamaEngine()
    const localEngine = asLocalLlamaEngine(rawEngine)
    const bergamot = getSharedBergamotEngine()

    let unsubLocal: (() => void) | undefined
    if (localEngine) {
      unsubLocal = localEngine.subscribeStatus((report: LocalEngineStatusReport) => {
        if (activeActionId !== 'translate') {
          setDownloadProgress({
            state: report.state,
            progress: report.progress,
            message: report.message,
          })
        }
      })
    }

    const unsubBergamot = bergamot.subscribeStatus((report) => {
      if (activeActionId === 'translate') {
        setDownloadProgress({
          state: report.state,
          progress: report.progress,
          message: report.message,
          currentFile: report.currentFile,
        })
      }
    })

    return () => {
      unsubLocal?.()
      unsubBergamot?.()
    }
  }, [activeActionId, customEngine])

  const runTransformation = useCallback(
    async (
      currentSnapshot: SelectionSnapshot,
      actionId: GenerativeActionId,
      options?: ContextualAiOptions,
    ) => {
      setStatus('loading')
      setStreamingText('')
      setProposedText('')
      setResultExplanation(undefined)
      setErrorMessage(null)

      const isTranslation = actionId === 'translate'
      let rawEngine: TransformationEngine

      if (customEngine) {
        rawEngine = customEngine
      } else if (isTranslation) {
        rawEngine = getSharedBergamotEngine()
      } else if (preferredProvider === 'local') {
        if (detectTextScript(currentSnapshot.sourceText) === 'Devanagari') {
          setStatus('error')
          setErrorMessage(
            'On-device writing transformations are currently supported for English text. To transform Hindi text, please configure a cloud AI provider in AI Settings.'
          )
          return
        }
        rawEngine = getSharedLocalLlamaEngine()
      } else {
        const cred = sessionCredentialStore.getCredential(preferredProvider)
        const profile = getGenerationProviderProfile(preferredProvider)
        const effectiveEndpoint = getEffectiveEndpoint(preferredProvider, cred?.endpointUrl)
        const isAcknowledged = sessionCredentialStore.isDisclosureAcknowledged(preferredProvider, effectiveEndpoint)

        if (!isAcknowledged) {
          setStatus('error')
          setErrorMessage(
            `${profile?.displayName ?? preferredProvider} requires privacy disclosure acknowledgement in AI Settings before connecting to ${effectiveEndpoint || 'an external service'}.`,
          )
          return
        }

        if (profile?.privacy.requiresApiKey && !cred?.apiKey) {
          setStatus('error')
          setErrorMessage(`Please configure your API key for ${profile.displayName} in AI Settings.`)
          return
        }

        assertProviderIsolation(preferredProvider, effectiveEndpoint)
        rawEngine = createHttpTransformationEngine({
          providerId: preferredProvider,
          credentialStore: sessionCredentialStore,
        })
      }

      const diag = getAiRoutingDiagnostics(
        'desktop-selection-popover',
        actionId,
        preferredProvider,
        rawEngine.id,
      )
      logAiRoutingDiagnostic(diag)
      assertProviderIsolation(preferredProvider)

      const localEngine = !isTranslation && preferredProvider === 'local' ? asLocalLlamaEngine(rawEngine) : null

      if (localEngine && localEngine.getStatus().state !== 'ready') {
        try {
          if (!localEngine.hasUserConsent()) {
            localEngine.grantUserConsent()
          }
          await localEngine.init()
        } catch (err) {
          setStatus('error')
          setErrorMessage(err instanceof Error ? err.message : 'Could not initialize on-device assistant.')
          return
        }
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      localEngine?.setTokenDeltaListener((_delta: string, accumulated: string) => {
        setStreamingText(accumulated)
      })

      const registry = new EngineRegistry([rawEngine])
      const orchestrator = new AssistantOrchestrator(registry)

      const capability: WritingCapability = actionId === 'translate' ? 'translation' : 'rewrite'

      try {
        const outcome = await orchestrator.transform({
          capability,
          context: {
            actionId,
            scope: 'selected',
            range: currentSnapshot.range,
            text: currentSnapshot.sourceText,
            instruction: options?.instruction,
            languageTag:
              languageId && languageId !== 'und'
                ? languageId
                : (detectTextScript(currentSnapshot.sourceText) === 'Devanagari' ? 'hi-IN' : 'en'),
            options: {
              targetLanguage: options?.targetLanguage,
              tone: options?.tone,
            },
            requestId: ++requestIdRef.current,
            documentId: fileId,
            snapshotId: String(currentSnapshot.doc.content.size),
          },
          signal: controller.signal,
          isCurrent: () =>
            editor.state.doc === currentSnapshot.doc &&
            editor.state.selection.from === currentSnapshot.range.from &&
            editor.state.selection.to === currentSnapshot.range.to,
        })

        if (outcome.status === 'preview-ready') {
          const validation = validateAndCleanGenerativeOutput({
            rawText: outcome.proposedText,
            actionId,
            sourceText: currentSnapshot.sourceText,
            targetLanguage: actionId === 'translate' ? options?.targetLanguage : undefined,
            languageTag:
              languageId && languageId !== 'und'
                ? languageId
                : (detectTextScript(currentSnapshot.sourceText) === 'Devanagari' ? 'hi-IN' : 'en'),
          })

          if (!validation.isValid) {
            setStatus('error')
            setErrorMessage(validation.errorMessage ?? 'Generated output was rejected by safety checks.')
            return
          }

          setProposedText(validation.cleanedText)
          setResultExplanation(outcome.explanation)
          setStatus('preview')
        } else if (outcome.status === 'cancelled') {
          setStatus('idle')
        } else if (outcome.status === 'stale') {
          setStatus('stale')
          setErrorMessage('The document was edited during generation. Please select the text again.')
        } else {
          setStatus('error')
          setErrorMessage(outcome.reason ?? 'Generation failed.')
        }
      } catch (err) {
        if (controller.signal.aborted) {
          setStatus('idle')
          return
        }
        setStatus('error')
        if (err instanceof BergamotEngineError) {
          setErrorMessage(err.message)
        } else if (err instanceof LocalModelRefusalError) {
          setErrorMessage('The assistant could not process this text due to safety guidelines.')
        } else if (err instanceof ContextWindowExceededError) {
          setErrorMessage(
            `Selected text is too long (~${err.estimatedTokens} tokens). Please select a shorter passage.`,
          )
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'Transformation failed.')
        }
      } finally {
        localEngine?.setTokenDeltaListener(undefined)
      }
    },
    [customEngine, editor, fileId, languageId, preferredProvider],
  )

  const executeAction = useCallback(
    async (actionId: GenerativeActionId, options?: ContextualAiOptions) => {
      const { selection, doc } = editor.state
      if (selection.empty) {
        setErrorMessage('Please select text in the document first.')
        setStatus('error')
        return
      }

      const newSnapshot = createSelectionSnapshot(fileId, doc, {
        from: selection.from,
        to: selection.to,
      })

      setSnapshot(newSnapshot)
      snapshotRef.current = newSnapshot
      setActiveActionId(actionId)
      setActiveOptions(options ?? {})

      // Check one-time local consent for Llama writing tasks (Bergamot handles its own on-demand download prompt)
      if (actionId !== 'translate' && !customEngine && !hasPersistedLocalConsent()) {
        setPendingAction({ actionId, options })
        setStatus('consent-needed')
        return
      }

      await runTransformation(newSnapshot, actionId, options)
    },
    [customEngine, editor, fileId, runTransformation],
  )

  const handleConsentApprove = useCallback(async () => {
    persistLocalConsent(true)
    setHasConsent(true)

    const rawEngine = customEngine ?? getSharedLocalLlamaEngine()
    const localEngine = asLocalLlamaEngine(rawEngine)
    if (localEngine) {
      localEngine.grantUserConsent()
    }

    if (pendingAction && snapshotRef.current) {
      const { actionId, options } = pendingAction
      setPendingAction(null)
      await runTransformation(snapshotRef.current, actionId, options)
    } else {
      setStatus('idle')
    }
  }, [customEngine, pendingAction, runTransformation])

  const handleConsentDismiss = useCallback(() => {
    setPendingAction(null)
    setStatus('idle')
    onClose?.()
  }, [onClose])

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setStatus('idle')
  }, [])

  const handleAccept = useCallback(() => {
    if (!snapshotRef.current) return

    const prep = validateAndPrepareSelectionInsertion(
      editor,
      fileId,
      snapshotRef.current,
      activeActionId ?? 'improve-writing',
      proposedText,
    )

    if (!prep.valid) {
      setStatus('stale')
      const msg =
        prep.validation.status === 'stale'
          ? prep.validation.message
          : 'The selection or document changed. Please select the text again.'
      setErrorMessage(msg)
      return
    }

    const applied = editor.chain().focus().insertContentAt(prep.plan.target, prep.plan.content).run()
    if (!applied) {
      setStatus('error')
      setErrorMessage('Editor rejected the transaction. Document was left unchanged.')
      return
    }

    setStatus('idle')
    setSnapshot(null)
    snapshotRef.current = null
    setProposedText('')
    onClose?.()
  }, [activeActionId, editor, fileId, onClose, proposedText])

  const handleDiscard = useCallback(() => {
    setStatus('idle')
    setSnapshot(null)
    snapshotRef.current = null
    setProposedText('')
    setErrorMessage(null)
    onClose?.()
  }, [onClose])

  const handleRegenerate = useCallback(async () => {
    if (snapshotRef.current && activeActionId) {
      await runTransformation(snapshotRef.current, activeActionId, activeOptions)
    }
  }, [activeActionId, activeOptions, runTransformation])

  const reset = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setStatus('idle')
    setSnapshot(null)
    snapshotRef.current = null
    setProposedText('')
    setErrorMessage(null)
  }, [])

  const switchToOnDeviceProvider = useCallback(() => {
    setPreferredAiProvider('local')
    setPreferredProvider('local')
    setStatus('idle')
    setErrorMessage(null)
  }, [])

  return {
    status,
    activeActionId,
    activeOptions,
    snapshot,
    proposedText,
    resultExplanation,
    streamingText,
    errorMessage,
    hasConsent,
    downloadProgress,
    executeAction,
    handleConsentApprove,
    handleConsentDismiss,
    handleCancel,
    handleAccept,
    handleDiscard,
    handleRegenerate,
    handleRetry: handleRegenerate,
    preferredProvider,
    switchToOnDeviceProvider,
    reset,
  }
}
