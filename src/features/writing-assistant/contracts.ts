import type { TextMatch, WritingAnalysis } from './types'

export type WritingCapability = 'insights' | 'spelling' | 'grammar' | 'translation' | 'rewrite'

/** Language tags use BCP 47. Subtag matching is opt-in, never implicit. */
export interface LanguageSupport {
  tag: string
  includeSubtags?: boolean
}

export interface EngineCapabilities {
  supports: readonly {
    capability: WritingCapability
    languages: readonly LanguageSupport[]
  }[]
}

/** Source ranges throughout the Writing Assistant use UTF-16 offsets. */
export interface EngineContext {
  requestId: number
  documentId: string
  snapshotId: string
  languageTag: string
  text: string
}

export interface WritingFinding {
  id: string
  engineId: string
  capability: WritingCapability
  kind: string
  message: string
  text: string
  range?: TextMatch
}

export interface AnalysisResult {
  findings: readonly WritingFinding[]
  /** Capability-specific statistics and data, retaining the existing insights API. */
  data: WritingAnalysis
}

export type TransformationResult =
  | {
      status: 'preview-ready'
      requestId: number
      documentId: string
      snapshotId: string
      sourceText: string
      proposedText: string
    }
  | {
      status: 'unsupported' | 'unavailable' | 'cancelled' | 'error' | 'stale'
      requestId: number
      documentId: string
      snapshotId: string
      reason: string
    }

export interface EngineAvailability {
  available: boolean
  reason?: string
}

export interface WritingEngine {
  id: string
  capabilities: EngineCapabilities
  getAvailability?: () => Promise<EngineAvailability>
}

/** Engines implement only analysis when they advertise analysis capabilities. */
export interface AnalysisEngine extends WritingEngine {
  analyze: (context: EngineContext) => Promise<AnalysisResult>
}

export interface AnalysisRequest {
  capability: WritingCapability
  context: EngineContext
  isCurrent: () => boolean
}

export type AnalysisOutcome =
  | (Pick<EngineContext, 'requestId' | 'documentId' | 'snapshotId'> & { status: 'completed'; result: AnalysisResult })
  | (Pick<EngineContext, 'requestId' | 'documentId' | 'snapshotId'> & {
      status: 'unsupported' | 'unavailable' | 'error' | 'stale'
      reason: string
    })
