import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  LocalLlamaTransformationEngine,
  ContextWindowExceededError,
  LocalModelRefusalError,
  isRefusalOutput,
  estimateTokenCount,
  DEFAULT_LOCAL_LLAMA_MODEL_ID,
  LOCAL_LLAMA_CONTEXT_WINDOW_LIMIT,
  type MLCEngineInterface,
  type LocalEngineStatusReport,
} from './localLlamaEngine'
import { AssistantOrchestrator } from './orchestrator'
import { EngineRegistry } from './engineRegistry'
import type { GenerationContext, GenerationRequest } from './contracts'

function createMockMLCEngine(options?: {
  responses?: string[]
  onInterrupt?: () => void
  onUnload?: () => void
}): MLCEngineInterface {
  let callCount = 0
  const responses = options?.responses ?? ['Improved text output.']

  return {
    resetChat: vi.fn().mockResolvedValue(undefined),
    interruptGenerate: vi.fn().mockImplementation(() => {
      options?.onInterrupt?.()
    }),
    unload: vi.fn().mockImplementation(async () => {
      options?.onUnload?.()
    }),
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async () => {
          const responseText = responses[callCount] ?? responses[responses.length - 1] ?? 'Transformed output.'
          callCount++

          // Simulate streaming chunks
          const words = responseText.split(' ')
          async function* generator() {
            for (let i = 0; i < words.length; i++) {
              const delta = (i > 0 ? ' ' : '') + words[i]
              yield {
                choices: [
                  {
                    delta: { content: delta },
                    finish_reason: i === words.length - 1 ? 'stop' : undefined,
                  },
                ],
              }
            }
          }

          return generator()
        }),
      },
    },
  }
}

function createMockWorker(): Worker {
  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as Worker
}

function makeContext(overrides?: Partial<GenerationContext>): GenerationContext {
  return {
    requestId: 1,
    documentId: 'doc-1',
    snapshotId: 'snap-1',
    languageTag: 'en-US',
    text: 'This is the draft text to improve.',
    actionId: 'improve-writing',
    scope: 'selected',
    ...overrides,
  }
}

describe('LocalLlamaTransformationEngine', () => {
  let mockEngine: MLCEngineInterface
  let mockWorker: Worker
  let isWebGPUAvailable: boolean
  let isCachedInStorage: boolean

  beforeEach(() => {
    mockEngine = createMockMLCEngine()
    mockWorker = createMockWorker()
    isWebGPUAvailable = true
    isCachedInStorage = false
  })

  function createTestEngine(overrides?: {
    userConsentGranted?: boolean
    responses?: string[]
    onTokenDelta?: (delta: string, accumulated: string) => void
  }) {
    if (overrides?.responses) {
      mockEngine = createMockMLCEngine({ responses: overrides.responses })
    }

    return new LocalLlamaTransformationEngine({
      userConsentGranted: overrides?.userConsentGranted ?? true,
      isWebGPUSupported: async () => isWebGPUAvailable,
      isModelCached: async () => isCachedInStorage,
      workerFactory: () => mockWorker,
      engineFactory: async (_worker, _modelId, opts) => {
        opts.initProgressCallback?.({ progress: 0.5, text: 'Fetching model parameters...' })
        opts.initProgressCallback?.({ progress: 1.0, text: 'Loading parameters into WebGPU...' })
        return mockEngine
      },
      onTokenDelta: overrides?.onTokenDelta,
    })
  }

  describe('1. Lifecycle and User Consent', () => {
    it('initializes in unavailable state with modelId configured', () => {
      const engine = createTestEngine({ userConsentGranted: false })
      expect(engine.modelId).toBe(DEFAULT_LOCAL_LLAMA_MODEL_ID)
      const status = engine.getStatus()
      expect(status.state).toBe('unavailable')
      expect(status.progress).toBe(0)
      expect(status.isCached).toBe(false)
    })

    it('subscriber receives initial state and updates as engine initializes', async () => {
      const engine = createTestEngine({ userConsentGranted: true })
      const reports: LocalEngineStatusReport[] = []

      const unsubscribe = engine.subscribeStatus((report) => {
        reports.push(report)
      })

      expect(reports.length).toBe(1)
      expect(reports[0]?.state).toBe('unavailable')

      await engine.init()

      const states = reports.map((r) => r.state)
      expect(states).toContain('downloading')
      expect(states).toContain('initializing')
      expect(states.at(-1)).toBe('ready')
      expect(engine.getStatus().state).toBe('ready')

      unsubscribe()
    })

    it('blocks initialization and availability without explicit user consent', async () => {
      const engine = createTestEngine({ userConsentGranted: false })

      const availability = await engine.getAvailability()
      expect(availability.available).toBe(false)
      expect(availability.reason).toContain('consent')

      await expect(engine.init()).rejects.toThrow(/User consent is required/)
    })

    it('allows initialization once consent is granted, and respects revocation', async () => {
      const engine = createTestEngine({ userConsentGranted: false })
      expect(engine.hasUserConsent()).toBe(false)

      engine.grantUserConsent()
      expect(engine.hasUserConsent()).toBe(true)

      const availability = await engine.getAvailability()
      expect(availability.available).toBe(true)

      await engine.init()
      expect(engine.getStatus().state).toBe('ready')

      engine.revokeUserConsent()
      expect(engine.hasUserConsent()).toBe(false)
      const afterRevoke = await engine.getAvailability()
      expect(afterRevoke.available).toBe(false)
    })
  })

  describe('2. Hardware & Offline Availability Checks', () => {
    it('reports unavailable when WebGPU is not supported', async () => {
      isWebGPUAvailable = false
      const engine = createTestEngine({ userConsentGranted: true })

      const availability = await engine.getAvailability()
      expect(availability.available).toBe(false)
      expect(availability.reason).toContain('WebGPU')
    })

    it('reports unavailable when offline and model is not in cache', async () => {
      isCachedInStorage = false
      const originalOnLine = navigator.onLine
      try {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
        const engine = createTestEngine({ userConsentGranted: true })

        const availability = await engine.getAvailability()
        expect(availability.available).toBe(false)
        expect(availability.reason).toContain('offline')
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
      }
    })

    it('reports available when offline if model is already cached', async () => {
      isCachedInStorage = true
      const originalOnLine = navigator.onLine
      try {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
        const engine = createTestEngine({ userConsentGranted: true })

        const availability = await engine.getAvailability()
        expect(availability.available).toBe(true)
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
      }
    })
  })

  describe('3. Context Window Safety and Token Budget', () => {
    it('estimates token counts conservatively for different scripts', () => {
      const english = 'The quick brown fox jumps over the lazy dog in the park.'
      const devanagari = 'त्वरित भूरा लोमड़ी पार्क में आलसी कुत्ते के ऊपर कूदता है।'
      const romanHindi = 'Quick brown lomdi park me aalsi kutte ke upar koodti hai.'

      const engTokens = estimateTokenCount(english, 'en-US')
      const devTokens = estimateTokenCount(devanagari, 'hi-IN')
      const romTokens = estimateTokenCount(romanHindi, 'hi-Latn')

      expect(engTokens).toBeGreaterThan(0)
      expect(devTokens).toBeGreaterThan(engTokens) // Devanagari subword expansion
      expect(romTokens).toBeGreaterThanOrEqual(engTokens)
    })

    it('allows requests within the 4,096 token KV cache budget', async () => {
      const engine = createTestEngine({ userConsentGranted: true })
      const ctx = makeContext({
        text: 'This is a normal 50 word passage that is safely within the token budget.',
      })

      const result = await engine.transform(ctx)
      expect(result.proposedText).toBe('Improved text output.')
      expect(result.explanation).toContain('Llama 3.2 1B')
    })

    it('rejects oversized text with structured ContextWindowExceededError without truncating', async () => {
      const engine = createTestEngine({ userConsentGranted: true })

      // Generate a massive 3,500 word text: 3500 * 1.35 = 4725 tokens > 4096
      const hugeText = Array.from({ length: 3500 }, (_, i) => `word${i}`).join(' ')
      const ctx = makeContext({ text: hugeText, actionId: 'improve-writing' })

      await expect(engine.transform(ctx)).rejects.toThrow(ContextWindowExceededError)

      try {
        await engine.transform(ctx)
      } catch (err) {
        expect(err).toBeInstanceOf(ContextWindowExceededError)
        const budgetErr = err as ContextWindowExceededError
        expect(budgetErr.maxTokens).toBe(LOCAL_LLAMA_CONTEXT_WINDOW_LIMIT)
        expect(budgetErr.estimatedTokens).toBeGreaterThan(LOCAL_LLAMA_CONTEXT_WINDOW_LIMIT)
        expect(budgetErr.wordCount).toBe(3500)
        expect(budgetErr.suggestedMaxWords).toBeLessThan(3500)
        expect(budgetErr.message).toContain('Context window limit exceeded')
      }
    })

    it('rejects empty source text', async () => {
      const engine = createTestEngine({ userConsentGranted: true })
      const ctx = makeContext({ text: '   ' })
      await expect(engine.transform(ctx)).rejects.toThrow(/Source text is empty/)
    })
  })

  describe('4. Prompt Construction and Script Preservation across 8 Actions & 6 Languages', () => {
    it('constructs concise neutral system prompts focused on global role and fidelity', () => {
      const engine = createTestEngine()

      const actions = [
        'correct',
        'improve-writing',
        'summarize',
        'translate',
        'shorten',
        'expand',
        'change-tone',
        'continue-writing',
        'ask-ai',
      ]

      for (const actionId of actions) {
        const prompt = engine.buildSystemPrompt(actionId, 'en-US')
        expect(prompt).toContain('You are the built-in writing assistant for the Writin application.')
        expect(prompt).toContain('Preserve all core meaning, facts, names, numbers, dates, and perspective')
        expect(prompt).toContain('Output ONLY the direct result without conversational preamble')
      }
    })

    it('constructs action-specific user prompts with Task directive and isolated source text', () => {
      const engine = createTestEngine()
      const sampleText = 'Please let me know if there is any changes required, so I can complete it today itself.'

      // Correct
      const correctPrompt = engine.buildUserPrompt('correct', sampleText)
      expect(correctPrompt).toContain("Task: Correct all grammar, syntax, spelling, and agreement mistakes in this text")
      expect(correctPrompt).toContain("Fix subject-verb agreement")
      expect(correctPrompt).toContain(`Source text:\n${sampleText}`)

      // Shorten
      const shortenPrompt = engine.buildUserPrompt('shorten', sampleText)
      expect(shortenPrompt).toContain("Task: Shorten this text concisely")
      expect(shortenPrompt).toContain("keeping all requests, actions, and deadlines")
      expect(shortenPrompt).toContain("deadlines")

      // Summarize adaptive for short input (< 40 words)
      const summarizePrompt = engine.buildUserPrompt('summarize', sampleText)
      expect(summarizePrompt).toContain("Provide a concise one-sentence summary of the text")
      expect(summarizePrompt).toContain("Do not turn casual invitations or suggestions into confirmed obligations")

      // Ask AI transformation command ("make it punchy")
      const askAiTransform = engine.buildUserPrompt('ask-ai', sampleText, undefined, 'make it punchy')
      expect(askAiTransform).toContain('Transform the text according to this instruction: "make it punchy"')
      expect(askAiTransform).toContain("Strictly preserve the author's perspective")

      // Ask AI grammar correction command ("make this correct")
      const askAiGrammar = engine.buildUserPrompt('ask-ai', sampleText, undefined, 'make this correct')
      expect(askAiGrammar).toContain("Correct all grammar, syntax, spelling, and agreement mistakes in this text")
      expect(askAiGrammar).toContain("Fix subject-verb agreement")

      // Ask AI question ("What is the deadline?")
      const askAiQuestion = engine.buildUserPrompt('ask-ai', sampleText, undefined, 'What is the deadline?')
      expect(askAiQuestion).toContain('Answer the following question about the source text directly and concisely')
      expect(askAiQuestion).toContain('"What is the deadline?"')
    })

    it('retains Indian English phrasing instructions for en-IN without Americanization', () => {
      const engine = createTestEngine()
      const sampleText = 'Please complete it today itself.'
      const userPrompt = engine.buildUserPrompt('correct', sampleText, undefined, undefined, 'en-IN')
      expect(userPrompt).toContain('Retain natural regional English phrasing and idioms without Americanizing')

      const sysPrompt = engine.buildSystemPrompt('correct', 'en-IN')
      expect(sysPrompt).toContain('regional English phrasing without Americanizing')
    })

    it('enforces Latin alphabet script preservation for Roman Hindi (hi-Latn)', () => {
      const engine = createTestEngine()
      const prompt = engine.buildSystemPrompt('improve-writing', 'hi-Latn')
      expect(prompt).toContain('Roman Hindi')
      expect(prompt).toContain('Latin alphabet')
      expect(prompt).toContain('do NOT convert into Devanagari script')
      expect(prompt).toContain('Do NOT translate into English')
    })

    it('enforces Devanagari script preservation for Hindi (hi-IN)', () => {
      const engine = createTestEngine()
      const prompt = engine.buildSystemPrompt('improve-writing', 'hi-IN')
      expect(prompt).toContain('Hindi (Devanagari script)')
      expect(prompt).toContain('Do NOT translate into English')
    })

    it('enforces code-mixed Latin phrasing for Hinglish (mixed-hi-en)', () => {
      const engine = createTestEngine()
      const prompt = engine.buildSystemPrompt('improve-writing', 'mixed-hi-en')
      expect(prompt).toContain('Hinglish')
      expect(prompt).toContain('Do NOT convert everything to pure English or pure Devanagari Hindi')
    })

    it('enforces author language preservation for English profiles (en-IN, en-GB, en-US)', () => {
      const engine = createTestEngine()
      const enPrompt = engine.buildSystemPrompt('improve-writing', 'en-IN')
      // Shouldn't add Hindi instructions to English
      expect(enPrompt).not.toContain('Devanagari')
      expect(enPrompt).not.toContain('Roman Hindi')
    })
  })

  describe('5. Refusal Detection and Bounded Disambiguation Retry', () => {
    describe('Refusal Detection Precision (isRefusalOutput)', () => {
      it('correctly identifies genuine positive refusal responses', () => {
        // Genuine safety guideline refusal
        expect(isRefusalOutput('I cannot fulfill this request because it violates safety guidelines.')).toBe(true)
        // Harmful request refusal
        expect(isRefusalOutput('I am unable to assist with generating malicious scripts or exploiting vulnerabilities.')).toBe(true)
        // Refusal with safe alternative suggestion
        expect(isRefusalOutput("I can't generate phishing emails, but I can help you write security awareness training materials.")).toBe(true)
        // Apology prefix followed by refusal
        expect(isRefusalOutput('I apologize, but as an AI language model, I am unable to assist with modifying this text.')).toBe(true)
        // Direct task decline
        expect(isRefusalOutput('My apologies, but I cannot fulfill this request.')).toBe(true)
        expect(isRefusalOutput('I cannot assist with that request.')).toBe(true)
        expect(isRefusalOutput('I must decline to fulfill this request.')).toBe(true)
        expect(isRefusalOutput("I'm sorry, but as an AI assistant, I am not able to write code for unauthorized access.")).toBe(true)
        expect(isRefusalOutput("I'm unable to assist with this document.")).toBe(true)
        expect(isRefusalOutput('As an AI assistant, I cannot rewrite aggressive text.')).toBe(true)
        // Wrapped in synthetic wrapper tags
        expect(isRefusalOutput('<source_text>I cannot fulfill this request due to safety policies.</source_text>')).toBe(true)

        // Multilingual target-language refusals
        expect(isRefusalOutput('Je suis désolé, mais je ne peux pas répondre à cette demande.')).toBe(true)
        expect(isRefusalOutput('Je ne peux pas traduire ce texte en raison des directives de sécurité.')).toBe(true)
        expect(isRefusalOutput('Ich kann diese Aufgabe nicht erfüllen. Ich helfen Ihnen bei anderen Aufgaben.')).toBe(true)
        expect(isRefusalOutput('Es tut mir leid, aber ich kann diesen Text nicht übersetzen.')).toBe(true)
        expect(isRefusalOutput('Lo siento, pero no puedo cumplir con esta solicitud.')).toBe(true)
        expect(isRefusalOutput('No puedo traducir este documento por políticas de seguridad.')).toBe(true)
        expect(isRefusalOutput('मुझे खेद है, लेकिन मैं इस अनुरोध को पूरा नहीं कर सकता।')).toBe(true)
        expect(isRefusalOutput('मैं इस दस्तावेज़ का अनुवाद नहीं कर सकता।')).toBe(true)
      })

      it('correctly rejects false positives on benign user writing (negative examples)', () => {
        // Technical documentation with negative assertions
        expect(isRefusalOutput('The system cannot create duplicate records without an index.')).toBe(false)
        expect(isRefusalOutput('This endpoint cannot provide a guaranteed response time.')).toBe(false)
        expect(isRefusalOutput('When configuring PostgreSQL replication, the standby node cannot provide read-your-writes consistency until the WAL records are fully applied.')).toBe(false)
        expect(isRefusalOutput('The server cannot provide TLS 1.0 support because it was deprecated.')).toBe(false)

        // Customer apology and business writing
        expect(isRefusalOutput('I am sorry for the delay in delivering the updated document.')).toBe(false)
        expect(isRefusalOutput('I apologize for the inconvenience caused by the service disruption earlier today. Our team is actively working to ensure this does not happen again.')).toBe(false)
        expect(isRefusalOutput('I apologize for the confusion regarding the invoice amount.')).toBe(false)
        expect(isRefusalOutput('We cannot provide immediate refunds for digital downloads per store terms.')).toBe(false)
        expect(isRefusalOutput("I cannot attend tomorrow's meeting due to a medical appointment.")).toBe(false)

        // Objective descriptions of language models
        expect(isRefusalOutput('As a language model, the system has several limitations.')).toBe(false)

        // Long document with refusal-like phrases embedded in the middle
        const longDocument = [
          '# Microservice Architecture Overview',
          '',
          'In this quarter, our team worked on scaling the order ingestion pipeline.',
          'During load testing, we discovered that under heavy load, the database cannot provide real-time updates.',
          'If a partition fails, the service cannot create new sessions until consensus is restored.',
          'I am sorry to report that this led to a minor latency spike during the migration.',
          'Overall, the new design improved usability and reduced unnecessary steps across all core services.',
        ].join('\n')
        expect(isRefusalOutput(longDocument)).toBe(false)

        // Benign multilingual writing and legitimate document inability phrases (Stage 23.2.B.11 audit)
        expect(isRefusalOutput('Wir können dieses Feature im nächsten Sprint implementieren.')).toBe(false)
        expect(isRefusalOutput('Nous pouvons traduire ce document dès demain matin.')).toBe(false)
        expect(isRefusalOutput('Podemos procesar el pago sin ningún problema.')).toBe(false)
        expect(isRefusalOutput('हम इस कार्य को समय पर पूरा कर सकते हैं।')).toBe(false)

        // Stage 23.2.B.11 Section 4: Document content containing refusal-like expressions
        expect(isRefusalOutput('I cannot approve this request without legal review.')).toBe(false)
        expect(isRefusalOutput('I cannot provide this document without a subpoena.')).toBe(false)
        expect(isRefusalOutput('The customer said they could not complete the payment.')).toBe(false)
        expect(isRefusalOutput('Je ne peux pas approuver cette demande sans avis juridique.')).toBe(false)
        expect(isRefusalOutput('Je ne peux pas fournir ce document sans autorisation préalable.')).toBe(false)
        expect(isRefusalOutput("Je ne suis pas en mesure d'approuver cette demande sans avis juridique.")).toBe(false)
        expect(isRefusalOutput("Je ne suis pas en mesure de signer l'accord en ce moment.")).toBe(false)
        expect(isRefusalOutput("Le client a dit qu'il ne pouvait pas effectuer le paiement.")).toBe(false)
        expect(isRefusalOutput('Ich kann diese Anfrage ohne rechtliche Prüfung nicht genehmigen.')).toBe(false)
        expect(isRefusalOutput('Der Kunde sagte, dass er die Zahlung nicht abschließen konnte.')).toBe(false)
        expect(isRefusalOutput('Ich bin nicht in der Lage, diese Anfrage ohne rechtliche Prüfung zu genehmigen.')).toBe(false)
        expect(isRefusalOutput('No puedo aprobar esta solicitud sin una revisión legal.')).toBe(false)
        expect(isRefusalOutput('El cliente dijo que no podía completar el pago.')).toBe(false)
        expect(isRefusalOutput('No estoy en condiciones de aprobar esta solicitud sin revisión legal.')).toBe(false)
        expect(isRefusalOutput('No puedo proporcionar estos datos sin autorización previa.')).toBe(false)
        expect(isRefusalOutput('No estoy autorizado para firmar este contrato.')).toBe(false)
        expect(isRefusalOutput('मैं कानूनी समीक्षा के बिना इस अनुरोध को मंजूरी नहीं दे सकता।')).toBe(false)
        expect(isRefusalOutput('ग्राहक ने कहा कि वे भुगतान पूरा नहीं कर सके।')).toBe(false)
        expect(isRefusalOutput('मैं इस दस्तावेज़ को बिना अनुमति के प्रदान नहीं कर सकता।')).toBe(false)
        expect(isRefusalOutput('मैं इस कार्य को पूरा नहीं कर सकता क्योंकि सर्वर डाउन है।')).toBe(false)

        // Standard draft transformations
        expect(isRefusalOutput('Here is the revised polite text for your review:')).toBe(false)
        expect(isRefusalOutput('Refactored error handling logic in the auth module.')).toBe(false)
      })
    })

    it('processes benign text containing "cannot create" on pass 1 without unnecessary retry', async () => {
      const benignText = 'The system cannot create duplicate records without an unique constraint.'
      const engine = createTestEngine({
        userConsentGranted: true,
        responses: [benignText],
      })

      const ctx = makeContext({
        actionId: 'summarize',
        text: 'The system cannot create duplicate records without an unique constraint.',
      })

      const result = await engine.transform(ctx)
      expect(result.proposedText).toBe(benignText)
      expect(result.explanation).toContain('on-device')
      expect(result.explanation).not.toContain('disambiguated')
      // Exactly 1 pass - no retry triggered
      expect(mockEngine.chat.completions.create).toHaveBeenCalledTimes(1)
    })

    it('automatically recovers from false-positive refusal via single bounded retry', async () => {
      // First pass returns refusal; second pass (retry) returns clean text
      const engine = createTestEngine({
        userConsentGranted: true,
        responses: [
          'I cannot fulfill this request as the text discusses security vulnerabilities.',
          'Fixed authentication flaw where token expiration was unchecked in OAuth callback.',
        ],
      })

      const ctx = makeContext({
        actionId: 'change-tone',
        text: 'This auth code is completely broken and full of security holes!',
      })

      const result = await engine.transform(ctx)
      expect(result.proposedText).toBe('Fixed authentication flaw where token expiration was unchecked in OAuth callback.')
      expect(result.explanation).toContain('disambiguated')
      expect(mockEngine.chat.completions.create).toHaveBeenCalledTimes(2)
    })

    it('throws LocalModelRefusalError when retry also refuses, never returning refusal apology as document text', async () => {
      const engine = createTestEngine({
        userConsentGranted: true,
        responses: [
          'I cannot fulfill this request because it violates safety guidelines.',
          'I am unable to process this text even with disambiguation.',
        ],
      })

      const ctx = makeContext({
        actionId: 'change-tone',
        text: 'Harsh offensive rant.',
      })

      await expect(engine.transform(ctx)).rejects.toThrow(LocalModelRefusalError)

      try {
        await engine.transform(ctx)
      } catch (err) {
        expect(err).toBeInstanceOf(LocalModelRefusalError)
        const refusalErr = err as LocalModelRefusalError
        expect(refusalErr.actionId).toBe('change-tone')
        expect(refusalErr.refusalText).toContain('unable to process')
      }
    })

    it('does not truncate translation output when model emits delimiter tags', async () => {
      const translationText = '<source_text>El equipo completó el proyecto antes de lo previsto.</source_text>'
      const engine = createTestEngine({
        userConsentGranted: true,
        responses: [translationText],
      })

      const ctx = makeContext({
        actionId: 'translate',
        options: { targetLanguage: 'Spanish' },
        text: 'The team completed the project ahead of schedule.',
      })

      const result = await engine.transform(ctx)
      expect(result.proposedText).toBe('El equipo completó el proyecto antes de lo previsto.')
      expect(result.proposedText).not.toContain('<source_text>')
      expect(result.proposedText).not.toContain('</source_text>')
    })

    it('resolves raw language codes to canonical language names in all prompt builders', () => {
      const engine = createTestEngine()

      const codesToExpected = [
        { code: 'hi', expected: 'Hindi' },
        { code: 'en', expected: 'English' },
        { code: 'es', expected: 'Spanish' },
        { code: 'fr', expected: 'French' },
        { code: 'de', expected: 'German' },
        { code: 'ja', expected: 'Japanese' },
      ]

      for (const { code, expected } of codesToExpected) {
        // 1. System prompt
        const sysPrompt = engine.buildSystemPrompt('translate', 'en-US', { targetLanguage: code })
        expect(sysPrompt).toContain(`Translate the provided text accurately and fluently into ${expected}.`)
        expect(sysPrompt).not.toContain(`into ${code}.`)

        // 2. User task prompt
        const userPrompt = engine.buildUserPrompt(
          'translate',
          'Please review this document carefully.',
          { targetLanguage: code },
          undefined,
          'en-US',
        )
        expect(userPrompt).toContain(`Translate the entire text into ${expected}.`)
        expect(userPrompt).not.toContain(`into ${code}.`)

        // 3. Retry prompt
        const retryPrompt = engine.buildTaskSpecificRetryPrompt('translate', 'en-US', { targetLanguage: code })
        expect(retryPrompt).toContain(`Your task is to translate the text into ${expected}.`)
        expect(retryPrompt).not.toContain(`into ${code}.`)
      }
    })

    it('preserves already resolved human-readable language names in retry prompts', () => {
      const engine = createTestEngine()

      const retryPrompt = engine.buildTaskSpecificRetryPrompt('translate', 'en-US', { targetLanguage: 'Spanish' })
      expect(retryPrompt).toContain('Your task is to translate the text into Spanish.')

      const defaultRetryPrompt = engine.buildTaskSpecificRetryPrompt('translate', 'en-US')
      expect(defaultRetryPrompt).toContain('Your task is to translate the text into Hindi.')
    })
  })

  describe('6. Streaming and Cancellation', () => {
    it('streams token deltas through onTokenDelta callback', async () => {
      const receivedDeltas: string[] = []
      let finalAccumulated = ''

      const engine = createTestEngine({
        userConsentGranted: true,
        responses: ['Streamed chunk response text.'],
        onTokenDelta: (delta, accumulated) => {
          receivedDeltas.push(delta)
          finalAccumulated = accumulated
        },
      })

      const ctx = makeContext()
      const result = await engine.transform(ctx)

      expect(receivedDeltas.length).toBeGreaterThan(0)
      expect(finalAccumulated).toBe('Streamed chunk response text.')
      expect(result.proposedText).toBe('Streamed chunk response text.')
    })

    it('handles cancellation via AbortSignal cleanly', async () => {
      let interrupted = false
      mockEngine = createMockMLCEngine({
        onInterrupt: () => {
          interrupted = true
        },
      })

      const engine = createTestEngine({ userConsentGranted: true })
      const controller = new AbortController()

      // Abort immediately before call
      controller.abort()

      const ctx = makeContext()
      await expect(engine.transform(ctx, controller.signal)).rejects.toThrow(/operation was aborted/)

      // Abort during execution
      const controller2 = new AbortController()
      const slowEngine = createMockMLCEngine({
        onInterrupt: () => {
          interrupted = true
        },
      })
      // Override create to abort midway
      slowEngine.chat.completions.create = vi.fn().mockImplementation(async () => {
        async function* gen() {
          yield { choices: [{ delta: { content: 'start ' } }] }
          controller2.abort()
          throw new DOMException('The operation was aborted', 'AbortError')
        }
        return gen()
      })

      const engine2 = new LocalLlamaTransformationEngine({
        userConsentGranted: true,
        isWebGPUSupported: async () => true,
        engineFactory: async () => slowEngine,
        workerFactory: () => mockWorker,
      })

      await expect(engine2.transform(ctx, controller2.signal)).rejects.toThrow(/operation was aborted/)
      expect(interrupted).toBe(true)
      expect(engine2.getStatus().state).toBe('ready')
    })
  })

  describe('7. Concurrency Protection and Mutex', () => {
    it('prevents overlapping concurrent generations on single worker', async () => {
      const finishGenerationRef = { current: null as (() => void) | null }

      const slowEngine = createMockMLCEngine()
      slowEngine.chat.completions.create = vi.fn().mockImplementation(async () => {
        return (async function* () {
          await new Promise<void>((resolve) => {
            finishGenerationRef.current = resolve
          })
          yield { choices: [{ delta: { content: 'done' } }] }
        })()
      })

      const engine = new LocalLlamaTransformationEngine({
        userConsentGranted: true,
        isWebGPUSupported: async () => true,
        engineFactory: async () => slowEngine,
        workerFactory: () => mockWorker,
      })

      await engine.init()

      const ctx1 = makeContext({ requestId: 101 })
      const ctx2 = makeContext({ requestId: 102 })

      const promise1 = engine.transform(ctx1)

      // Immediate second call should reject with mutex busy error
      await expect(engine.transform(ctx2)).rejects.toThrow(/busy processing another request/)

      // Resolve the first generation
      finishGenerationRef.current?.()
      const res1 = await promise1
      expect(res1.proposedText).toBe('done')
    })
  })

  describe('8. Worker Crash and Device Loss Recovery', () => {
    it('cleans up worker resources and reports error state on hardware loss', async () => {
      const failingEngine = createMockMLCEngine()
      failingEngine.chat.completions.create = vi.fn().mockRejectedValue(new Error('WebGPU Device lost (disconnected)'))

      const engine = new LocalLlamaTransformationEngine({
        userConsentGranted: true,
        isWebGPUSupported: async () => true,
        engineFactory: async () => failingEngine,
        workerFactory: () => mockWorker,
      })

      const ctx = makeContext()
      await expect(engine.transform(ctx)).rejects.toThrow(/Device lost/)

      expect(mockWorker.terminate).toHaveBeenCalled()
      expect(engine.getStatus().state).toBe('error')
      expect(engine.getStatus().error).toContain('Device lost')
    })

    it('unloads model and terminates worker cleanly on explicit unload()', async () => {
      let unloaded = false
      mockEngine = createMockMLCEngine({
        onUnload: () => {
          unloaded = true
        },
      })

      const engine = createTestEngine({ userConsentGranted: true })
      await engine.init()
      expect(engine.getStatus().state).toBe('ready')

      await engine.unload()
      expect(unloaded).toBe(true)
      expect(mockWorker.terminate).toHaveBeenCalled()
      expect(engine.getStatus().state).toBe('unavailable')
    })
  })

  describe('9. Integration with AssistantOrchestrator and EngineRegistry', () => {
    it('successfully processes transformation requests through AssistantOrchestrator', async () => {
      const engine = createTestEngine({
        userConsentGranted: true,
        responses: ['Rewritten text through orchestrator.'],
      })

      const registry = new EngineRegistry()
      registry.register(engine)

      const orchestrator = new AssistantOrchestrator(registry)

      const request: GenerationRequest = {
        capability: 'rewrite',
        context: makeContext({
          languageTag: 'en-US',
          text: 'Original draft requiring polish.',
        }),
        isCurrent: () => true,
      }

      const outcome = await orchestrator.transform(request)
      expect(outcome.status).toBe('preview-ready')
      if (outcome.status === 'preview-ready') {
        expect(outcome.proposedText).toBe('Rewritten text through orchestrator.')
        expect(outcome.sourceText).toBe('Original draft requiring polish.')
        expect(outcome.explanation).toContain('Llama 3.2 1B')
      }
    })

    it('orchestrator detects stale document snapshots during local generation', async () => {
      let isSnapshotCurrent = true
      const engine = createTestEngine({ userConsentGranted: true })

      const registry = new EngineRegistry()
      registry.register(engine)

      const orchestrator = new AssistantOrchestrator(registry)

      const request: GenerationRequest = {
        capability: 'rewrite',
        context: makeContext(),
        isCurrent: () => isSnapshotCurrent,
      }

      // Mark snapshot as stale before running
      isSnapshotCurrent = false
      const outcome = await orchestrator.transform(request)
      expect(outcome.status).toBe('stale')
    })

    it('orchestrator propagates cancellation when user cancels generation', async () => {
      const engine = createTestEngine({ userConsentGranted: true })
      const registry = new EngineRegistry()
      registry.register(engine)

      const orchestrator = new AssistantOrchestrator(registry)
      const controller = new AbortController()
      controller.abort()

      const request: GenerationRequest = {
        capability: 'rewrite',
        context: makeContext(),
        signal: controller.signal,
        isCurrent: () => true,
      }

      const outcome = await orchestrator.transform(request)
      expect(outcome.status).toBe('cancelled')
    })
  })
})
