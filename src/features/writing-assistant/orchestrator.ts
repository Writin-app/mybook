import type { AnalysisOutcome, AnalysisRequest, AnalysisResult, AnalysisEngine } from './contracts'
import { EngineRegistry } from './engineRegistry'

function identity(request: AnalysisRequest) {
  const { requestId, documentId, snapshotId } = request.context
  return { requestId, documentId, snapshotId }
}

function failure(request: AnalysisRequest, status: 'unsupported' | 'unavailable' | 'error' | 'stale', reason: string): AnalysisOutcome {
  return { ...identity(request), status, reason }
}

function isAnalysisEngine(engine: unknown): engine is AnalysisEngine {
  return typeof engine === 'object' && engine !== null && 'analyze' in engine && typeof engine.analyze === 'function'
}

export class AssistantOrchestrator {
  constructor(private readonly registry: EngineRegistry) {}

  async analyze(request: AnalysisRequest): Promise<AnalysisOutcome> {
    const lookup = this.registry.find(request.capability, request.context.languageTag)
    if (lookup.status === 'unsupported') return failure(request, 'unsupported', lookup.reason)
    if (!isAnalysisEngine(lookup.engine)) {
      return failure(request, 'unsupported', `Engine "${lookup.engine.id}" does not provide analysis.`)
    }
    if (!request.isCurrent()) return failure(request, 'stale', 'The document snapshot is no longer current.')

    try {
      if (lookup.engine.getAvailability) {
        const availability = await lookup.engine.getAvailability()
        if (!availability.available) {
          return failure(request, 'unavailable', availability.reason ?? `Engine "${lookup.engine.id}" is unavailable.`)
        }
      }

      const result: AnalysisResult = await lookup.engine.analyze(request.context)
      if (!request.isCurrent()) return failure(request, 'stale', 'The document snapshot changed during analysis.')
      return { ...identity(request), status: 'completed', result }
    } catch (error) {
      if (!request.isCurrent()) return failure(request, 'stale', 'The document snapshot changed during analysis.')
      return failure(request, 'error', error instanceof Error ? error.message : 'The analysis engine failed.')
    }
  }
}
