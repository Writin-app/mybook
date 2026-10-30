export {
  analyzeWriting,
  countWords,
  detectFillerWords,
  detectRepeatedPhrases,
  detectRepeatedWords,
  getReadabilityStats,
} from './analysis'
export {
  DEFAULT_ANALYSIS_OPTIONS,
  DEFAULT_FILLER_WORDS,
  DEFAULT_IGNORED_REPEATED_WORDS,
} from './rules'
export { EngineRegistry } from './engineRegistry'
export { AssistantOrchestrator } from './orchestrator'
export { createWritingInsightsEngine, WRITING_INSIGHTS_CAPABILITIES } from './insightsEngine'
export { WritingAssistantPanel, type WritingAssistantPanelHandle } from './WritingInsightsPanel'
export { buildProseMirrorTextMap, mapDocumentRangeToText, mapTextRangeToDocument } from './proseMirrorTextMap'
export {
  getEngineLanguageTag,
  getWritingLanguageProfile,
  normalizeDocumentWritingLanguagePreference,
  WRITING_LANGUAGE_PROFILES,
} from './languages'
export type {
  AnalysisEngine,
  AnalysisOutcome,
  AnalysisRequest,
  AnalysisResult,
  EngineAvailability,
  EngineCapabilities,
  EngineContext,
  LanguageSupport,
  TransformationResult,
  WritingCapability,
  WritingEngine,
  WritingFinding,
} from './contracts'
export type { DocumentWritingLanguagePreference, WritingLanguageProfile, WritingLanguageProfileId } from './languages'
export type { ProofreadCategory, ProofreadDialect, ProofreadFinding } from './proofreadingTypes'
export type {
  AnalysisOptions,
  FillerDetectionOptions,
  InsightType,
  PhraseDetectionOptions,
  ReadabilityStats,
  TextMatch,
  WritingAnalysis,
  WritingInsight,
} from './types'
