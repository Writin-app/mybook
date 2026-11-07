import {
  CreateWebWorkerMLCEngine,
  type InitProgressReport,
  hasModelInCache,
  prebuiltAppConfig,
} from '@mlc-ai/web-llm'

import type { EngineAvailability, GenerationContext, TransformationEngine } from './contracts'
import { resolveTargetLanguageName } from './languages'
import { cleanModelWrapperArtifacts } from './outputValidation'

export const DEFAULT_LOCAL_LLAMA_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
export const LOCAL_AI_MODEL_DISPLAY_NAME = 'Llama 3.2 1B'
export const LOCAL_LLAMA_CONTEXT_WINDOW_LIMIT = 4096
export const SYSTEM_PROMPT_TOKEN_OVERHEAD = 250

export type LocalEngineLifecycleState =
  | 'unavailable'
  | 'downloading'
  | 'initializing'
  | 'ready'
  | 'generating'
  | 'cancelling'
  | 'unloading'
  | 'error'

export interface LocalEngineStatusReport {
  state: LocalEngineLifecycleState
  progress: number // 0 to 100
  message: string
  modelId: string
  isCached: boolean
  error?: string
}

export type LocalEngineStatusListener = (report: LocalEngineStatusReport) => void

export const DEFAULT_MAX_TOKENS_BY_ACTION: Record<string, number> = {
  shorten: 192,
  'change-tone': 256,
  translate: 384,
  'ask-ai': 384,
  'continue-writing': 384,
  expand: 512,
  summarize: 512,
  'improve-writing': 768,
  correct: 512,
}

export const DEFAULT_TEMPERATURE_BY_ACTION: Record<string, number> = {
  correct: 0.1,
  'improve-writing': 0.2,
  shorten: 0.1,
  'shorten-expand': 0.1,
  summarize: 0.2,
  translate: 0.1,
  'change-tone': 0.25,
  'continue-writing': 0.4,
  'ask-ai': 0.2,
}

export class ContextWindowExceededError extends Error {
  readonly estimatedTokens: number
  readonly maxTokens: number
  readonly wordCount: number
  readonly suggestedMaxWords: number

  constructor(estimatedTokens: number, maxTokens: number, wordCount: number, suggestedMaxWords: number) {
    super(
      `Context window limit exceeded: The selected text and generation budget require approximately ${estimatedTokens} tokens, which exceeds the local model limit of ${maxTokens} tokens. Please select a smaller passage (approximately ${suggestedMaxWords} words or fewer) and try again.`,
    )
    this.name = 'ContextWindowExceededError'
    this.estimatedTokens = estimatedTokens
    this.maxTokens = maxTokens
    this.wordCount = wordCount
    this.suggestedMaxWords = suggestedMaxWords
  }
}

export class LocalModelRefusalError extends Error {
  readonly refusalText: string
  readonly actionId: string

  constructor(actionId: string, refusalText: string) {
    super(
      `The local AI model declined to transform this text because safety filters flagged the content. Try rephrasing the text or using a different action.`,
    )
    this.name = 'LocalModelRefusalError'
    this.actionId = actionId
    this.refusalText = refusalText
  }
}

export function isRefusalOutput(text: string): boolean {
  if (!text) return false
  const trimmed = text.trim()
  if (!trimmed) return false

  // Strip leading synthetic wrapper tags or markdown quote/heading formatting
  // to inspect the opening communication from the model
  const opening = trimmed
    .replace(/^<\/?(?:source_text|output|roman)>\s*/i, '')
    .replace(/^(?:>|\*|#)+\s*/, '')
    .trim()

  // Inspect the opening segment (first 400 characters)
  const snippet = opening.slice(0, 400).toLowerCase().replace(/\s+/g, ' ')

  // Check 1: Explicit Safety / Harm Refusal
  // Requires a refusal/inability expression paired with safety, policy, or harm context
  const hasRefusalVerb =
    /\b(?:(?:i(?:\s+am|'m|m)?\s+(?:unable|not\s+able)\s+to|i\s+(?:cannot|can't|must\s+decline|must\s+refuse|will\s+not))\s+(?:to\s+)?(?:fulfill|assist(?:\s+you)?|help|process|comply|generate|create|write|rewrite|produce|provide|do|perform)\b|cannot\s+fulfill|can't\s+fulfill|cannot\s+assist|can't\s+assist|cannot\s+comply|can't\s+comply)\b/i.test(
      snippet,
    )

  const hasSafetyContext =
    /\b(?:safety\s+(?:guidelines?|polic(?:y|ies)|filters?|rules?)|content\s+polic(?:y|ies)|acceptable\s+use|terms\s+of\s+(?:service|use)|ethical\s+guidelines?|my\s+rules|against\s+my\s+instructions|harm(?:ful)?\b|damage\b|malicious\b|malware\b|phishing\b|cyber[\s-]*attacks?\b|attacks?\s+on\s+(?:the\s+)?(?:system|network|infrastructure)|illegal\b|unauthorized\s+access|exploits?\b|exploiting\b|weapons?\b|hacks?\b|hacking\b|exfiltrat(?:e|ing|ion)?\b|keylog(?:ger|ging)?\b)\b/i.test(
      snippet,
    )

  if (hasRefusalVerb && hasSafetyContext) {
    return true
  }

  // Check 2: Direct Request / Task Rejection at the start
  // The model explicitly states it cannot/will not fulfill or assist with the user's request/prompt/task
  const directTaskRefusal =
    /^(?:i(?:\s+am|'m|m)?\s+(?:unable|not\s+able)\s+to|i\s+(?:cannot|can't|must\s+decline|must\s+refuse|will\s+not))\s+(?:to\s+)?(?:fulfill|assist\s+with|help\s+with|process|comply\s+with|execute|complete|answer|rewrite|transform|modify|change|edit|create|shorten)\s+(?:a|an|any|this|that|your|the)\s+(?:request|task|prompt|instruction|document|text|shortened|version|translation|response)\b/i.test(
      snippet,
    ) ||
    /^(?:i(?:\s+am|'m|m)?\s+(?:unable|not\s+able)\s+to|i\s+(?:cannot|can't|must\s+decline|must\s+refuse|will\s+not))\s+(?:to\s+)?provide\s+(?:a|an|any|this|that|your|the)\s+(?:response|answer|translation|assistance|shortened\s+version)\b/i.test(
      snippet,
    ) ||
    /^(?:cannot|can't)\s+(?:to\s+)?(?:fulfill|assist\s+with|comply\s+with|rewrite|transform|modify|change|edit|create|shorten)\s+(?:a|an|any|this|that|your|the)\s+(?:request|task|prompt|instruction|document|text|shortened|version|translation)\b/i.test(
      snippet,
    ) ||
    /^(?:i(?:\s+am|'m|m)?\s+(?:unable|not\s+able)\s+to|i\s+(?:cannot|can't))\s+(?:to\s+)?(?:assist\s+with\s+(?:that|this)|help\s+with\s+(?:that|this)|fulfill\s+(?:that|this)|provide\s+(?:you\s+with\s+)?(?:a|an|any|the)?\s*(?:response|answer|translation)|rewrite\s+(?:a|an|any|this|that|your|the)\s+(?:source\s+)?text)\b/i.test(
      snippet,
    )

  if (directTaskRefusal) {
    return true
  }

  // Check 3: Conversational refusal ending with follow-up offer
  // e.g. "I cannot create a task... Is there any other tasks you need help with?"
  const refusalWithHelpOffer =
    /\b(?:is\s+there\s+anything\s+else\s+(?:i\s+can|we\s+can)\s+help|is\s+there\s+any\s+other\s+tasks?\s+you\s+need\s+help)\b/i.test(
      snippet,
    ) && /\b(?:cannot|can't|unable|not\s+able)\b/i.test(snippet)

  if (refusalWithHelpOffer) {
    return true
  }

  // Check 4: Apology or AI Identity prefix followed by refusal
  // e.g. "I am sorry, but I cannot fulfill this request" or "As an AI, I am unable to assist..."
  const apologyOrAiPrefix =
    /^(?:(?:i\s+am\s+sorry|i'm\s+sorry|im\s+sorry|i\s+apologize|my\s+apologies|sorry)[,\s]+(?:but\s+)?|(?:as\s+an?\s+(?:ai|language\s+model|assistant)[,\s]+))/i.test(
      snippet,
    )
  if (apologyOrAiPrefix) {
    const refusalAfterPrefix =
      /\b(?:i(?:\s+am|'m|m)?\s+(?:unable|not\s+able)\s+to|i\s+(?:cannot|can't|must\s+decline|must\s+refuse)|cannot\s+fulfill|can't\s+fulfill|cannot\s+assist|can't\s+assist)\s+(?:to\s+)?(?:fulfill|assist|help|comply|process|generate|create|write|rewrite|produce|provide|with)\b/i.test(
        snippet,
      )
    if (refusalAfterPrefix) {
      return true
    }
  }

  // Check 5: Multilingual refusals in target languages (French, German, Spanish, Hindi)
  // French: "Je suis désolé, mais je ne peux pas...", "Je ne peux pas répondre/traduire..."
  const frenchRefusal =
    /^(?:(?:je\s+(?:suis\s+)?d[ée]sol[ée](?:[,\s]+mais)?\s+)?je\s+ne\s+peux\s+pas\s+(?:r[ée]pondre\s+[àa]\s+cette\s+demande|traduire\s+ce\s+(?:texte|document)|accomplir\s+cette\s+t[âa]che|aider\s+avec\s+cette\s+demande|traiter\s+cette\s+demande|fournir\s+(?:une?\s+)?(?:r[ée]ponse|assistance|traduction))\b|je\s+ne\s+suis\s+pas\s+en\s+mesure\s+de\s+(?:traiter|r[ée]pondre\s+[àa]|traduire|accomplir)\s+(?:cette\s+demande|ce\s+texte|cette\s+requ[êe]te|cette\s+t[âa]che)\b|en\s+tant\s+que\s+(?:mod[èe]le|ia|intelligence\s+artificielle)\b.*?\bne\s+peux\s+pas\b)/i.test(
      snippet,
    )
  if (frenchRefusal) {
    return true
  }

  // German: "Ich kann diese Aufgabe nicht erfüllen...", "Es tut mir leid, aber ich kann..."
  const germanRefusal =
    /^(?:(?:es\s+tut\s+mir\s+leid(?:[,\s]+aber)?\s+)?ich\s+kann\s+(?:diese\s+aufgabe|diesen\s+text|das)?\s*nicht\s+(?:erf[üu]llen|[üu]bersetzen|helfen|ausf[üu]hren|bearbeiten)\b|ich\s+bin\s+nicht\s+in\s+der\s+lage\s*,\s*(?:diese\s+(?:aufgabe|anfrage)|diesen\s+text)\s+(?:zu\s+)?(?:erf[üu]llen|[üu]bersetzen|bearbeiten)\b|als\s+(?:ki|k[üu]nstliche\s+intelligenz|sprachmodell)\b.*?\bnicht\b)/i.test(
      snippet,
    )
  if (germanRefusal) {
    return true
  }

  // Spanish: "Lo siento, pero no puedo cumplir...", "No puedo traducir este texto..."
  const spanishRefusal =
    /^(?:(?:lo\s+siento[,\s]+(?:pero\s+)?)?no\s+puedo\s+(?:cumplir\s+con\s+esta\s+solicitud|ayudar\s+con\s+esta\s+solicitud|traducir\s+este\s+(?:texto|documento)|procesar\s+esta\s+solicitud|realizar\s+esta\s+tarea|responder\s+a\s+esta\s+solicitud|proporcionar\s+(?:una?\s+)?(?:respuesta|asistencia|ayuda))\b|no\s+estoy\s+en\s+condiciones\s+de\s+(?:cumplir|procesar|traducir)\s+esta\s+solicitud\b|como\s+(?:modelo\s+de\s+lenguaje|ia|asistente)\b.*?\bno\s+puedo\b)/i.test(
      snippet,
    )
  if (spanishRefusal) {
    return true
  }

  // Hindi: "मुझे खेद है, लेकिन मैं...", "मैं इस अनुरोध को पूरा नहीं कर सकता..."
  const hindiRefusal =
    /^(?:(?:मुझे\s+खेद\s+है|माफ़\s+कीजिए|क्षमा\s+करें)[,\s]+.*?(?:नहीं\s+कर\s+सकता|असमर्थ)|मैं\s+(?:इस\s+(?:अनुरोध|टेक्स्ट|दस्तावेज़)\s+(?:का|के|की|को)\s+)?(?:अनुवाद)\s+नहीं\s+कर\s+सकता|(?:एक\s+भाषा\s+मॉडल|एआई\s+मॉडल)\s+के\s+रूप\s+में\s*,\s*मैं)/i.test(
      snippet,
    )
  if (hindiRefusal) {
    return true
  }

  return false
}

/**
 * Conservative token estimation factoring in script expansion and punctuation/symbol density.
 * English prose: ~1.35 tokens/word + punctuation.
 * Roman Hindi / Hinglish: ~1.6 tokens/word + punctuation.
 * Devanagari Hindi: ~2.6 tokens/word due to subword splitting + punctuation.
 * Code / Markdown Tables / JSON: Punctuation is counted directly to prevent underestimation.
 */
export function estimateTokenCount(text: string, languageTag?: string): number {
  if (!text) return 0

  const words = text.trim().split(/\s+/).filter(Boolean).length
  const chars = text.length

  const isDevanagari = languageTag === 'hi-IN' || /[\u0900-\u097F]/.test(text)
  const isRomanHindiOrMixed = languageTag === 'hi-Latn' || languageTag === 'mixed-hi-en'

  // Non-alphanumeric structural / punctuation characters (critical for code, tables, JSON, URLs)
  const punctuationCount = (text.match(/[{}[\]()<>;:,.!?"'|\\`~@#$%^&*+\-=/]/g) || []).length

  if (isDevanagari) {
    const wordEstimate = Math.ceil(words * 2.6) + punctuationCount
    const charEstimate = Math.ceil(chars * 0.55)
    return Math.max(wordEstimate, charEstimate)
  }

  if (isRomanHindiOrMixed) {
    const wordEstimate = Math.ceil(words * 1.6) + punctuationCount
    const charEstimate = Math.ceil(chars * 0.35)
    return Math.max(wordEstimate, charEstimate)
  }

  const wordEstimate = Math.ceil(words * 1.35) + punctuationCount
  const charEstimate = Math.ceil(chars * 0.35)
  return Math.max(wordEstimate, charEstimate)
}

export interface MLCEngineInterface {
  resetChat: () => Promise<void>
  chat: {
    completions: {
      create: (options: {
        messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
        temperature?: number
        max_tokens?: number
        repetition_penalty?: number
        stop?: string[]
        stream?: boolean
      }) => Promise<AsyncIterable<{ choices: Array<{ delta?: { content?: string }; finish_reason?: string }> }>>
    }
  }
  interruptGenerate: () => Promise<void> | void
  unload: () => Promise<void> | void
}

export interface LocalLlamaEngineOptions {
  id?: string
  modelId?: string
  userConsentGranted?: boolean
  supportedLanguages?: readonly string[]
  engineFactory?: (
    worker: Worker,
    modelId: string,
    options: { initProgressCallback?: (report: { progress: number; text: string }) => void },
  ) => Promise<MLCEngineInterface>
  workerFactory?: () => Worker
  isWebGPUSupported?: () => Promise<boolean>
  isModelCached?: (modelId: string) => Promise<boolean>
  onTokenDelta?: (delta: string, accumulated: string) => void
}

export class LocalLlamaTransformationEngine implements TransformationEngine {
  readonly id: string
  readonly capabilities: TransformationEngine['capabilities']
  readonly modelId: string

  private userConsentGranted: boolean
  private statusReport: LocalEngineStatusReport
  private readonly listeners = new Set<LocalEngineStatusListener>()

  private worker: Worker | null = null
  private engine: MLCEngineInterface | null = null
  private isGenerating = false
  private isInitializing = false

  private readonly engineFactory: (
    worker: Worker,
    modelId: string,
    options: { initProgressCallback?: (report: { progress: number; text: string }) => void },
  ) => Promise<MLCEngineInterface>
  private readonly workerFactory: () => Worker
  private readonly checkWebGPUSupported: () => Promise<boolean>
  private readonly checkModelCached: (modelId: string) => Promise<boolean>
  private onTokenDelta?: (delta: string, accumulated: string) => void

  constructor(options: LocalLlamaEngineOptions = {}) {
    this.modelId = options.modelId ?? DEFAULT_LOCAL_LLAMA_MODEL_ID
    this.id = options.id ?? `writin.local-llama.${this.modelId}`
    this.userConsentGranted = options.userConsentGranted ?? false
    this.onTokenDelta = options.onTokenDelta

    this.engineFactory =
      options.engineFactory ??
      ((worker, modelId, opts) =>
        CreateWebWorkerMLCEngine(worker, modelId, {
          initProgressCallback: opts.initProgressCallback as (report: InitProgressReport) => void,
          appConfig: prebuiltAppConfig,
        }) as unknown as Promise<MLCEngineInterface>)

    this.workerFactory =
      options.workerFactory ??
      (() =>
        new Worker(new URL('./localLlama.worker.ts', import.meta.url), {
          type: 'module',
        }))

    this.checkWebGPUSupported =
      options.isWebGPUSupported ??
      (async () => {
        if (typeof navigator === 'undefined' || !('gpu' in navigator) || !(navigator as { gpu?: unknown }).gpu) {
          return false
        }
        try {
          const gpu = (navigator as { gpu: { requestAdapter: () => Promise<{ features?: { has: (name: string) => boolean } } | null> } }).gpu
          const adapter = await gpu.requestAdapter()
          if (!adapter) return false
          if (this.modelId.includes('f16') && adapter.features && !adapter.features.has('shader-f16')) {
            console.warn('[LocalLlama] Adapter lacks required shader-f16 feature for', this.modelId)
            return false
          }
          return true
        } catch {
          return false
        }
      })

    this.checkModelCached =
      options.isModelCached ??
      (async (modelId: string) => {
        try {
          return await hasModelInCache(modelId, prebuiltAppConfig)
        } catch {
          return false
        }
      })

    const supportedLanguages = options.supportedLanguages ?? [
      'en',
      'en-IN',
      'en-GB',
      'en-US',
      'hi-IN',
      'hi-Latn',
      'mixed-hi-en',
    ]

    this.capabilities = {
      supports: [
        {
          capability: 'rewrite',
          languages: supportedLanguages.map((tag) => ({ tag, includeSubtags: true })),
        },
      ],
    }

    this.statusReport = {
      state: 'unavailable',
      progress: 0,
      message: 'Local model is not initialized.',
      modelId: this.modelId,
      isCached: false,
    }
  }

  // Lifecycle & Consent Management

  public setTokenDeltaListener(listener?: (delta: string, accumulated: string) => void): void {
    this.onTokenDelta = listener
  }

  public grantUserConsent(): void {
    this.userConsentGranted = true
  }

  public revokeUserConsent(): void {
    this.userConsentGranted = false
  }

  public hasUserConsent(): boolean {
    return this.userConsentGranted
  }

  public getStatus(): LocalEngineStatusReport {
    return { ...this.statusReport }
  }

  public subscribeStatus(listener: LocalEngineStatusListener): () => void {
    this.listeners.add(listener)
    listener(this.getStatus())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private updateStatus(
    state: LocalEngineLifecycleState,
    progress: number,
    message: string,
    isCached: boolean,
    error?: string,
  ): void {
    this.statusReport = {
      state,
      progress,
      message,
      modelId: this.modelId,
      isCached,
      error,
    }
    const snapshot = this.getStatus()
    for (const listener of this.listeners) {
      try {
        listener(snapshot)
      } catch (err) {
        console.error('[LocalLlamaTransformationEngine] Error in status subscriber:', err)
      }
    }
  }

  public async getAvailability(): Promise<EngineAvailability> {
    const webgpuSupported = await this.checkWebGPUSupported()
    if (!webgpuSupported) {
      return {
        available: false,
        reason: 'WebGPU is not supported or enabled in this browser environment.',
      }
    }

    if (!this.userConsentGranted) {
      return {
        available: false,
        reason: 'Local model download requires explicit user consent.',
      }
    }

    const isOnline = typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' || navigator.onLine
    const cached = await this.checkModelCached(this.modelId)

    if (!isOnline && !cached && this.statusReport.state !== 'ready') {
      return {
        available: false,
        reason: 'The local model is not downloaded in cache and the device is currently offline.',
      }
    }

    return { available: true }
  }

  /**
   * Explicitly initialize the local WebLLM engine inside the Web Worker.
   * If already ready, this is a no-op.
   */
  public async init(): Promise<void> {
    if (this.engine && this.statusReport.state === 'ready') {
      return
    }

    if (this.isInitializing) {
      throw new Error('Local engine is already initializing.')
    }

    if (!this.userConsentGranted) {
      throw new Error('User consent is required before downloading and initializing local models.')
    }

    const availability = await this.getAvailability()
    if (!availability.available) {
      throw new Error(availability.reason ?? 'Local engine is unavailable.')
    }

    this.isInitializing = true
    const isCached = await this.checkModelCached(this.modelId)
    this.updateStatus(
      isCached ? 'initializing' : 'downloading',
      0,
      isCached ? 'Loading model weights from cache...' : 'Downloading model weights from CDN...',
      isCached,
    )

    try {
      this.worker = this.workerFactory()

      const initProgressCallback = (report: { progress: number; text: string }) => {
        const pct = Math.round((report.progress || 0) * 100)
        const isStillFetching =
          report.text.toLowerCase().includes('fetch') || report.text.toLowerCase().includes('download')

        const state: LocalEngineLifecycleState = isStillFetching ? 'downloading' : 'initializing'
        this.updateStatus(state, pct, report.text, isCached)
      }

      this.engine = await this.engineFactory(this.worker, this.modelId, { initProgressCallback })

      this.updateStatus('ready', 100, `Model ${this.modelId} is ready for local inference.`, true)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      this.cleanupWorkerResources()
      this.updateStatus('error', 0, `Failed to load model: ${errorMsg}`, isCached, errorMsg)
      throw err
    } finally {
      this.isInitializing = false
    }
  }

  /**
   * Unload model from WebGPU memory and terminate Web Worker.
   */
  public async unload(): Promise<void> {
    this.updateStatus('unloading', 0, 'Unloading model and terminating Web Worker...', this.statusReport.isCached)
    await this.cleanupWorkerResources()
    this.updateStatus('unavailable', 0, 'Local model is not initialized.', this.statusReport.isCached)
  }

  private async cleanupWorkerResources(): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.unload()
      } catch (err) {
        console.warn('[LocalLlamaTransformationEngine] Error during engine.unload():', err)
      }
      this.engine = null
    }

    if (this.worker) {
      try {
        this.worker.terminate()
      } catch (err) {
        console.warn('[LocalLlamaTransformationEngine] Error terminating worker:', err)
      }
      this.worker = null
    }

    this.isGenerating = false
  }

  // Prompt Construction & Natural Language Understanding

  public buildSystemPrompt(
    actionId?: string,
    languageTag?: string,
    options?: Record<string, unknown>,
    userInstruction?: string,
  ): string {
    void userInstruction

    const lines = [
      'You are the built-in writing assistant for the Writin application.',
      "Follow the user's writing task faithfully.",
      'Preserve all core meaning, facts, names, numbers, dates, and perspective (e.g., keep "I" as "I" and "you" as "you").',
      'Output ONLY the direct result without conversational preamble, greetings, commentary, or explanatory notes.',
      'Do not wrap the output in markdown code blocks or quotes.',
    ]

    if (actionId === 'shorten') {
      lines.push(
        'Rewrite text to be concise and direct by removing wordy phrasing. Always keep every request, action item, deadline, negative condition, and commitment intact.',
      )
    } else if (actionId === 'summarize') {
      lines.push(
        'If the text describes an invitation, suggestion, or proposal, maintain it as an invitation or proposal rather than a confirmed commitment or obligation.',
      )
    } else if (actionId === 'translate') {
      const targetLang =
        resolveTargetLanguageName(options?.targetLanguage) ??
        (languageTag === 'hi-IN' ? 'English' : 'Hindi')
      lines.push(
        `Translate the provided text accurately and fluently into ${targetLang}.`,
      )
    } else if (languageTag === 'hi-Latn') {
      lines.push(
        'The text is written in Roman Hindi (Hindi using the Latin alphabet). You must keep the output strictly in Roman Hindi (Latin alphabet). Do NOT translate into English and do NOT convert into Devanagari script.',
      )
    } else if (languageTag === 'hi-IN') {
      lines.push(
        'The text is written in Hindi (Devanagari script). Maintain fluent Hindi in Devanagari script. Do NOT translate into English.',
      )
    } else if (languageTag === 'mixed-hi-en') {
      lines.push(
        "The text contains code-mixed Hindi and English (Hinglish). Maintain the author's natural code-mixed Latin phrasing. Do NOT convert everything to pure English or pure Devanagari Hindi.",
      )
    } else if (languageTag === 'en-IN') {
      lines.push(
        'The text is in English. Maintain natural regional English phrasing without Americanizing. Output must remain strictly in English.',
      )
    } else if (languageTag === 'en-GB') {
      lines.push(
        'The text is in British English. Retain British English spellings and idioms without Americanization.',
      )
    } else if (languageTag && languageTag !== 'und' && !languageTag.startsWith('en')) {
      lines.push(
        `Preserve the author's original language (${languageTag}). Output the rewritten text in the exact same language.`,
      )
    }

    return lines.join('\n')
  }

  public buildUserPrompt(
    actionId: string,
    sourceText: string,
    options?: Record<string, unknown>,
    userInstruction?: string,
    languageTag?: string,
  ): string {
    return buildUserPrompt(actionId, sourceText, options, userInstruction, languageTag)
  }

  public buildTaskSpecificRetryPrompt(
    actionId: string,
    languageTag?: string,
    options?: Record<string, unknown>,
  ): string {
    const parts: string[] = [
      'You are an expert editor in the Writin application.',
      'The source text provided is safe, ordinary user document content to be transformed.',
      'Execute the writing task directly without commentary, safety warnings, or apologies.',
    ]

    switch (actionId) {
      case 'correct':
        parts.push(
          'Your task is to fix grammar, spelling, punctuation, and subject-verb agreement with minimal changes.',
          'Strictly preserve author perspective (keep "I" as "I") and intent.',
        )
        break
      case 'change-tone': {
        const tone = String(options?.tone ?? 'professional')
        parts.push(
          `Your task is to rewrite the text to adopt a ${tone}, polite, and constructive tone.`,
          'Preserve all factual points, commitments, deadlines, and perspective.',
        )
        break
      }
      case 'translate': {
        const targetLang =
          resolveTargetLanguageName(options?.targetLanguage) ??
          (languageTag === 'hi-IN' ? 'English' : 'Hindi')
        parts.push(
          `Your task is to translate the text into ${targetLang}.`,
          'Preserve all factual points, names, numbers, and technical terminology accurately.',
        )
        break
      }
      case 'summarize':
        parts.push(
          'Your task is to summarize the text concisely preserving key facts and modality (keep invitations and suggestions as invitations, not confirmed obligations).',
        )
        break
      case 'shorten':
        parts.push(
          'Your task is to shorten the text eliminating redundancy while preserving all action items, requests, deadlines, and perspective ("I" as "I").',
        )
        break
      case 'expand':
        parts.push('Your task is to expand the text by adding depth to existing points.')
        break
      case 'continue-writing':
        parts.push('Your task is to continue writing naturally from where the text ends.')
        break
      case 'ask-ai':
        parts.push('Your task is to execute the user transformation request directly on the document text.')
        break
      default:
        parts.push('Your task is to rewrite and improve the provided text.')
    }

    if (languageTag === 'hi-Latn') {
      parts.push('The output must be in Roman Hindi (Hindi words written using the English Latin alphabet).')
    } else if (languageTag === 'mixed-hi-en') {
      parts.push('The output must maintain natural code-mixed Hinglish in the Latin alphabet.')
    } else if (languageTag === 'hi-IN') {
      parts.push('The output must be in Hindi using Devanagari script.')
    }

    parts.push(
      'Transform the provided text faithfully.',
      'Output ONLY the final transformed text directly without conversational commentary or preamble.',
    )

    return parts.join('\n')
  }

  // Transformation Implementation

  async transform(
    context: GenerationContext,
    signal?: AbortSignal,
  ): Promise<{ proposedText: string; explanation?: string }> {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError')
    }

    const trimmedText = context.text.trim()
    if (!trimmedText) {
      throw new Error('Source text is empty.')
    }

    if (!this.userConsentGranted) {
      throw new Error('User consent is required before downloading and initializing local models.')
    }

    if (this.isGenerating || this.isInitializing) {
      throw new Error('Local engine is busy processing another request. Please wait or cancel the current generation.')
    }

    // Context Window Budget Validation
    const wordCount = trimmedText.split(/\s+/).filter(Boolean).length
    const sourceTokens = estimateTokenCount(trimmedText, context.languageTag)
    const reservedOutputTokens = DEFAULT_MAX_TOKENS_BY_ACTION[context.actionId] ?? 512
    const totalEstimatedTokens = SYSTEM_PROMPT_TOKEN_OVERHEAD + sourceTokens + reservedOutputTokens

    if (totalEstimatedTokens > LOCAL_LLAMA_CONTEXT_WINDOW_LIMIT) {
      const availableTokensForSource = LOCAL_LLAMA_CONTEXT_WINDOW_LIMIT - SYSTEM_PROMPT_TOKEN_OVERHEAD - reservedOutputTokens
      const tokenPerWordRatio = sourceTokens / (wordCount || 1)
      const suggestedMaxWords = Math.max(50, Math.floor(availableTokensForSource / tokenPerWordRatio))

      throw new ContextWindowExceededError(
        totalEstimatedTokens,
        LOCAL_LLAMA_CONTEXT_WINDOW_LIMIT,
        wordCount,
        suggestedMaxWords,
      )
    }

    // Ensure engine is loaded and initialized
    if (!this.engine || this.statusReport.state !== 'ready') {
      await this.init()
    }

    if (!this.engine) {
      throw new Error('Local engine failed to initialize.')
    }

    this.isGenerating = true
    this.updateStatus('generating', 100, 'Generating transformation locally on WebGPU...', true)

    const abortHandler = () => {
      this.updateStatus('cancelling', 100, 'Cancelling generation...', true)
      if (this.engine) {
        try {
          this.engine.interruptGenerate()
        } catch {
          // ignore
        }
      }
    }

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true })
    }

    try {
      const systemPrompt = this.buildSystemPrompt(
        context.actionId,
        context.languageTag,
        context.options,
        context.instruction,
      )
      const userPrompt = this.buildUserPrompt(
        context.actionId,
        trimmedText,
        context.options,
        context.instruction,
        context.languageTag,
      )

      const temperature = DEFAULT_TEMPERATURE_BY_ACTION[context.actionId] ?? 0.2

      const stopSequences = [
        '<|eot_id|>',
        '<|end_of_text|>',
      ]

      const firstPassText = await this.executeCompletionPass(
        systemPrompt,
        userPrompt,
        reservedOutputTokens,
        stopSequences,
        temperature,
        signal,
        trimmedText,
      )

      if (signal?.aborted) {
        throw new DOMException('The operation was aborted', 'AbortError')
      }

      if (!isRefusalOutput(firstPassText)) {
        return {
          proposedText: firstPassText,
          explanation: 'Locally generated with Llama 3.2 1B (on-device)',
        }
      }

      // False-positive refusal detected -> execute single bounded retry with disambiguation prompt
      const retrySystemPrompt = this.buildTaskSpecificRetryPrompt(
        context.actionId,
        context.languageTag,
        context.options,
      )

      const retryPassText = await this.executeCompletionPass(
        retrySystemPrompt,
        userPrompt,
        reservedOutputTokens,
        stopSequences,
        temperature,
        signal,
        trimmedText,
      )

      if (signal?.aborted) {
        throw new DOMException('The operation was aborted', 'AbortError')
      }

      if (!isRefusalOutput(retryPassText)) {
        return {
          proposedText: retryPassText,
          explanation: 'Locally generated with Llama 3.2 1B (on-device, disambiguated)',
        }
      }

      // Retry also refused -> fail safely with structured refusal error
      throw new LocalModelRefusalError(context.actionId, retryPassText)
    } catch (err) {
      if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw new DOMException('The operation was aborted', 'AbortError')
      }

      // Check for worker crash / device loss
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (
        errorMessage.toLowerCase().includes('device lost') ||
        errorMessage.toLowerCase().includes('worker destroyed') ||
        errorMessage.toLowerCase().includes('disconnected')
      ) {
        await this.cleanupWorkerResources()
        this.updateStatus('error', 0, `Hardware error: ${errorMessage}`, true, errorMessage)
      }

      throw err
    } finally {
      this.isGenerating = false
      if (signal) {
        signal.removeEventListener('abort', abortHandler)
      }
      if (this.engine) {
        this.updateStatus('ready', 100, `Model ${this.modelId} is ready for local inference.`, true)
      }
    }
  }

  private async executeCompletionPass(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    stopSequences: string[],
    temperature: number = 0.2,
    signal?: AbortSignal,
    sourceText?: string,
  ): Promise<string> {
    if (!this.engine) throw new Error('WebLLM Engine not initialized')

    await this.engine.resetChat()

    const completion = await this.engine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      repetition_penalty: 1.15,
      stop: stopSequences,
      stream: true,
    })

    let accumulated = ''
    for await (const chunk of completion) {
      if (signal?.aborted) {
        throw new DOMException('The operation was aborted', 'AbortError')
      }

      const delta = chunk.choices[0]?.delta?.content || ''
      if (delta) {
        accumulated += delta
        this.onTokenDelta?.(delta, accumulated)
      }
    }

    return cleanModelWrapperArtifacts(accumulated, sourceText)
  }
}

export function isInformationalQuery(instruction: string): boolean {
  const trimmed = instruction.trim().toLowerCase()
  if (!trimmed) return false

  // Polite transformation requests phrased as questions:
  // "can you fix this", "could you make it polite", "would you rewrite this"
  const isPoliteTransformationRequest =
    /^(?:can|could|would)\s+you\s+(?:please\s+)?(?:make|fix|correct|rewrite|improve|shorten|expand|change|translate|polish|rephrase|reword|turn|convert)\b/i.test(
      trimmed,
    )

  if (isPoliteTransformationRequest) {
    return false
  }

  // Pure questions about facts, content, meaning or analysis
  const hasQuestionStructure =
    /^(?:what|who|when|where|why|how|which|whose|whom|is|are|was|were|do|does|did|will|should|explain|list|describe|summarize\s+what|tell\s+me)\b/i.test(
      trimmed,
    ) || trimmed.endsWith('?')

  return hasQuestionStructure
}

export function isGrammarCorrectionInstruction(instruction: string): boolean {
  const trimmed = instruction.trim().toLowerCase()
  return /^(?:make\s+(?:this|it)\s+(?:grammatically\s+)?correct|fix\s+(?:the\s+)?grammar|correct\s+(?:this|the)\b)/i.test(
    trimmed,
  )
}

export function buildTaskInstruction(
  actionId: string,
  sourceText: string,
  options?: Record<string, unknown>,
  userInstruction?: string,
  languageTag?: string,
): string {
  const wordCount = sourceText.trim().split(/\s+/).filter(Boolean).length

  let task = ''
  switch (actionId) {
    case 'correct':
      task =
        "Correct all grammar, syntax, spelling, and agreement mistakes in this text. Fix subject-verb agreement (use plural verbs for plural nouns, singular for singular: 'there are' with plural nouns), verb tenses, and prepositions. Preserve the author's voice, intent, and perspective. Return ONLY the corrected text directly."
      break

    case 'improve-writing':
      task =
        "Improve the clarity, flow, and phrasing of the source text while preserving the author's original meaning, tone, facts, and perspective. Return ONLY the improved text directly."
      break

    case 'shorten':
      task =
        'Shorten this text concisely while keeping all requests, actions, and deadlines.'
      break

    case 'summarize': {
      if (wordCount < 40) {
        task =
          'Provide a concise one-sentence summary of the text. Accurately represent whether actions are proposed, planned, completed, or requested. Do not turn casual invitations or suggestions into confirmed obligations. Return ONLY the summary.'
      } else if (options?.format === 'bullets') {
        task =
          'Summarize the key points of the text in concise bullet points. Preserve essential facts, decisions, and dates without inventing details. Return ONLY the bullet points.'
      } else {
        task =
          'Produce a concise summary capturing the key points and essential meaning of the text. Accurately reflect whether actions are proposals, requests, or confirmed commitments, without inventing details. Return ONLY the summary.'
      }
      break
    }

    case 'expand':
      task =
        "Elaborate on the author's existing ideas with greater depth and clarity. Maintain the original intent and tone without inventing new facts, statistics, names, or ungrounded claims. Return ONLY the expanded text directly."
      break

    case 'shorten-expand':
      if (options?.mode === 'shorten') {
        task =
          'Shorten this text concisely while keeping all requests, actions, and deadlines.'
      } else {
        task =
          "Elaborate on the author's existing ideas with greater depth and clarity without inventing new facts or claims. Return ONLY the expanded text directly."
      }
      break

    case 'continue-writing':
      task =
        "Continue writing naturally from where the text ends. Match the author's voice, tone, style, and context seamlessly. Do not repeat the original text and do not introduce unrelated topics. Output ONLY the new continuation directly."
      break

    case 'translate': {
      const targetLang =
        resolveTargetLanguageName(options?.targetLanguage) ??
        (languageTag === 'hi-IN' ? 'English' : 'Hindi')
      task =
        `Translate the entire text into ${targetLang}. Use natural, fluent target-language phrasing while preserving all original meaning, tone, names, numbers, and formatting. Return ONLY the translated text without explanations or commentary.`
      break
    }

    case 'change-tone': {
      const tone = String(options?.tone ?? 'professional')
      task =
        `Rewrite the text to adopt a ${tone} tone while preserving the original meaning, facts, and core message. Return ONLY the revised text directly.`
      break
    }

    case 'ask-ai': {
      const trimmedInstruction = (userInstruction ?? '').trim()
      if (!trimmedInstruction) {
        task =
          "Improve the text for clarity, grammar, and flow while strictly preserving original meaning, perspective, and facts. Return ONLY the transformed text directly."
      } else if (isInformationalQuery(trimmedInstruction)) {
        task =
          `Answer the following question about the source text directly and concisely:\n"${trimmedInstruction}"`
      } else if (isGrammarCorrectionInstruction(trimmedInstruction)) {
        task =
          "Correct all grammar, syntax, spelling, and agreement mistakes in this text. Fix subject-verb agreement (use plural verbs for plural nouns, singular for singular: 'there are' with plural nouns), verb tenses, and prepositions. Preserve the author's voice, intent, and perspective. Return ONLY the corrected text directly."
      } else {
        // Natural language transform instruction (e.g. "make it sound professional", "make it polite")
        task =
          `Transform the text according to this instruction: "${trimmedInstruction}". Strictly preserve the author's perspective, commitments, deadlines, and core meaning. Return ONLY the transformed text directly without conversational advice, commentary, or notes.`
      }
      break
    }

    default:
      task =
        "Improve clarity, grammar, and flow while strictly preserving the original meaning, facts, and perspective. Return ONLY the transformed text directly."
      break
  }

  if (
    ['correct', 'improve-writing', 'shorten', 'summarize', 'expand', 'shorten-expand', 'change-tone', 'ask-ai'].includes(actionId) &&
    !(actionId === 'ask-ai' && isInformationalQuery(userInstruction ?? ''))
  ) {
    task += ' Preserve every source name, date, time, number, deadline, request, action, commitment, and negation. Keep the original meaning; do not invent supporting context.'
  }

  // If specific extra guidance was provided for a non-ask-ai action (e.g. improve-writing with instruction)
  if (actionId !== 'ask-ai' && userInstruction?.trim()) {
    task += ` Additional guidance: "${userInstruction.trim()}".`
  }

  // Regional language preservation guidance if relevant
  const isEnInGrammarAction =
    actionId === 'correct' ||
    actionId === 'improve-writing' ||
    (actionId === 'ask-ai' && isGrammarCorrectionInstruction(userInstruction ?? ''))

  if (languageTag === 'en-IN' && isEnInGrammarAction) {
    task += ' Output must be in English. Retain natural regional English phrasing and idioms without Americanizing.'
  }

  return task
}

export function buildUserPrompt(
  actionId: string,
  sourceText: string,
  options?: Record<string, unknown>,
  userInstruction?: string,
  languageTag?: string,
): string {
  const taskInstruction = buildTaskInstruction(actionId, sourceText, options, userInstruction, languageTag)
  const label = actionId === 'shorten' ? 'Text' : 'Source text'
  return `Task: ${taskInstruction}\n\n${label}:\n${sourceText.trim()}`
}

export function createLocalLlamaTransformationEngine(
  options?: LocalLlamaEngineOptions,
): LocalLlamaTransformationEngine {
  return new LocalLlamaTransformationEngine(options)
}

export const LOCAL_AI_CONSENT_STORAGE_KEY = 'writin_local_ai_consent'

export function hasPersistedLocalConsent(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(LOCAL_AI_CONSENT_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function persistLocalConsent(granted: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (granted) {
      localStorage.setItem(LOCAL_AI_CONSENT_STORAGE_KEY, 'true')
    } else {
      localStorage.removeItem(LOCAL_AI_CONSENT_STORAGE_KEY)
    }
  } catch {
    // Ignore storage restrictions
  }
}

let sharedLocalLlamaEngine: LocalLlamaTransformationEngine | null = null

export function getSharedLocalLlamaEngine(options?: LocalLlamaEngineOptions): LocalLlamaTransformationEngine {
  if (!sharedLocalLlamaEngine) {
    const userConsentGranted = options?.userConsentGranted ?? hasPersistedLocalConsent()
    sharedLocalLlamaEngine = createLocalLlamaTransformationEngine({
      ...options,
      userConsentGranted,
    })
  }
  return sharedLocalLlamaEngine
}

export function resetSharedLocalLlamaEngine(): void {
  if (sharedLocalLlamaEngine) {
    void sharedLocalLlamaEngine.unload()
    sharedLocalLlamaEngine = null
  }
}
