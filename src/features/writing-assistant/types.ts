/** Source ranges use JavaScript string offsets: UTF-16 code units, start inclusive, end exclusive. */
export interface TextMatch {
  /** Exact source text covered by this match. */
  text: string
  start: number
  end: number
}

export interface ReadabilityStats {
  wordCount: number
  /** Unicode code points, including whitespace and punctuation. */
  characterCount: number
  /** Unicode code points after removing all whitespace. */
  characterCountWithoutSpaces: number
  sentenceCount: number
  paragraphCount: number
  averageWordsPerSentence: number
  /** Mean Unicode code points per tokenized word. */
  averageCharactersPerWord: number
}

export type InsightType =
  | 'long-sentence'
  | 'excessive-filler'
  | 'repeated-word'
  | 'repeated-phrase'

export interface WritingInsight extends TextMatch {
  type: InsightType
  message: string
}

export interface PhraseDetectionOptions {
  minPhraseWords?: number
  maxPhraseWords?: number
}

export interface FillerDetectionOptions {
  /** Replaces the default dictionary when supplied. */
  fillerWords?: readonly string[]
}

export interface AnalysisOptions extends PhraseDetectionOptions, FillerDetectionOptions {
  /** A sentence is flagged when its word count is strictly greater than this value. */
  longSentenceWordThreshold?: number
  /** An excessive-filler insight is emitted at or above this number of matches. */
  excessiveFillerCountThreshold?: number
  /** Words commonly repeated intentionally in valid constructions can be excluded here. */
  ignoredRepeatedWords?: readonly string[]
}

export interface WritingAnalysis {
  stats: ReadabilityStats
  repeatedWords: TextMatch[]
  repeatedPhrases: TextMatch[]
  fillerWords: TextMatch[]
  insights: WritingInsight[]
}
