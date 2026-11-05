// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateAndCleanGenerativeOutput } from './outputValidation'
import { createHttpTransformationEngine } from './httpTransformationEngine'
import { sessionCredentialStore } from './sessionCredentialStore'
import {
  getPreferredAiProvider,
  setPreferredAiProvider,
  getGenerationProviderProfile,
} from './providerProfiles'
import { LocalLlamaTransformationEngine } from './localLlamaEngine'
import type { GenerationContext, GenerativeActionId } from './contracts'

function createTestContext(text: string, actionId: GenerativeActionId = 'improve-writing'): GenerationContext {
  return {
    requestId: 1,
    documentId: 'doc1',
    snapshotId: 'doc1:1',
    languageTag: 'en',
    scope: 'selected',
    text,
    actionId,
  }
}

describe('Stage 23.2.B.17.5 Verification Suite', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionCredentialStore.clearAll()
  })

  describe('1. Translation Failure UX & Output Clearing', () => {
    it('rejects synthetic placeholder outputs with "तत्व" loops and consecutive repetitions', () => {
      const res = validateAndCleanGenerativeOutput({
        rawText: 'तत्व तत्व तत्व तत्व है।',
        actionId: 'translate',
        sourceText: 'Writin is a local-first writing workspace.',
        targetLanguage: 'Hindi',
      })
      expect(res.isValid).toBe(false)
      expect(res.errorCode).toBe('malformed')
      expect(res.errorMessage).toContain('repeated words')
    })

    it('rejects synthetic phrases matching \\bतत्व\\s+तत्व\\b', () => {
      const res = validateAndCleanGenerativeOutput({
        rawText: 'Writin एक तत्व तत्व कार्यक्षेत्र है',
        actionId: 'translate',
        sourceText: 'Writin is a local-first writing workspace.',
        targetLanguage: 'Hindi',
      })
      expect(res.isValid).toBe(false)
      expect(res.errorCode).toBe('malformed')
      expect(res.errorMessage).toContain('synthetic placeholder')
    })

    it('rejects high-frequency synthetic "तत्व" (> 25% of tokens) when not in source', () => {
      const res = validateAndCleanGenerativeOutput({
        rawText: 'यह तत्व सोच और तत्व लेखन के लिए तत्व बनाया गया तत्व है।',
        actionId: 'translate',
        sourceText: 'This is built for focused thinking and writing.',
        targetLanguage: 'Hindi',
      })
      expect(res.isValid).toBe(false)
      expect(res.errorCode).toBe('malformed')
      expect(res.errorMessage).toContain('synthetic placeholder')
    })
  })

  describe('2. Output Validation False-Positive Audit (Legitimate Inputs)', () => {
    it('accepts short legitimate Hindi sentences', () => {
      const cases = [
        { text: 'यह एक अच्छा दिन है।', source: 'This is a good day.' },
        { text: 'नमस्ते, आप कैसे हैं?', source: 'Hello, how are you?' },
        { text: 'आज का मौसम बहुत सुहावना है।', source: 'The weather today is very pleasant.' },
      ]

      for (const c of cases) {
        const res = validateAndCleanGenerativeOutput({
          rawText: c.text,
          actionId: 'translate',
          sourceText: c.source,
          targetLanguage: 'Hindi',
        })
        expect(res.isValid, `Failed for: ${c.text}`).toBe(true)
        expect(res.cleanedText).toBe(c.text)
      }
    })

    it('accepts meaningful Hindi reduplication and repeated words (द्विरुक्ति)', () => {
      const reduplicationCases = [
        { text: 'वह धीरे-धीरे आगे बढ़ रहा है।', source: 'He is moving forward slowly.' },
        { text: 'हमें बार-बार यह प्रयास करना चाहिए।', source: 'We should try this again and again.' },
        { text: 'सभी लोग साथ-साथ आगे बढ़े।', source: 'All people moved forward together.' },
        { text: 'समय-समय पर इसकी समीक्षा आवश्यक है।', source: 'Periodic review of this is necessary.' },
        { text: 'प्रत्येक विभाग के अलग-अलग नियम होते हैं।', source: 'Each department has different rules.' },
        { text: 'एक-एक करके सब लोग कमरे में आए।', source: 'One by one everyone came into the room.' },
      ]

      for (const c of reduplicationCases) {
        const res = validateAndCleanGenerativeOutput({
          rawText: c.text,
          actionId: 'translate',
          sourceText: c.source,
          targetLanguage: 'Hindi',
        })
        expect(res.isValid, `Failed for reduplication case: ${c.text} (error: ${res.errorMessage})`).toBe(true)
      }
    })

    it('accepts legitimate Hindi sentences containing the word "तत्व" (element) in natural context', () => {
      const res = validateAndCleanGenerativeOutput({
        rawText: 'प्रकृति के पाँच मुख्य तत्व होते हैं और प्रत्येक तत्व का अपना संतुलन है।',
        actionId: 'translate',
        sourceText: 'Nature has five main elements and each element has its own balance.',
        targetLanguage: 'Hindi',
      })
      expect(res.isValid).toBe(true)
      expect(res.cleanedText).toBe('प्रकृति के पाँच मुख्य तत्व होते हैं और प्रत्येक तत्व का अपना संतुलन है।')
    })

    it('accepts common business phrases in Hindi', () => {
      const businessCases = [
        {
          text: 'कृपया संलग्न दस्तावेज़ की समीक्षा करें और अपने सुझाव साझा करें।',
          source: 'Please review the attached document and share your feedback.',
        },
        {
          text: 'हमारी अगली बैठक कल सुबह दस बजे निर्धारित की गई है।',
          source: 'Our next meeting is scheduled for tomorrow at 10 AM.',
        },
        {
          text: 'परियोजना की समय-सीमा और गुणवत्ता पर विशेष ध्यान दिया जाना चाहिए।',
          source: 'Special attention should be paid to the project deadline and quality.',
        },
      ]

      for (const c of businessCases) {
        const res = validateAndCleanGenerativeOutput({
          rawText: c.text,
          actionId: 'translate',
          sourceText: c.source,
          targetLanguage: 'Hindi',
        })
        expect(res.isValid, `Failed for business case: ${c.text}`).toBe(true)
      }
    })

    it('accepts English sentences containing repeated function words and idioms', () => {
      const englishCases = [
        { text: 'It is what it is, isn\'t it?', source: 'यह वही है जो यह है।' },
        { text: 'To be or not to be, that is the question.', source: 'होना या न होना, यही प्रश्न है।' },
        { text: 'That that is is that that is not is not.', source: 'जो है सो है और जो नहीं है सो नहीं है।' },
        { text: 'He had had a cold before the trip.', source: 'यात्रा से पहले उसे ठंड लग गई थी।' },
      ]

      for (const c of englishCases) {
        const res = validateAndCleanGenerativeOutput({
          rawText: c.text,
          actionId: 'translate',
          sourceText: c.source,
          targetLanguage: 'English',
        })
        expect(res.isValid, `Failed for English case: ${c.text} (error: ${res.errorMessage})`).toBe(true)
      }
    })

    it('rejects degenerate repetition loops (negative regression cases)', () => {
      // 3+ consecutive duplicate content words
      const consecutiveRes = validateAndCleanGenerativeOutput({
        rawText: 'the the the book was placed on the shelf',
        actionId: 'translate',
        sourceText: 'वह पुस्तक मेज पर रखी थी।',
        targetLanguage: 'English',
      })
      expect(consecutiveRes.isValid).toBe(false)
      expect(consecutiveRes.errorCode).toBe('malformed')

      // Content word dominant loop (> 35%)
      const dominantRes = validateAndCleanGenerativeOutput({
        rawText: 'apple banana orange apple dog cat apple tree car apple',
        actionId: 'translate',
        sourceText: 'यह फलों और जानवरों की एक सामान्य सूची है।',
        targetLanguage: 'English',
      })
      expect(dominantRes.isValid).toBe(false)
      expect(dominantRes.errorCode).toBe('malformed')

      // 2-gram phrase loops in short output
      const bigramRes = validateAndCleanGenerativeOutput({
        rawText: 'हम चलेंगे हम चलेंगे हम चलेंगे आगे बढ़ेंगे',
        actionId: 'translate',
        sourceText: 'We will walk forward together.',
        targetLanguage: 'Hindi',
      })
      expect(bigramRes.isValid).toBe(false)
      expect(bigramRes.errorCode).toBe('malformed')
    })
  })

  describe('3. Local Model Verification & Provider Preferences', () => {
    it('persists preferred AI provider across reloads via localStorage', () => {
      expect(getPreferredAiProvider()).toBe('local')

      setPreferredAiProvider('ollama')
      expect(getPreferredAiProvider()).toBe('ollama')
      expect(localStorage.getItem('writin_preferred_ai_provider_v1')).toBe('ollama')

      setPreferredAiProvider('local')
      expect(getPreferredAiProvider()).toBe('local')
      expect(localStorage.getItem('writin_preferred_ai_provider_v1')).toBe('local')
    })

    it('guarantees local profile has zero network server requirement and does not call localhost:11434', () => {
      const localProfile = getGenerationProviderProfile('local')
      expect(localProfile).toBeDefined()
      expect(localProfile?.privacy.processingType).toBe('local')
      expect(localProfile?.defaultEndpoint).toBe('on-device')
      expect(localProfile?.defaultModel).toBe('on-device-llama')
    })

    it('enforces clear error when WebGPU is unsupported on device', async () => {
      const engine = new LocalLlamaTransformationEngine({
        isWebGPUSupported: async () => false,
      })

      const availability = await engine.getAvailability()
      expect(availability.available).toBe(false)
      expect(availability.reason).toContain('WebGPU is not supported')
    })

    it('requires explicit consent before model download is allowed', () => {
      const engine = new LocalLlamaTransformationEngine()
      expect(engine.hasUserConsent()).toBe(false)

      engine.grantUserConsent()
      expect(engine.hasUserConsent()).toBe(true)
    })
  })

  describe('4. External API Endpoint Handling & Diagnostics', () => {
    it('auto-normalizes bare /v1 base URLs to /chat/completions', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Rewritten text' } }] }),
      })

      sessionCredentialStore.setCredential('custom', {
        endpointUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test-mock-key-12345',
      })
      sessionCredentialStore.setDisclosureAcknowledged('custom', true, 'https://api.openai.com/v1')

      const engine = createHttpTransformationEngine({
        providerId: 'custom',
        fetchFn: fetchFn as unknown as typeof fetch,
      })

      await engine.transform(createTestContext('Test source sentence.'))

      expect(fetchFn).toHaveBeenCalledTimes(1)
      const calledUrl = fetchFn.mock.calls[0]![0] as string
      expect(calledUrl).toBe('https://api.openai.com/v1/chat/completions')
    })

    it('auto-normalizes bare Ollama base URL to /v1/chat/completions', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Ollama text' } }] }),
      })

      sessionCredentialStore.setDisclosureAcknowledged('ollama', true, 'http://localhost:11434')

      const engine = createHttpTransformationEngine({
        providerId: 'ollama',
        fetchFn: fetchFn as unknown as typeof fetch,
      })

      await engine.transform(createTestContext('Test source sentence.'))

      expect(fetchFn).toHaveBeenCalledTimes(1)
      const calledUrl = fetchFn.mock.calls[0]![0] as string
      expect(calledUrl).toBe('http://localhost:11434/v1/chat/completions')
    })

    it('preserves already complete provider endpoints without appending /chat/completions', async () => {
      const completeEndpoints = [
        'https://api.openai.com/v1/chat/completions',
        'http://localhost:11434/api/generate',
        'http://localhost:11434/api/chat',
        'https://custom-proxy.internal/v2/generate',
      ]

      for (const endpoint of completeEndpoints) {
        const fetchFn = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'Output' } }] }),
        })

        sessionCredentialStore.setCredential('custom', {
          endpointUrl: endpoint,
          apiKey: 'test-key',
        })
        sessionCredentialStore.setDisclosureAcknowledged('custom', true, endpoint)

        const engine = createHttpTransformationEngine({
          providerId: 'custom',
          fetchFn: fetchFn as unknown as typeof fetch,
        })

        await engine.transform(createTestContext('Test text.'))

        expect(fetchFn).toHaveBeenCalledTimes(1)
        expect(fetchFn.mock.calls[0]![0]).toBe(endpoint)
      }
    })

    it('parses Ollama native /api/chat and /api/generate response shapes in addition to OpenAI choices', async () => {
      // 1. Ollama /api/chat format: { message: { content: "..." } }
      const chatFetchFn = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: 'Chat output from Ollama' } }),
      })
      sessionCredentialStore.setCredential('ollama', { endpointUrl: 'http://localhost:11434/api/chat' })
      sessionCredentialStore.setDisclosureAcknowledged('ollama', true, 'http://localhost:11434/api/chat')

      const chatEngine = createHttpTransformationEngine({
        providerId: 'ollama',
        fetchFn: chatFetchFn as unknown as typeof fetch,
      })

      const chatResult = await chatEngine.transform(createTestContext('Some input text.'))
      expect(chatResult.proposedText).toBe('Chat output from Ollama')

      // 2. Ollama /api/generate format: { response: "..." }
      const genFetchFn = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: 'Generate output from Ollama' }),
      })
      sessionCredentialStore.setCredential('ollama', { endpointUrl: 'http://localhost:11434/api/generate' })
      sessionCredentialStore.setDisclosureAcknowledged('ollama', true, 'http://localhost:11434/api/generate')

      const genEngine = createHttpTransformationEngine({
        providerId: 'ollama',
        fetchFn: genFetchFn as unknown as typeof fetch,
      })

      const genResult = await genEngine.transform(createTestContext('Some input text.'))
      expect(genResult.proposedText).toBe('Generate output from Ollama')
    })

    it('redacts API keys and Bearer tokens in error messages', async () => {
      const secretKey = 'sk-super-secret-production-key-998877'
      const fetchFn = vi.fn().mockRejectedValue(new Error(`Server error with key: ${secretKey}`))

      sessionCredentialStore.setCredential('custom', {
        endpointUrl: 'https://api.openai.com/v1',
        apiKey: secretKey,
      })
      sessionCredentialStore.setDisclosureAcknowledged('custom', true, 'https://api.openai.com/v1')

      const engine = createHttpTransformationEngine({
        providerId: 'custom',
        fetchFn: fetchFn as unknown as typeof fetch,
      })

      await expect(
        engine.transform(createTestContext('Some text.')),
      ).rejects.toThrowError(/\[REDACTED\]/)

      // Ensure secret key never appears in plain text
      try {
        await engine.transform(createTestContext('Some text.'))
      } catch (err) {
        expect((err as Error).message).not.toContain(secretKey)
      }
    })
  })
})
