// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getPreferredAiProvider,
  setPreferredAiProvider,
  subscribePreferredAiProvider,
  PREFERRED_AI_PROVIDER_STORAGE_KEY,
  DEFAULT_AI_PROVIDER_ID,
} from './providerProfiles'
import { sessionCredentialStore } from './sessionCredentialStore'
import { handleWorkerMessage, resetWorkerStateForTests } from './bergamot.worker'
import type { WorkerRequest, WorkerResponse, ModelBuffers } from './bergamotTypes'
import { EXACT_SCREENSHOT_PARAGRAPH, BERGAMOT_OBSERVED_OUTPUT } from './bergamotFixtures'
import { validateAndCleanGenerativeOutput } from './outputValidation'
import { BergamotTransformationEngine, BergamotEngineError } from './bergamotEngine'
import { BergamotWorkerClient } from './bergamotWorkerClient'
import { ModelAssetManager } from './modelAssetManager'

function createValidBuffers(): ModelBuffers {
  return {
    model: new ArrayBuffer(150_000),
    lex: new ArrayBuffer(25_000),
    vocab: new ArrayBuffer(5_000),
  }
}

describe('Stage 23.2.B.17.1 — Local Translation Failure & Persistent Provider Preference', () => {
  describe('Issue 2: Persistent AI Provider Preference', () => {
    beforeEach(() => {
      window.localStorage.clear()
      sessionCredentialStore.clearAll()
    })

    it('defaults to "local" when no preference is stored', () => {
      expect(getPreferredAiProvider()).toBe(DEFAULT_AI_PROVIDER_ID)
    })

    it('persists preferred provider in localStorage under the designated key', () => {
      setPreferredAiProvider('groq')
      expect(getPreferredAiProvider()).toBe('groq')
      expect(window.localStorage.getItem(PREFERRED_AI_PROVIDER_STORAGE_KEY)).toBe('groq')
    })

    it('broadcasts provider preference changes to all active listeners', () => {
      const listener = vi.fn()
      const unsub = subscribePreferredAiProvider(listener)

      setPreferredAiProvider('gemini')
      expect(listener).toHaveBeenCalledWith('gemini')

      setPreferredAiProvider('local')
      expect(listener).toHaveBeenCalledWith('local')

      unsub()
      setPreferredAiProvider('ollama')
      expect(listener).toHaveBeenCalledTimes(2)
    })

    it('separates non-secret provider preference from session-only API keys', () => {
      // 1. Store preference
      setPreferredAiProvider('groq')
      // 2. Store credential in session store
      sessionCredentialStore.setCredential('groq', {
        apiKey: 'gsk_test_secret_key_12345',
        endpointUrl: 'https://api.groq.com/openai/v1',
      })

      // Preference is stored in localStorage
      expect(window.localStorage.getItem(PREFERRED_AI_PROVIDER_STORAGE_KEY)).toBe('groq')
      // API Key is NEVER stored in localStorage
      expect(window.localStorage.getItem('gsk_test_secret_key_12345')).toBeNull()
      expect(JSON.stringify(window.localStorage)).not.toContain('gsk_test_secret_key_12345')

      // API Key is preserved in session store
      expect(sessionCredentialStore.getCredential('groq')?.apiKey).toBe('gsk_test_secret_key_12345')
    })
  })

  describe('Issue 1: Local Hindi Translation & Regression Reproduction', () => {
    let responses: WorkerResponse[]
    const send = (req: WorkerRequest) => handleWorkerMessage(req, (resp) => responses.push(resp))

    beforeEach(() => {
      responses = []
      resetWorkerStateForTests()
    })

    it('proves screenshot paragraph CANNOT trigger canned translation when real WASM runtime is unavailable', async () => {
      // 1. Initialize worker with valid buffers
      await send({
        type: 'INIT',
        requestId: 'req_init_screenshot',
        directions: ['en-hi'],
        buffers: { 'en-hi': createValidBuffers() },
      })
      expect(responses[0]?.type).toBe('INIT_SUCCESS')

      // 2. Translate exact 509-character paragraph reported in user screenshot
      responses = []
      await send({
        type: 'TRANSLATE',
        requestId: 'req_tr_screenshot',
        direction: 'en-hi',
        text: EXACT_SCREENSHOT_PARAGRAPH,
      })

      expect(responses.length).toBe(1)
      const trResp = responses[0]
      // Must return typed TRANSLATION_ENGINE_UNAVAILABLE error instead of canned output!
      expect(trResp?.type).toBe('ERROR')
      if (trResp?.type === 'ERROR') {
        expect(trResp.code).toBe('TRANSLATION_ENGINE_UNAVAILABLE')
      }

      // 3. Output validation rejects any synthetic repetitive output like "तत्व"
      const validation = validateAndCleanGenerativeOutput({
        rawText: 'तत्व तत्व तत्व तत्व है।',
        actionId: 'translate',
        sourceText: EXACT_SCREENSHOT_PARAGRAPH,
        targetLanguage: 'Hindi',
        languageTag: 'en',
      })
      expect(validation.isValid).toBe(false)
      expect(validation.errorCode).toBe('malformed')
    })

    it('proves hi-en translation CANNOT trigger canned static response when real WASM is unavailable', async () => {
      await send({
        type: 'INIT',
        requestId: 'req_init_hien',
        directions: ['hi-en'],
        buffers: { 'hi-en': createValidBuffers() },
      })

      responses = []
      await send({
        type: 'TRANSLATE',
        requestId: 'req_tr_hien',
        direction: 'hi-en',
        text: BERGAMOT_OBSERVED_OUTPUT,
      })

      expect(responses.length).toBe(1)
      const trResp = responses[0]
      // Must return typed TRANSLATION_ENGINE_UNAVAILABLE error instead of canned static text
      expect(trResp?.type).toBe('ERROR')
      if (trResp?.type === 'ERROR') {
        expect(trResp.code).toBe('TRANSLATION_ENGINE_UNAVAILABLE')
      }
    })

    it('captures structured error codes and contexts when errors occur in Bergamot Engine', async () => {
      const mockWorkerClient = {
        getStatus: vi.fn(() => 'ready'),
        isReady: vi.fn(() => true),
        initialize: vi.fn(async () => ({ directions: ['en-hi'], latencyMs: 20 })),
        translate: vi.fn(async () => {
          throw new Error('Inference memory allocation failure')
        }),
        cancel: vi.fn(async () => {}),
        terminate: vi.fn(async () => {}),
      } as unknown as BergamotWorkerClient

      const mockAssetManager = {
        estimateStorage: vi.fn(async () => ({ supported: true, isSufficient: true })),
        isModelCached: vi.fn(async () => true),
        getCachedModelBuffers: vi.fn(async () => createValidBuffers()),
      } as unknown as ModelAssetManager

      const engine = new BergamotTransformationEngine({
        workerClient: mockWorkerClient,
        assetManager: mockAssetManager,
      })

      await expect(
        engine.transform({
          requestId: 1,
          documentId: 'doc-test',
          snapshotId: 'snap-1',
          languageTag: 'en',
          text: 'Hello world',
          actionId: 'translate',
          scope: 'selected',
          options: { targetLanguage: 'Hindi' },
        })
      ).rejects.toThrowError(BergamotEngineError)
    })
  })

  describe('Issue 4: Clean, Non-Cloud-Suggesting Error Messages', () => {
    it('does not suggest using a cloud provider when local translation fails', () => {
      // Intentionally pass an untranslated echo
      const result = validateAndCleanGenerativeOutput({
        rawText: 'This is a long English text that should have been translated into Hindi.',
        actionId: 'translate',
        sourceText: 'This is a long English text that should have been translated into Hindi.',
        targetLanguage: 'Hindi',
        languageTag: 'en',
      })

      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe('untranslated')
      // Must NOT suggest using a cloud provider
      expect(result.errorMessage).not.toContain('using a cloud provider')
      expect(result.errorMessage).toContain('The local model could not complete the translation to Hindi')
    })

    it('rejects wrong-language Latin text when target is Hindi without cloud suggestion', () => {
      const result = validateAndCleanGenerativeOutput({
        rawText: 'I am happy to help you with anything else you need today.',
        actionId: 'translate',
        sourceText: 'We should begin the work immediately tomorrow.',
        targetLanguage: 'Hindi',
        languageTag: 'en',
      })

      expect(result.isValid).toBe(false)
      expect(result.errorCode).toBe('wrong-language')
      expect(result.errorMessage).not.toContain('using a cloud provider')
      expect(result.errorMessage).toContain('produced an English or wrong-language response instead of Hindi')
    })
  })
})
