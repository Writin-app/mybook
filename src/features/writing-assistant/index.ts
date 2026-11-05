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
export {
  MockTransformationEngine,
  createMockTransformationEngine,
  type MockTransformationEngineOptions,
} from './mockTransformationEngine'
export {
  HttpTransformationEngine,
  createHttpTransformationEngine,
  type HttpTransformationEngineOptions,
} from './httpTransformationEngine'
export {
  LocalLlamaTransformationEngine,
  createLocalLlamaTransformationEngine,
  getSharedLocalLlamaEngine,
  resetSharedLocalLlamaEngine,
  hasPersistedLocalConsent,
  persistLocalConsent,
  LOCAL_AI_CONSENT_STORAGE_KEY,
  ContextWindowExceededError,
  LocalModelRefusalError,
  isRefusalOutput,
  estimateTokenCount,
  DEFAULT_LOCAL_LLAMA_MODEL_ID,
  LOCAL_LLAMA_CONTEXT_WINDOW_LIMIT,
  DEFAULT_MAX_TOKENS_BY_ACTION,
  type LocalEngineLifecycleState,
  type LocalEngineStatusReport,
  type LocalEngineStatusListener,
  type LocalLlamaEngineOptions,
} from './localLlamaEngine'
export {
  validateAndCleanGenerativeOutput,
  cleanModelWrapperArtifacts,
  type OutputValidationParams,
  type OutputValidationResult,
} from './outputValidation'
export {
  sessionCredentialStore,
  SessionCredentialStore,
  maskApiKey,
  type SessionCredential,
  type MaskedSessionCredential,
} from './sessionCredentialStore'
export {
  GENERATION_PROVIDER_PROFILES,
  getEffectiveEndpoint,
  getGenerationProviderProfile,
  type BrowserDirectSupport,
  type GenerationProviderProfile,
  type ProviderPrivacyInfo,
  type ProviderProcessingType,
} from './providerProfiles'
export { WritingAssistantPanel, type WritingAssistantPanelHandle } from './WritingInsightsPanel'
export { GenerativeActionsSection, type GenerativeActionsSectionProps } from './GenerativeActionsSection'
export { prepareContentForInsertion, type GenerativeInsertionPlan } from './generativeInsertion'
export {
  createSelectionSnapshot,
  validateSelectionSnapshot,
  createCursorSnapshot,
  validateCursorSnapshot,
  validateAndPrepareSelectionInsertion,
  validateAndPrepareCursorInsertion,
  DEFAULT_CONTEXT_ANCHOR_LENGTH,
  type SelectionSnapshot,
  type SelectionStaleReason,
  type SelectionValidationResult,
  type CursorSnapshot,
  type CursorStaleReason,
  type CursorValidationResult,
} from './staleProtection'
export { ProviderConfigCard } from './ProviderConfigCard'
export { GenerativeResultPreview } from './GenerativeResultPreview'
export { buildProseMirrorTextMap, mapDocumentRangeToText, mapTextRangeToDocument } from './proseMirrorTextMap'
export {
  CANONICAL_TARGET_LANGUAGE_MAP,
  getEngineLanguageTag,
  getWritingLanguageProfile,
  normalizeDocumentWritingLanguagePreference,
  resolveTargetLanguageName,
  WRITING_LANGUAGE_PROFILES,
} from './languages'
export {
  BergamotTransformationEngine,
  getSharedBergamotEngine,
  resetSharedBergamotEngine,
  type BergamotLifecycleState,
  type BergamotEngineStatusReport,
  type BergamotEngineStatusListener,
  type BergamotEngineOptions,
} from './bergamotEngine'
export {
  ModelAssetManager,
  modelAssetManager,
  BERGAMOT_CACHE_NAME,
  MOZILLA_MODEL_REGISTRY,
  SAME_ORIGIN_MODEL_REGISTRY,
  MOZILLA_REMOTE_MODEL_REGISTRY,
  getBergamotModelUrl,
  getBergamotWorkerUrl,
  type ModelFilePaths,
  type ModelAssetManagerOptions,
  type StorageEstimateResult,
} from './modelAssetManager'
export {
  LANGUAGE_PAIR_CAPABILITIES,
  validateTranslationRequest,
  hasDevanagariScript,
  hasLatinScript,
  detectTextScript,
  normalizeSourceLanguage,
  type LanguagePairCapability,
  type SupportedTranslationEngine,
  type TranslationValidationResult,
} from './translationCapabilityRegistry'
export type {
  AnalysisEngine,
  AnalysisOutcome,
  AnalysisRequest,
  AnalysisResult,
  EngineAvailability,
  EngineCapabilities,
  EngineContext,
  GenerationContext,
  GenerationRequest,
  GenerationScope,
  GenerativeActionId,
  LanguageSupport,
  TransformationEngine,
  TransformationResult,
  WritingCapability,
  WritingEngine,
  WritingFinding,
} from './contracts'
export type { DocumentWritingLanguagePreference, WritingLanguageProfile, WritingLanguageProfileId } from './languages'
export type { ProofreadCategory, ProofreadDialect, ProofreadFinding } from './proofreadingTypes'
export { SelectionAiPopover, type SelectionAiPopoverProps } from './SelectionAiPopover'
export {
  useContextualSelectionAi,
  SELECTION_AI_ACTIONS,
  SELECTION_TONE_OPTIONS,
  SELECTION_TRANSLATION_LANGUAGES,
  type ContextualAiStatus,
  type ContextualAiOptions,
  type UseContextualSelectionAiProps,
} from './useContextualSelectionAi'
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
