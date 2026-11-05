import type {
  AnalysisOutcome,
  AnalysisRequest,
  AnalysisResult,
  AnalysisEngine,
  GenerationRequest,
  TransformationEngine,
  TransformationResult,
} from './contracts'
import { EngineRegistry } from './engineRegistry'

function identity(request: AnalysisRequest | GenerationRequest) {
  const { requestId, documentId, snapshotId } = request.context
  return { requestId, documentId, snapshotId }
}

function failure(request: AnalysisRequest, status: 'unsupported' | 'unavailable' | 'error' | 'stale', reason: string): AnalysisOutcome {
  return { ...identity(request), status, reason }
}

function transformationFailure(
  request: GenerationRequest,
  status: 'unsupported' | 'unavailable' | 'cancelled' | 'error' | 'stale',
  reason: string,
): TransformationResult {
  return { ...identity(request), status, reason }
}

function isAnalysisEngine(engine: unknown): engine is AnalysisEngine {
  return typeof engine === 'object' && engine !== null && 'analyze' in engine && typeof engine.analyze === 'function'
}

function isTransformationEngine(engine: unknown): engine is TransformationEngine {
  return typeof engine === 'object' && engine !== null && 'transform' in engine && typeof engine.transform === 'function'
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

  async transform(request: GenerationRequest): Promise<TransformationResult> {
    if (request.signal?.aborted) {
      return transformationFailure(request, 'cancelled', 'The generation request was cancelled.')
    }
    if (!request.isCurrent()) {
      return transformationFailure(request, 'stale', 'The document snapshot is no longer current.')
    }

    const lookup = this.registry.find(request.capability, request.context.languageTag)
    if (lookup.status === 'unsupported') return transformationFailure(request, 'unsupported', lookup.reason)
    if (!isTransformationEngine(lookup.engine)) {
      return transformationFailure(request, 'unsupported', `Engine "${lookup.engine.id}" does not provide transformations.`)
    }

    try {
      if (lookup.engine.getAvailability) {
        const availability = await lookup.engine.getAvailability()
        if (!availability.available) {
          return transformationFailure(request, 'unavailable', availability.reason ?? `Engine "${lookup.engine.id}" is unavailable.`)
        }
      }

      if (request.signal?.aborted) {
        return transformationFailure(request, 'cancelled', 'The generation request was cancelled.')
      }
      if (!request.isCurrent()) {
        return transformationFailure(request, 'stale', 'The document snapshot changed during transformation.')
      }

      const outcome = await lookup.engine.transform(request.context, request.signal)

      if (request.signal?.aborted) {
        return transformationFailure(request, 'cancelled', 'The generation request was cancelled.')
      }
      if (!request.isCurrent()) {
        return transformationFailure(request, 'stale', 'The document snapshot changed during transformation.')
      }

      return {
        ...identity(request),
        status: 'preview-ready',
        sourceText: request.context.text,
        proposedText: outcome.proposedText,
        explanation: outcome.explanation,
      }
    } catch (error) {
      if (request.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
        return transformationFailure(request, 'cancelled', 'The generation request was cancelled.')
      }
      if (!request.isCurrent()) {
        return transformationFailure(request, 'stale', 'The document snapshot changed during transformation.')
      }
      return transformationFailure(request, 'error', error instanceof Error ? error.message : 'The transformation engine failed.')
    }
  }
}
