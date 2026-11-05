import { describe, expect, it, vi } from 'vitest'

import type { AnalysisEngine, EngineContext, GenerationContext, TransformationEngine } from './contracts'
import { EngineRegistry } from './engineRegistry'
import { AssistantOrchestrator } from './orchestrator'

const context: EngineContext = {
  requestId: 7,
  documentId: 'doc-1',
  snapshotId: 'snapshot-7',
  languageTag: 'en',
  text: 'Text',
}

const generationContext: GenerationContext = {
  requestId: 42,
  documentId: 'doc-gen-1',
  snapshotId: 'snapshot-42',
  languageTag: 'en',
  text: 'The quick brown fox.',
  actionId: 'improve-writing',
  scope: 'selected',
  instruction: 'Improve clarity',
}

function createEngine(overrides: Partial<AnalysisEngine> = {}): AnalysisEngine {
  return {
    id: 'insights',
    capabilities: { supports: [{ capability: 'insights', languages: [{ tag: 'en' }] }] },
    analyze: vi.fn(async () => ({ findings: [], data: null as never })),
    ...overrides,
  }
}

function createTransformationEngine(overrides: Partial<TransformationEngine> = {}): TransformationEngine {
  return {
    id: 'rewriter',
    capabilities: { supports: [{ capability: 'rewrite', languages: [{ tag: 'en' }] }] },
    transform: vi.fn(async (ctx) => ({ proposedText: `Improved: ${ctx.text}` })),
    ...overrides,
  }
}

describe('AssistantOrchestrator', () => {
  it('executes the matching engine and preserves request, document, and snapshot identity', async () => {
    const engine = createEngine()
    const registry = new EngineRegistry([engine])
    const outcome = await new AssistantOrchestrator(registry).analyze({
      capability: 'insights',
      context,
      isCurrent: () => true,
    })

    expect(engine.analyze).toHaveBeenCalledWith(context)
    expect(outcome).toMatchObject({
      status: 'completed',
      requestId: 7,
      documentId: 'doc-1',
      snapshotId: 'snapshot-7',
    })
  })

  it('returns unsupported when no registered engine matches the language', async () => {
    const outcome = await new AssistantOrchestrator(new EngineRegistry([createEngine()])).analyze({
      capability: 'insights',
      context: { ...context, languageTag: 'hi-IN' },
      isCurrent: () => true,
    })

    expect(outcome).toMatchObject({ status: 'unsupported', requestId: 7, documentId: 'doc-1', snapshotId: 'snapshot-7' })
  })

  it('returns unsupported when no engine is registered for the requested capability', async () => {
    const outcome = await new AssistantOrchestrator(new EngineRegistry()).analyze({
      capability: 'insights', context, isCurrent: () => true,
    })

    expect(outcome).toMatchObject({ status: 'unsupported', requestId: 7, documentId: 'doc-1', snapshotId: 'snapshot-7' })
  })

  it('returns unavailable when the selected engine cannot run', async () => {
    const engine = createEngine({ getAvailability: async () => ({ available: false, reason: 'No Worker support' }) })
    const outcome = await new AssistantOrchestrator(new EngineRegistry([engine])).analyze({
      capability: 'insights', context, isCurrent: () => true,
    })

    expect(outcome).toMatchObject({ status: 'unavailable', reason: 'No Worker support' })
  })

  it('returns an error result when the selected engine throws', async () => {
    const engine = createEngine({ analyze: async () => { throw new Error('worker failed') } })
    const outcome = await new AssistantOrchestrator(new EngineRegistry([engine])).analyze({
      capability: 'insights', context, isCurrent: () => true,
    })

    expect(outcome).toMatchObject({ status: 'error', reason: 'worker failed' })
  })

  it('marks a response stale if the request is no longer current', async () => {
    let current = true
    const engine = createEngine({ analyze: async () => {
      current = false
      return { findings: [], data: null as never }
    } })
    const outcome = await new AssistantOrchestrator(new EngineRegistry([engine])).analyze({
      capability: 'insights', context, isCurrent: () => current,
    })

    expect(outcome).toMatchObject({ status: 'stale', requestId: 7, snapshotId: 'snapshot-7' })
  })

  describe('transform()', () => {
    it('executes the matching transformation engine and returns preview-ready with identities', async () => {
      const engine = createTransformationEngine()
      const registry = new EngineRegistry([engine])
      const outcome = await new AssistantOrchestrator(registry).transform({
        capability: 'rewrite',
        context: generationContext,
        isCurrent: () => true,
      })

      expect(engine.transform).toHaveBeenCalledWith(generationContext, undefined)
      expect(outcome).toEqual({
        status: 'preview-ready',
        requestId: 42,
        documentId: 'doc-gen-1',
        snapshotId: 'snapshot-42',
        sourceText: 'The quick brown fox.',
        proposedText: 'Improved: The quick brown fox.',
        explanation: undefined,
      })
    })

    it('returns unsupported when no engine supports the requested language for rewrite', async () => {
      const engine = createTransformationEngine()
      const outcome = await new AssistantOrchestrator(new EngineRegistry([engine])).transform({
        capability: 'rewrite',
        context: { ...generationContext, languageTag: 'fr-FR' },
        isCurrent: () => true,
      })

      expect(outcome).toMatchObject({
        status: 'unsupported',
        requestId: 42,
        documentId: 'doc-gen-1',
        snapshotId: 'snapshot-42',
      })
    })

    it('returns unsupported when the matched engine does not provide transformations', async () => {
      const invalidEngine = {
        id: 'fake-rewriter',
        capabilities: { supports: [{ capability: 'rewrite' as const, languages: [{ tag: 'en' }] }] },
      }
      const outcome = await new AssistantOrchestrator(new EngineRegistry([invalidEngine])).transform({
        capability: 'rewrite',
        context: generationContext,
        isCurrent: () => true,
      })

      expect(outcome).toMatchObject({
        status: 'unsupported',
        reason: 'Engine "fake-rewriter" does not provide transformations.',
      })
    })

    it('returns unavailable when the transformation engine cannot run', async () => {
      const engine = createTransformationEngine({
        getAvailability: async () => ({ available: false, reason: 'Device out of memory' }),
      })
      const outcome = await new AssistantOrchestrator(new EngineRegistry([engine])).transform({
        capability: 'rewrite',
        context: generationContext,
        isCurrent: () => true,
      })

      expect(outcome).toMatchObject({
        status: 'unavailable',
        reason: 'Device out of memory',
      })
    })

    it('returns error when the transformation engine throws', async () => {
      const engine = createTransformationEngine({
        transform: async () => {
          throw new Error('Inference failure')
        },
      })
      const outcome = await new AssistantOrchestrator(new EngineRegistry([engine])).transform({
        capability: 'rewrite',
        context: generationContext,
        isCurrent: () => true,
      })

      expect(outcome).toMatchObject({
        status: 'error',
        reason: 'Inference failure',
      })
    })

    it('returns cancelled when request signal is aborted before execution', async () => {
      const controller = new AbortController()
      controller.abort()

      const engine = createTransformationEngine()
      const outcome = await new AssistantOrchestrator(new EngineRegistry([engine])).transform({
        capability: 'rewrite',
        context: generationContext,
        signal: controller.signal,
        isCurrent: () => true,
      })

      expect(outcome).toMatchObject({
        status: 'cancelled',
        reason: 'The generation request was cancelled.',
      })
    })

    it('returns stale if document snapshot changed before transformation finishes', async () => {
      let isCurrent = true
      const engine = createTransformationEngine({
        transform: async () => {
          isCurrent = false
          return { proposedText: 'New text' }
        },
      })
      const outcome = await new AssistantOrchestrator(new EngineRegistry([engine])).transform({
        capability: 'rewrite',
        context: generationContext,
        isCurrent: () => isCurrent,
      })

      expect(outcome).toMatchObject({
        status: 'stale',
        reason: 'The document snapshot changed during transformation.',
      })
    })

    describe('Stage 23.2.B.16 — Orchestrator Engine Routing (Bergamot vs Llama)', () => {
      it('routes English -> Hindi translation to Bergamot and not to Llama', async () => {
        const bergamotTransform = vi.fn(async () => ({ proposedText: 'नमस्ते दुनिया' }))
        const bergamotEngine: TransformationEngine = {
          id: 'bergamot-translator',
          capabilities: {
            supports: [
              {
                capability: 'translation',
                languages: [
                  { tag: 'en', includeSubtags: true },
                  { tag: 'hi', includeSubtags: true },
                ],
              },
            ],
          },
          transform: bergamotTransform,
        }

        const llamaTransform = vi.fn(async () => ({ proposedText: 'Llama text' }))
        const llamaEngine: TransformationEngine = {
          id: 'local-llama',
          capabilities: {
            supports: [{ capability: 'rewrite', languages: [{ tag: 'en', includeSubtags: true }] }],
          },
          transform: llamaTransform,
        }

        const registry = new EngineRegistry([bergamotEngine, llamaEngine])
        const orchestrator = new AssistantOrchestrator(registry)

        const outcome = await orchestrator.transform({
          capability: 'translation',
          context: {
            ...generationContext,
            actionId: 'translate',
            options: { targetLanguage: 'Hindi' },
          },
          isCurrent: () => true,
        })

        expect(outcome.status).toBe('preview-ready')
        expect(bergamotTransform).toHaveBeenCalledTimes(1)
        expect(llamaTransform).not.toHaveBeenCalled()
      })

      it('routes Hindi -> English translation to Bergamot', async () => {
        const bergamotTransform = vi.fn(async () => ({ proposedText: 'Hello world' }))
        const bergamotEngine: TransformationEngine = {
          id: 'bergamot-translator',
          capabilities: {
            supports: [
              {
                capability: 'translation',
                languages: [
                  { tag: 'en', includeSubtags: true },
                  { tag: 'hi', includeSubtags: true },
                ],
              },
            ],
          },
          transform: bergamotTransform,
        }

        const registry = new EngineRegistry([bergamotEngine])
        const orchestrator = new AssistantOrchestrator(registry)

        const outcome = await orchestrator.transform({
          capability: 'translation',
          context: {
            ...generationContext,
            languageTag: 'hi-IN',
            actionId: 'translate',
            text: 'नमस्ते दुनिया',
            options: { targetLanguage: 'English' },
          },
          isCurrent: () => true,
        })

        expect(outcome.status).toBe('preview-ready')
        expect(bergamotTransform).toHaveBeenCalledTimes(1)
      })

      it('routes English rewriting to Llama and not to Bergamot', async () => {
        const bergamotTransform = vi.fn(async () => ({ proposedText: 'Bergamot text' }))
        const bergamotEngine: TransformationEngine = {
          id: 'bergamot-translator',
          capabilities: {
            supports: [{ capability: 'translation', languages: [{ tag: 'en', includeSubtags: true }] }],
          },
          transform: bergamotTransform,
        }

        const llamaTransform = vi.fn(async () => ({ proposedText: 'Polished text.' }))
        const llamaEngine: TransformationEngine = {
          id: 'local-llama',
          capabilities: {
            supports: [{ capability: 'rewrite', languages: [{ tag: 'en', includeSubtags: true }] }],
          },
          transform: llamaTransform,
        }

        const registry = new EngineRegistry([bergamotEngine, llamaEngine])
        const orchestrator = new AssistantOrchestrator(registry)

        const outcome = await orchestrator.transform({
          capability: 'rewrite',
          context: {
            ...generationContext,
            actionId: 'improve-writing',
          },
          isCurrent: () => true,
        })

        expect(outcome.status).toBe('preview-ready')
        expect(llamaTransform).toHaveBeenCalledTimes(1)
        expect(bergamotTransform).not.toHaveBeenCalled()
      })

      it('rejects unsupported language for translation when no engine matches', async () => {
        const bergamotEngine: TransformationEngine = {
          id: 'bergamot-translator',
          capabilities: {
            supports: [
              {
                capability: 'translation',
                languages: [
                  { tag: 'en', includeSubtags: true },
                  { tag: 'hi', includeSubtags: true },
                ],
              },
            ],
          },
          transform: vi.fn(),
        }

        const registry = new EngineRegistry([bergamotEngine])
        const orchestrator = new AssistantOrchestrator(registry)

        const outcome = await orchestrator.transform({
          capability: 'translation',
          context: {
            ...generationContext,
            languageTag: 'ja',
          },
          isCurrent: () => true,
        })

        expect(outcome.status).toBe('unsupported')
        if (outcome.status === 'unsupported') {
          expect(outcome.reason).toContain('No registered engine supports translation for language "ja"')
        }
      })
    })
  })
})
