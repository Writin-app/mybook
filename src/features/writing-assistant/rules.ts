import type { AnalysisOptions } from './types'

/**
 * These are review prompts, not errors. A writer may intentionally use any of them.
 * Add or remove entries per product or language needs.
 */
export const DEFAULT_FILLER_WORDS = [
  'actually',
  'basically',
  'literally',
  'really',
  'very',
  'perhaps',
  'in my opinion',
  'I think',
] as const

/** Repetitions that can commonly be grammatical, such as “had had”. */
export const DEFAULT_IGNORED_REPEATED_WORDS = ['had', 'that'] as const

export const DEFAULT_ANALYSIS_OPTIONS = {
  minPhraseWords: 2,
  maxPhraseWords: 6,
  longSentenceWordThreshold: 30,
  excessiveFillerCountThreshold: 3,
  ignoredRepeatedWords: DEFAULT_IGNORED_REPEATED_WORDS,
} satisfies Required<Omit<AnalysisOptions, 'fillerWords'>>
