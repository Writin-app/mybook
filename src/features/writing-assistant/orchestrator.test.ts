import { describe, expect, it, vi } from 'vitest'

import type { AnalysisEngine, EngineContext } from './contracts'
import { EngineRegistry } from './engineRegistry'
import { AssistantOrchestrator } from './orchestrator'

const context: EngineContext = {
  requestId: 7,
  documentId: 'doc-1',
  snapshotId: 'snapshot-7',
  languageTag: 'en',
  text: 'Text',
}

function createEngine(overrides: Partial<AnalysisEngine> = {}): AnalysisEngine {
  return {
    id: 'insights',
    capabilities: { supports: [{ capability: 'insights', languages: [{ tag: 'en' }] }] },
    analyze: vi.fn(async () => ({ findings: [], data: null as never })),
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
})
