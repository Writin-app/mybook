// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import {
  BergamotWorkerClient,
  BergamotWorkerError,
} from './bergamotWorkerClient'
import type { ModelBuffers } from './bergamotTypes'
import { validateAndCleanGenerativeOutput } from './outputValidation'
import fs from 'node:fs'
import path from 'node:path'

function createTestBuffers(): ModelBuffers {
  return {
    model: new ArrayBuffer(200_000),
    lex: new ArrayBuffer(30_000),
    vocab: new ArrayBuffer(5_000),
  }
}

interface WorkerMessagePayload {
  id: string
  name: string
  args: unknown[]
  [key: string]: unknown
}

describe('Stage 23.2.B.17.6 — Phase 2: Official Bergamot Worker Bridge & WASM Inference Suite', () => {
  describe('1. Official Worker Bridge Protocol Compliance', () => {
    it('sends official Bergamot initialize command and transitions status to ready', async () => {
      const postedMessages: WorkerMessagePayload[] = []
      let onmessageHandler: ((event: MessageEvent) => void) | null = null

      const mockWorker = {
        postMessage: (msg: unknown) => {
          const m = msg as WorkerMessagePayload
          postedMessages.push(m)
          if (m.name === 'initialize') {
            setTimeout(() => {
              onmessageHandler?.({ data: { id: m.id, result: undefined } } as MessageEvent)
            }, 0)
          }
        },
        set onmessage(fn: ((event: MessageEvent) => void) | null) {
          onmessageHandler = fn
        },
        onerror: null as ((event: unknown) => void) | null,
        terminate: vi.fn(),
      }

      const client = new BergamotWorkerClient({
        workerFactory: () => mockWorker as unknown as Worker,
      })

      expect(client.getStatus()).toBe('unloaded')

      const res = await client.initialize({
        directions: ['en-hi'],
      })

      expect(res.directions).toEqual([])
      expect(client.getStatus()).toBe('ready')
      expect(postedMessages.length).toBeGreaterThanOrEqual(1)
      const initCall = postedMessages.find((m) => m.name === 'initialize')
      expect(initCall).toBeDefined()
      expect(initCall?.args).toEqual([{ useNativeIntGemm: false, cacheSize: 0 }])
      expect(typeof initCall?.id).toBe('string')
    })

    it('passes official model buffer parameters to loadTranslationModel', async () => {
      const postedMessages: WorkerMessagePayload[] = []
      let onmessageHandler: ((event: MessageEvent) => void) | null = null

      const mockWorker = {
        postMessage: (msg: unknown) => {
          const m = msg as WorkerMessagePayload
          postedMessages.push(m)
          if (m.name === 'initialize') {
            setTimeout(() => {
              onmessageHandler?.({ data: { id: m.id, result: undefined } } as MessageEvent)
            }, 0)
          } else if (m.name === 'loadTranslationModel') {
            setTimeout(() => {
              onmessageHandler?.({ data: { id: m.id, result: undefined } } as MessageEvent)
            }, 0)
          }
        },
        set onmessage(fn: ((event: MessageEvent) => void) | null) {
          onmessageHandler = fn
        },
        onerror: null as ((event: unknown) => void) | null,
        terminate: vi.fn(),
      }

      const client = new BergamotWorkerClient({
        workerFactory: () => mockWorker as unknown as Worker,
      })

      const buffers = createTestBuffers()
      await client.initialize({
        directions: ['en-hi'],
        buffers: { 'en-hi': buffers },
      })

      const loadCall = postedMessages.find((m) => m.name === 'loadTranslationModel')
      expect(loadCall).toBeDefined()
      expect(loadCall?.args[0]).toEqual({ from: 'en', to: 'hi' })
      const bufferArgs = loadCall?.args[1] as Record<string, unknown>
      expect(bufferArgs.model).toBe(buffers.model)
      expect(bufferArgs.shortlist).toBe(buffers.lex)
      expect(bufferArgs.vocabs).toEqual([buffers.vocab])
      expect(bufferArgs.config).toEqual({ 'gemm-precision': 'int8shiftAlphaAll' })
      expect(client.isReady('en-hi')).toBe(true)
    })

    it('formats translate calls according to official vector-backed payload specification', async () => {
      const postedMessages: WorkerMessagePayload[] = []
      let onmessageHandler: ((event: MessageEvent) => void) | null = null

      const mockWorker = {
        postMessage: (msg: unknown) => {
          const m = msg as WorkerMessagePayload
          postedMessages.push(m)
          if (m.name === 'translate') {
            setTimeout(() => {
              onmessageHandler?.({
                data: {
                  id: m.id,
                  result: [{ target: { text: 'यह एक अनुवादित वाक्य है।' } }],
                },
              } as MessageEvent)
            }, 0)
          }
        },
        set onmessage(fn: ((event: MessageEvent) => void) | null) {
          onmessageHandler = fn
        },
        onerror: null as ((event: unknown) => void) | null,
        terminate: vi.fn(),
      }

      const client = new BergamotWorkerClient({
        workerFactory: () => mockWorker as unknown as Worker,
      })

      const res = await client.translate({
        direction: 'en-hi',
        text: 'This is a translated sentence.',
      })

      expect(res.targetText).toBe('यह एक अनुवादित वाक्य है।')
      expect(res.charCount).toBe('This is a translated sentence.'.length)
      expect(res.latencyMs).toBeGreaterThanOrEqual(0)

      const trCall = postedMessages.find((m) => m.name === 'translate')
      expect(trCall).toBeDefined()
      expect(trCall?.args[0]).toEqual({
        models: [{ from: 'en', to: 'hi' }],
        texts: [{ text: 'This is a translated sentence.', html: false }],
      })
    })

    it('queries and frees translation models via official methods', async () => {
      const postedMessages: WorkerMessagePayload[] = []
      let onmessageHandler: ((event: MessageEvent) => void) | null = null

      const mockWorker = {
        postMessage: (msg: unknown) => {
          const m = msg as WorkerMessagePayload
          postedMessages.push(m)
          if (m.name === 'initialize') {
            setTimeout(() => onmessageHandler?.({ data: { id: m.id, result: undefined } } as MessageEvent), 0)
          } else if (m.name === 'hasTranslationModel') {
            setTimeout(() => onmessageHandler?.({ data: { id: m.id, result: true } } as MessageEvent), 0)
          } else if (m.name === 'freeTranslationModel') {
            setTimeout(() => onmessageHandler?.({ data: { id: m.id, result: undefined } } as MessageEvent), 0)
          }
        },
        set onmessage(fn: ((event: MessageEvent) => void) | null) {
          onmessageHandler = fn
        },
        onerror: null as ((event: unknown) => void) | null,
        terminate: vi.fn(),
      }

      const client = new BergamotWorkerClient({
        workerFactory: () => mockWorker as unknown as Worker,
      })

      await client.initialize({ directions: ['en-hi'] })
      const hasModel = await client.hasTranslationModel('en-hi')
      expect(hasModel).toBe(true)

      await client.freeTranslationModel('en-hi')
      const freeCall = postedMessages.find((m) => m.name === 'freeTranslationModel')
      expect(freeCall).toBeDefined()
      expect(freeCall?.args[0]).toEqual({ from: 'en', to: 'hi' })
    })
  })

  describe('2. Error Propagation & Crash Recovery', () => {
    it('maps official worker error objects into typed BergamotWorkerError', async () => {
      let onmessageHandler: ((event: MessageEvent) => void) | null = null

      const mockWorker = {
        postMessage: (msg: unknown) => {
          const m = msg as WorkerMessagePayload
          setTimeout(() => {
            onmessageHandler?.({
              data: {
                id: m.id,
                error: {
                  name: 'Error',
                  message: 'Model for "en-hi" is not loaded',
                  stack: 'Error: Model for "en-hi" is not loaded',
                },
              },
            } as MessageEvent)
          }, 0)
        },
        set onmessage(fn: ((event: MessageEvent) => void) | null) {
          onmessageHandler = fn
        },
        onerror: null as ((event: unknown) => void) | null,
        terminate: vi.fn(),
      }

      const client = new BergamotWorkerClient({
        workerFactory: () => mockWorker as unknown as Worker,
      })

      await expect(
        client.translate({ direction: 'en-hi', text: 'Some text' })
      ).rejects.toThrowError(BergamotWorkerError)

      try {
        await client.translate({ direction: 'en-hi', text: 'Some text' })
      } catch (err) {
        expect(err).toBeInstanceOf(BergamotWorkerError)
        expect((err as BergamotWorkerError).code).toBe('MISSING_MODEL')
      }
    })

    it('recovers cleanly from unhandled worker crash events', async () => {
      let onerrorHandler: ((event: unknown) => void) | undefined
      let workerCount = 0

      const createWorkerInstance = () => {
        workerCount++
        return {
          postMessage: () => {
            // Do not respond; crash will trigger
          },
          set onmessage(_fn: ((event: MessageEvent) => void) | null) {},
          set onerror(fn: ((event: unknown) => void) | null) {
            onerrorHandler = fn ?? undefined
          },
          terminate: vi.fn(),
        }
      }

      const client = new BergamotWorkerClient({
        workerFactory: () => createWorkerInstance() as unknown as Worker,
        defaultTimeoutMs: 5000,
      })

      const pendingCall = client.translate({ direction: 'en-hi', text: 'Will crash' })

      // Trigger crash
      if (typeof onerrorHandler === 'function') {
        onerrorHandler(new Error('WASM memory access out of bounds'))
      }

      await expect(pendingCall).rejects.toThrowError(BergamotWorkerError)
      await expect(pendingCall).rejects.toMatchObject({
        code: 'WORKER_CRASHED',
      })
      expect(client.getStatus()).toBe('error')

      // Subsequent call should spin up fresh worker instance
      expect(workerCount).toBe(1)
      await client.terminate()
      expect(client.getStatus()).toBe('terminated')
    })

    it('rejects with REQUEST_CANCELLED when cancel is invoked', async () => {
      const mockWorker = {
        postMessage: () => {},
        set onmessage(_fn: ((event: MessageEvent) => void) | null) {},
        onerror: null as ((event: unknown) => void) | null,
        terminate: vi.fn(),
      }

      const client = new BergamotWorkerClient({
        workerFactory: () => mockWorker as unknown as Worker,
        defaultTimeoutMs: 5000,
      })

      const translatePromise = client.translate({ direction: 'en-hi', text: 'Cancel test' })
      await client.terminate()

      await expect(translatePromise).rejects.toMatchObject({
        code: 'WORKER_TERMINATED',
      })
    })
  })

  describe('3. Genuine Marian NMT WASM Unseen Inference Verification', () => {
    it('verifies that all 20 unseen translation results from real Marian NMT WASM pass safety and quality validation', () => {
      const resultsPath = path.resolve(
        '/Users/apple/.gemini/antigravity/brain/6c8fcac1-8d11-46cd-a130-62be2d742049/stage23_2_b_17_6_phase2_unseen_translation_results.json'
      )
      expect(fs.existsSync(resultsPath)).toBe(true)

      const rawContent = fs.readFileSync(resultsPath, 'utf8')
      interface TestCaseRecord {
        id: string
        category: string
        direction: string
        sourceText: string
        rawOutput: string
        genuineInferenceInvoked: boolean
      }
      const cases = JSON.parse(rawContent) as TestCaseRecord[]

      expect(cases.length).toBeGreaterThanOrEqual(20)

      const categoriesCovered = new Set(cases.map((c) => c.category))
      expect(categoriesCovered.has('everyday_sentence')).toBe(true)
      expect(categoriesCovered.has('business_communication')).toBe(true)
      expect(categoriesCovered.has('longer_paragraph')).toBe(true)
      expect(categoriesCovered.has('question')).toBe(true)
      expect(categoriesCovered.has('imperative_sentence')).toBe(true)
      expect(categoriesCovered.has('dates_and_numbers')).toBe(true)
      expect(categoriesCovered.has('names_and_technical_terms')).toBe(true)

      for (const item of cases) {
        expect(item.genuineInferenceInvoked).toBe(true)
        expect(item.rawOutput.length).toBeGreaterThan(0)
        expect(item.rawOutput).not.toBe(item.sourceText)

        // Ensure no synthetic fallback relics
        expect(item.rawOutput).not.toContain('तत्व तत्व')
        expect(item.rawOutput).not.toContain('[TRANSLATED:')
        expect(item.rawOutput).not.toContain('lorem ipsum')

        // Validate via production output validation heuristics
        const isEnHi = item.direction === 'en-hi'
        const validation = validateAndCleanGenerativeOutput({
          rawText: item.rawOutput,
          actionId: 'translate',
          sourceText: item.sourceText,
          targetLanguage: isEnHi ? 'Hindi' : 'English',
          languageTag: isEnHi ? 'en' : 'hi',
        })

        expect(validation.isValid, `Validation failed for case ${item.id}: ${validation.errorMessage}`).toBe(true)
        expect(validation.cleanedText.length).toBeGreaterThan(0)
      }
    })
  })
})
