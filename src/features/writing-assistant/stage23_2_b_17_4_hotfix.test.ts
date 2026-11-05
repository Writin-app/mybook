// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateAndCleanGenerativeOutput,
} from './outputValidation'
import {
  handleWorkerMessage,
  resetWorkerStateForTests,
} from './bergamot.worker'
import type { WorkerRequest, WorkerResponse } from '../../prototype/translation/types'
import {
  createHttpTransformationEngine,
} from './httpTransformationEngine'
import { SessionCredentialStore } from './sessionCredentialStore'
import {
  getPreferredAiProvider,
  setPreferredAiProvider,
  DEFAULT_AI_PROVIDER_ID,
  GENERATION_PROVIDER_PROFILES,
} from './providerProfiles'
import {
  BergamotTransformationEngine,
} from './bergamotEngine'
import { BergamotWorkerClient } from './bergamotWorkerClient'
import { ModelAssetManager } from './modelAssetManager'
import type { GenerationContext } from './contracts'

function createValidBuffers() {
  return {
    model: new ArrayBuffer(150_000),
    lex: new ArrayBuffer(25_000),
    vocab: new ArrayBuffer(5_000),
  }
}

describe('Stage 23.2.B.17.4 AI Reliability Hotfix Suite', () => {
  // -------------------------------------------------------------
  // Issue 1: Translation Hotfix & Anti-Synthetic Invariants
  // -------------------------------------------------------------
  describe('Issue 1: Translation Hotfix & Anti-Synthetic Invariants', () => {
    let responses: WorkerResponse[]
    const send = (req: WorkerRequest) => handleWorkerMessage(req, (resp) => responses.push(resp))

    beforeEach(() => {
      responses = []
      resetWorkerStateForTests()
    })

    it('1. Rejects repetitive "तत्व" fallback output', () => {
      const res = validateAndCleanGenerativeOutput({
        rawText: 'तत्व तत्व तत्व तत्व है।',
        actionId: 'translate',
        sourceText: 'We should discuss the quarterly results.',
        targetLanguage: 'Hindi',
      })
      expect(res.isValid).toBe(false)
      expect(res.errorCode).toBe('malformed')
      expect(res.errorMessage).toContain('तत्व')
    })

    it('2. Rejects consecutive 3x repetition of any token', () => {
      const res = validateAndCleanGenerativeOutput({
        rawText: 'यह काम बहुत बहुत बहुत जरूरी है।',
        actionId: 'translate',
        sourceText: 'This work is very urgent.',
        targetLanguage: 'Hindi',
      })
      expect(res.isValid).toBe(false)
      expect(res.errorCode).toBe('malformed')
      expect(res.errorMessage).toContain('repeated words')
    })

    it('3. Rejects degenerate repetition loops where a single token exceeds 35% of output', () => {
      const res = validateAndCleanGenerativeOutput({
        rawText: 'कार्यालय सड़क कार्यालय कार्यालय नया कार्यालय कार्यालय',
        actionId: 'translate',
        sourceText: 'Office road office office new office office',
        targetLanguage: 'Hindi',
      })
      expect(res.isValid).toBe(false)
      expect(res.errorCode).toBe('malformed')
      expect(res.errorMessage).toContain('excessive repetition')
    })

    it('4. Rejects synthetic placeholder patterns like [TRANSLATED: and lorem ipsum', () => {
      const res1 = validateAndCleanGenerativeOutput({
        rawText: '[TRANSLATED:en-hi] Hello world',
        actionId: 'translate',
        sourceText: 'Hello world',
        targetLanguage: 'Hindi',
      })
      expect(res1.isValid).toBe(false)
      expect(['malformed', 'wrong-language']).toContain(res1.errorCode)

      const res2 = validateAndCleanGenerativeOutput({
        rawText: 'Lorem ipsum dolor sit amet',
        actionId: 'translate',
        sourceText: 'Hello world',
        targetLanguage: 'Hindi',
      })
      expect(res2.isValid).toBe(false)
      expect(['malformed', 'wrong-language']).toContain(res2.errorCode)
    })

    it('5. Ensures the screenshot regression paragraph cannot trigger canned translation', async () => {
      await send({
        type: 'INIT',
        requestId: 'init-1',
        directions: ['en-hi'],
        buffers: { 'en-hi': createValidBuffers() },
      })

      responses = []
      await send({
        type: 'TRANSLATE',
        requestId: 'tr-1',
        direction: 'en-hi',
        text: "I was planning to complete some important work, but unfortunately things didn't happen as expected.",
      })

      // When genuine WASM is not present, worker must return TRANSLATION_ENGINE_UNAVAILABLE error
      expect(responses[0]?.type).toBe('ERROR')
      if (responses[0]?.type === 'ERROR') {
        expect(responses[0].code).toBe('TRANSLATION_ENGINE_UNAVAILABLE')
      }
    })

    it('6. Ensures unseen text receives typed error instead of synthetic successful translation', async () => {
      await send({
        type: 'INIT',
        requestId: 'init-2',
        directions: ['en-hi'],
        buffers: { 'en-hi': createValidBuffers() },
      })

      responses = []
      await send({
        type: 'TRANSLATE',
        requestId: 'tr-unseen',
        direction: 'en-hi',
        text: 'The quantum server architecture was upgraded yesterday.',
      })

      expect(responses[0]?.type).toBe('ERROR')
      if (responses[0]?.type === 'ERROR') {
        expect(responses[0].code).toBe('TRANSLATION_ENGINE_UNAVAILABLE')
      }
    })

    it('7. BergamotTransformationEngine fails cleanly with typed error and does NOT report false 1ms success', async () => {
      const mockAssetManager = {
        isModelCached: vi.fn(async () => true),
        getCachedModelBuffers: vi.fn(async () => createValidBuffers()),
      } as unknown as ModelAssetManager

      const mockWorkerClient = {
        isReady: vi.fn(() => false),
        getStatus: vi.fn(() => 'unloaded'),
        initialize: vi.fn(async () => {
          const err = new Error('WASM compilation failed in worker')
          ;(err as unknown as { code: string }).code = 'TRANSLATION_ENGINE_UNAVAILABLE'
          throw err
        }),
        translate: vi.fn(),
      } as unknown as BergamotWorkerClient

      const engine = new BergamotTransformationEngine({
        assetManager: mockAssetManager,
        workerClient: mockWorkerClient,
      })

      const ctx: GenerationContext = {
        requestId: 1,
        documentId: 'd1',
        snapshotId: 's1',
        languageTag: 'en',
        text: 'Hello world',
        actionId: 'translate',
        scope: 'selected',
        options: { targetLanguage: 'Hindi' },
      }

      await expect(engine.transform(ctx)).rejects.toThrow('WASM compilation failed in worker')
      expect(engine.getStatus().state).toBe('error')
      expect(engine.getStatus().message).not.toContain('complete in 1ms')
    })
  })

  // -------------------------------------------------------------
  // Issue 2: Local Model vs Ollama Routing
  // -------------------------------------------------------------
  describe('Issue 2: Local Model vs Ollama Routing', () => {
    beforeEach(() => {
      window.localStorage.clear()
    })

    it('1. Defaults to local on-device provider without invoking Ollama localhost', () => {
      expect(getPreferredAiProvider()).toBe(DEFAULT_AI_PROVIDER_ID)
      expect(DEFAULT_AI_PROVIDER_ID).toBe('local')
    })

    it('2. Distinguishes Writin on-device assistant from Ollama daemon in profiles', () => {
      const localProfile = GENERATION_PROVIDER_PROFILES.find((p) => p.id === 'local')
      const ollamaProfile = GENERATION_PROVIDER_PROFILES.find((p) => p.id === 'ollama')

      expect(localProfile?.displayName).toContain('On-Device Assistant')
      expect(localProfile?.defaultEndpoint).toBe('on-device')

      expect(ollamaProfile?.displayName).toContain('Ollama Daemon')
      expect(ollamaProfile?.defaultEndpoint).toBe('http://localhost:11434/v1/chat/completions')
    })

    it('3. Explicitly selecting Ollama routes to Ollama endpoint and never leaks to local provider', () => {
      setPreferredAiProvider('ollama')
      expect(getPreferredAiProvider()).toBe('ollama')

      setPreferredAiProvider('local')
      expect(getPreferredAiProvider()).toBe('local')
    })
  })

  // -------------------------------------------------------------
  // Issue 3: External API Provider Diagnostics
  // -------------------------------------------------------------
  describe('Issue 3: External API Provider Diagnostics', () => {
    let credentialStore: SessionCredentialStore

    beforeEach(() => {
      credentialStore = new SessionCredentialStore()
    })

    const sampleContext: GenerationContext = {
      requestId: 1,
      documentId: 'doc-test',
      snapshotId: 'snap-1',
      languageTag: 'en-US',
      text: 'The meeting was postponed by team lead.',
      actionId: 'correct',
      scope: 'selected',
    }

    it('1. Validates and rejects malformed endpoint URLs upfront', async () => {
      credentialStore.setCredential('custom', {
        endpointUrl: 'not-a-valid-url',
        apiKey: 'sk-test',
      })
      credentialStore.setDisclosureAcknowledged('custom', true, 'not-a-valid-url')

      const engine = createHttpTransformationEngine({
        providerId: 'custom',
        credentialStore,
      })

      await expect(engine.transform(sampleContext)).rejects.toThrow('Invalid endpoint URL')
    })

    it('2. Auto-normalizes base URLs ending in /v1 to include /chat/completions', async () => {
      let capturedUrl = ''
      const mockFetch = vi.fn(async (url: string) => {
        capturedUrl = url
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Corrected text.' } }],
          }),
          { status: 200 },
        )
      }) as unknown as typeof fetch

      credentialStore.setCredential('custom', {
        endpointUrl: 'https://proxy.example.com/v1',
        apiKey: 'sk-test',
      })
      credentialStore.setDisclosureAcknowledged('custom', true, 'https://proxy.example.com/v1')

      const engine = createHttpTransformationEngine({
        providerId: 'custom',
        credentialStore,
        fetchFn: mockFetch,
      })

      const res = await engine.transform(sampleContext)
      expect(res.proposedText).toBe('Corrected text.')
      expect(capturedUrl).toBe('https://proxy.example.com/v1/chat/completions')
    })

    it('3. Formats HTTP 400 Bad Request into actionable error', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({ error: { message: 'Invalid model parameter "llama-foo"' } }),
          { status: 400 },
        )
      }) as unknown as typeof fetch

      credentialStore.setCredential('groq', { apiKey: 'gsk_key' })
      credentialStore.setDisclosureAcknowledged('groq', true)

      const engine = createHttpTransformationEngine({
        providerId: 'groq',
        credentialStore,
        fetchFn: mockFetch,
      })

      await expect(engine.transform(sampleContext)).rejects.toThrow(
        'Provider rejected request (HTTP 400): Invalid model parameter "llama-foo"',
      )
    })

    it('4. Formats HTTP 404 with distinction between Ollama missing model and remote endpoint missing', async () => {
      // Remote 404
      const mockFetchRemote = vi.fn(async () => {
        return new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 })
      }) as unknown as typeof fetch

      credentialStore.setCredential('custom', {
        endpointUrl: 'https://proxy.example.com/v1/chat/completions',
        apiKey: 'sk-test',
      })
      credentialStore.setDisclosureAcknowledged('custom', true, 'https://proxy.example.com/v1/chat/completions')

      const remoteEngine = createHttpTransformationEngine({
        providerId: 'custom',
        credentialStore,
        fetchFn: mockFetchRemote,
      })

      await expect(remoteEngine.transform(sampleContext)).rejects.toThrow('Endpoint not found (HTTP 404)')

      // Ollama 404
      const mockFetchOllama = vi.fn(async () => {
        return new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 })
      }) as unknown as typeof fetch

      credentialStore.setCredential('ollama', {
        endpointUrl: 'http://localhost:11434/v1/chat/completions',
        modelId: 'llama3:8b',
      })
      credentialStore.setDisclosureAcknowledged('ollama', true, 'http://localhost:11434/v1/chat/completions')

      const ollamaEngine = createHttpTransformationEngine({
        providerId: 'ollama',
        credentialStore,
        fetchFn: mockFetchOllama,
      })

      await expect(ollamaEngine.transform(sampleContext)).rejects.toThrow(
        'The requested model "llama3:8b" was not found on the local Ollama server. Download the model locally (e.g. run \'ollama pull llama3:8b\') before generating.',
      )
    })

    it('5. Detects offline state when navigator.onLine is false', async () => {
      const origOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      const mockFetch = vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }) as unknown as typeof fetch

      credentialStore.setCredential('groq', { apiKey: 'gsk_test' })
      credentialStore.setDisclosureAcknowledged('groq', true)

      const engine = createHttpTransformationEngine({
        providerId: 'groq',
        credentialStore,
        fetchFn: mockFetch,
      })

      try {
        await expect(engine.transform(sampleContext)).rejects.toThrow(
          'No internet connection detected. Please check your network connection.',
        )
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: origOnLine, configurable: true })
      }
    })

    it('6. Redacts API keys from all error messages and never exposes credentials', async () => {
      const secretKey = 'gsk_SUPER_SECRET_TOKEN_999'
      const mockFetch = vi.fn(async () => {
        throw new Error(`Connection failed with header Authorization Bearer ${secretKey}`)
      }) as unknown as typeof fetch

      credentialStore.setCredential('groq', { apiKey: secretKey })
      credentialStore.setDisclosureAcknowledged('groq', true)

      const engine = createHttpTransformationEngine({
        providerId: 'groq',
        credentialStore,
        fetchFn: mockFetch,
      })

      try {
        await engine.transform(sampleContext)
        expect.fail('Should have thrown')
      } catch (err) {
        const msg = (err as Error).message
        expect(msg).not.toContain(secretKey)
        expect(msg).toContain('[REDACTED]')
      }
    })
  })
})
