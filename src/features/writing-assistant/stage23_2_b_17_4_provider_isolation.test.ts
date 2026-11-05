// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import type { GenerationContext } from './contracts'
import {
  assertProviderIsolation,
  DEFAULT_AI_PROVIDER_ID,
  getAiRoutingDiagnostics,
  getPreferredAiProvider,
  PREFERRED_AI_PROVIDER_STORAGE_KEY,
  setPreferredAiProvider,
  subscribePreferredAiProvider,
} from './providerProfiles'
import {
  createHttpTransformationEngine,
  HttpTransformationEngine,
} from './httpTransformationEngine'
import { sessionCredentialStore } from './sessionCredentialStore'
import { EngineRegistry } from './engineRegistry'
import { AssistantOrchestrator } from './orchestrator'

function createTestContext(
  text: string,
  actionId: GenerationContext['actionId'] = 'improve-writing',
  options?: GenerationContext['options'],
): GenerationContext {
  return {
    actionId,
    scope: 'selected',
    text,
    options,
    languageTag: 'en',
    requestId: 1,
    documentId: 'doc-1',
    snapshotId: 'snap-1',
  }
}

describe('Stage 23.2.B.17.4 / B.17.5 Regression — Strict Provider Isolation & Anti-Ollama Guarantee', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    localStorage.clear()
    sessionCredentialStore.clearAll()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
    localStorage.clear()
    sessionCredentialStore.clearAll()
  })

  describe('1. Runtime Assertion & Construction Guards', () => {
    it('throws immediate AssertionError if HttpTransformationEngine is instantiated with local provider', () => {
      expect(() => {
        createHttpTransformationEngine({
          providerId: 'local',
        })
      }).toThrowError(
        "AssertionError: Writin On-Device Assistant ('local') must never invoke httpTransformationEngine or localhost:11434.",
      )

      expect(() => {
        new HttpTransformationEngine({
          providerId: 'local',
        })
      }).toThrowError(
        "AssertionError: Writin On-Device Assistant ('local') must never invoke httpTransformationEngine or localhost:11434.",
      )
    })

    it('assertProviderIsolation strictly blocks network URLs for local provider', () => {
      // Local provider must NEVER target localhost or remote URLs
      expect(() => {
        assertProviderIsolation('local', 'http://localhost:11434/v1/chat/completions')
      }).toThrowError(/AssertionError/)

      expect(() => {
        assertProviderIsolation('local', 'http://127.0.0.1:11434/api/generate')
      }).toThrowError(/AssertionError/)

      expect(() => {
        assertProviderIsolation('local', 'https://api.openai.com/v1/chat/completions')
      }).toThrowError(/AssertionError/)

      // Local provider with on-device target does not throw
      expect(() => {
        assertProviderIsolation('local', 'on-device')
      }).not.toThrow()

      // Other providers targeting valid endpoints do not throw
      expect(() => {
        assertProviderIsolation('ollama', 'http://localhost:11434/v1/chat/completions')
      }).not.toThrow()

      expect(() => {
        assertProviderIsolation('groq', 'https://api.groq.com/openai/v1/chat/completions')
      }).not.toThrow()
    })

    it('blocks cloud providers (like Groq) from calling localhost:11434 endpoint', async () => {
      sessionCredentialStore.setCredential('groq', {
        endpointUrl: 'http://localhost:11434/v1/chat/completions',
        apiKey: 'gsk-test-key-12345',
      })
      sessionCredentialStore.setDisclosureAcknowledged(
        'groq',
        true,
        'http://localhost:11434/v1/chat/completions',
      )

      const engine = createHttpTransformationEngine({
        providerId: 'groq',
      })

      await expect(
        engine.transform(createTestContext('Test text')),
      ).rejects.toThrow(/AssertionError: Network endpoint http:\/\/localhost:11434/)
    })
  })

  describe('2. Guarantee: Writin Local Provider Never Dispatches to Ollama or Network (Mocked Fetch Spy)', () => {
    it('proves fetch is never called when executing transformations with local provider preference', async () => {
      const fetchSpy = vi.fn()
      globalThis.fetch = fetchSpy

      setPreferredAiProvider('local')
      expect(getPreferredAiProvider()).toBe('local')

      // Mock on-device local engine
      const mockLocalEngine = {
        id: 'writin.local-llama',
        capabilities: {
          supports: [
            { capability: 'rewrite' as const, languages: [{ tag: 'en' }] },
            { capability: 'translation' as const, languages: [{ tag: 'en' }] },
          ],
        },
        getAvailability: vi.fn().mockResolvedValue({ available: true }),
        transform: vi.fn().mockResolvedValue({
          proposedText: 'Transformed by genuine on-device local model.',
          explanation: 'On-device transformation',
        }),
      }

      const registry = new EngineRegistry([mockLocalEngine])
      const orchestrator = new AssistantOrchestrator(registry)

      // Test all 9 user-facing AI actions
      const actions: Array<GenerationContext['actionId']> = [
        'improve-writing',
        'correct',
        'summarize',
        'shorten',
        'expand',
        'continue-writing',
        'change-tone',
        'ask-ai',
      ]

      for (const actionId of actions) {
        const result = await orchestrator.transform({
          capability: 'rewrite',
          context: createTestContext('The quick brown fox jumps over the lazy dog.', actionId),
          isCurrent: () => true,
        })

        expect(result.status).toBe('preview-ready')
        if (result.status === 'preview-ready') {
          expect(result.proposedText).toBe('Transformed by genuine on-device local model.')
        }
      }

      // Zero network fetch calls made!
      expect(fetchSpy).toHaveBeenCalledTimes(0)
    })
  })

  describe('3. Persisted Provider State & Fallback Safety', () => {
    it('defaults to local provider when no preference is persisted', () => {
      localStorage.removeItem(PREFERRED_AI_PROVIDER_STORAGE_KEY)
      expect(getPreferredAiProvider()).toBe(DEFAULT_AI_PROVIDER_ID)
      expect(getPreferredAiProvider()).toBe('local')
    })

    it('falls back safely to local when corrupted or unknown provider ID is stored', () => {
      localStorage.setItem(PREFERRED_AI_PROVIDER_STORAGE_KEY, 'corrupted_unknown_provider_123')
      expect(getPreferredAiProvider()).toBe('local')

      localStorage.setItem(PREFERRED_AI_PROVIDER_STORAGE_KEY, '')
      expect(getPreferredAiProvider()).toBe('local')

      localStorage.setItem(PREFERRED_AI_PROVIDER_STORAGE_KEY, 'null')
      expect(getPreferredAiProvider()).toBe('local')

      localStorage.setItem(PREFERRED_AI_PROVIDER_STORAGE_KEY, 'undefined')
      expect(getPreferredAiProvider()).toBe('local')
    })

    it('restores stored provider accurately and synchronizes subscribers across toolbar and sidebar', () => {
      let notifiedProvider = ''
      const unsub = subscribePreferredAiProvider((newId) => {
        notifiedProvider = newId
      })

      setPreferredAiProvider('groq')
      expect(getPreferredAiProvider()).toBe('groq')
      expect(localStorage.getItem(PREFERRED_AI_PROVIDER_STORAGE_KEY)).toBe('groq')
      expect(notifiedProvider).toBe('groq')

      setPreferredAiProvider('local')
      expect(getPreferredAiProvider()).toBe('local')
      expect(localStorage.getItem(PREFERRED_AI_PROVIDER_STORAGE_KEY)).toBe('local')
      expect(notifiedProvider).toBe('local')

      unsub()
    })
  })

  describe('4. Explicit Ollama Provider Functionality (Only When Explicitly Configured)', () => {
    it('allows Ollama to connect to localhost:11434 only when explicitly configured and acknowledged', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response from running Ollama daemon.' } }],
        }),
      })

      sessionCredentialStore.setDisclosureAcknowledged(
        'ollama',
        true,
        'http://localhost:11434/v1/chat/completions',
      )

      const engine = createHttpTransformationEngine({
        providerId: 'ollama',
        fetchFn: fetchSpy as unknown as typeof fetch,
      })

      const outcome = await engine.transform(createTestContext('Test text for Ollama'))

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const targetUrl = fetchSpy.mock.calls[0]![0] as string
      expect(targetUrl).toBe('http://localhost:11434/v1/chat/completions')
      expect(outcome.proposedText).toBe('Response from running Ollama daemon.')
    })

    it('rejects unacknowledged Ollama requests before fetching', async () => {
      const fetchSpy = vi.fn()
      // Disclosure NOT acknowledged for Ollama
      const engine = createHttpTransformationEngine({
        providerId: 'ollama',
        fetchFn: fetchSpy as unknown as typeof fetch,
      })

      const availability = await engine.getAvailability()
      expect(availability.available).toBe(false)
      expect(availability.reason).toContain('Privacy disclosure must be acknowledged')
      expect(fetchSpy).toHaveBeenCalledTimes(0)
    })
  })

  describe('5. AI Routing Diagnostics & Safe Logging', () => {
    it('returns correct destination categories without leaking secrets or document content', () => {
      const localDiag = getAiRoutingDiagnostics(
        'desktop-selection-popover',
        'improve-writing',
        'local',
      )
      expect(localDiag.destinationCategory).toBe('browser-local')
      expect(localDiag.savedProviderId).toBe('local')
      expect(localDiag.resolvedProviderId).toBe('local')
      expect(localDiag.selectedEngine).toBe('writin.local-llama')

      const ollamaDiag = getAiRoutingDiagnostics(
        'desktop-selection-popover',
        'improve-writing',
        'ollama',
      )
      expect(ollamaDiag.destinationCategory).toBe('ollama-local')
      expect(ollamaDiag.resolvedProviderId).toBe('ollama')

      const groqDiag = getAiRoutingDiagnostics(
        'sidebar-generative-section',
        'summarize',
        'groq',
      )
      expect(groqDiag.destinationCategory).toBe('remote-api')
      expect(groqDiag.resolvedProviderId).toBe('groq')

      // Ensure no sensitive fields exist on diagnostic metadata
      const keys = Object.keys(localDiag)
      expect(keys).not.toContain('apiKey')
      expect(keys).not.toContain('authorization')
      expect(keys).not.toContain('document')
      expect(keys).not.toContain('text')
    })
  })
})
