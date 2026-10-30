import { DEFAULT_ANALYSIS_OPTIONS, DEFAULT_FILLER_WORDS } from './rules'
import type {
  AnalysisOptions,
  FillerDetectionOptions,
  PhraseDetectionOptions,
  ReadabilityStats,
  TextMatch,
  WritingAnalysis,
  WritingInsight,
} from './types'

interface Token extends TextMatch {
  normalized: string
  characterLength: number
}

// Letters, combining marks, and numbers form words. Internal apostrophes and
// hyphens stay within a token (e.g. “don't” and “well-known”).
const WORD_PATTERN = /[\p{L}\p{N}\p{M}]+(?:['’\-‐‑][\p{L}\p{N}\p{M}]+)*/gu
const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}\p{M}]/u
const WHITESPACE_PATTERN = /\s/u
const COMMON_ABBREVIATIONS = new Set(['dr', 'mr', 'mrs', 'ms', 'prof', 'rev', 'sr', 'jr', 'e.g', 'i.e', 'vs'])

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  WORD_PATTERN.lastIndex = 0

  for (const match of text.matchAll(WORD_PATTERN)) {
    const word = match[0] ?? ''
    const start = match.index
    tokens.push({
      text: word,
      start,
      end: start + word.length,
      normalized: word.toLowerCase(),
      characterLength: countCodePoints(word),
    })
  }

  return tokens
}

function countCodePoints(text: string): number {
  let count = 0
  for (let index = 0; index < text.length;) {
    const codePoint = text.codePointAt(index)!
    index += codePoint > 0xffff ? 2 : 1
    count += 1
  }
  return count
}

function makeMatch(text: string, start: number, end: number): TextMatch {
  return { text: text.slice(start, end), start, end }
}

function hasSentenceBoundary(text: string, left: Token, right: Token): boolean {
  return /[.!?]/u.test(text.slice(left.end, right.start))
}

function hasSentenceBoundaryInSequence(text: string, tokens: Token[], start: number, length: number): boolean {
  for (let offset = 1; offset < length; offset += 1) {
    if (hasSentenceBoundary(text, tokens[start + offset - 1]!, tokens[start + offset]!)) return true
  }
  return false
}

function isCommonAbbreviation(text: string, segmentStart: number, periodIndex: number): boolean {
  const prefix = text.slice(segmentStart, periodIndex + 1)
  const match = prefix.match(/(?:^|[\s([{])([A-Za-z]+(?:\.[A-Za-z]+)*)\.$/u)
  return match ? match[1]!.includes('.') || COMMON_ABBREVIATIONS.has(match[1]!.toLowerCase()) : false
}

function getPhraseBounds(options: PhraseDetectionOptions): { min: number; max: number } {
  const min = Math.max(1, Math.floor(options.minPhraseWords ?? DEFAULT_ANALYSIS_OPTIONS.minPhraseWords))
  const max = Math.max(min, Math.floor(options.maxPhraseWords ?? DEFAULT_ANALYSIS_OPTIONS.maxPhraseWords))
  return { min, max }
}

/** Detects adjacent repeated word tokens, highlighting only the second token. */
export function detectRepeatedWords(
  text: string,
  options: Pick<AnalysisOptions, 'ignoredRepeatedWords'> = {},
): TextMatch[] {
  return findRepeatedWords(text, tokenize(text), options.ignoredRepeatedWords)
}

function findRepeatedWords(
  text: string,
  tokens: Token[],
  ignoredWords: readonly string[] | undefined,
): TextMatch[] {
  const ignored = new Set((ignoredWords ?? DEFAULT_ANALYSIS_OPTIONS.ignoredRepeatedWords).map((word) => word.toLowerCase()))
  const matches: TextMatch[] = []

  for (let index = 1; index < tokens.length; index += 1) {
    const previous = tokens[index - 1]!
    const current = tokens[index]!
    if (
      previous.normalized === current.normalized &&
      !hasSentenceBoundary(text, previous, current) &&
      !ignored.has(current.normalized)
    ) {
      matches.push(makeMatch(text, current.start, current.end))
    }
  }

  return matches
}

/** Detects repeated adjacent token sequences, highlighting the second occurrence. */
export function detectRepeatedPhrases(
  text: string,
  options: PhraseDetectionOptions = {},
): TextMatch[] {
  return findRepeatedPhrases(text, tokenize(text), options)
}

function findRepeatedPhrases(text: string, tokens: Token[], options: PhraseDetectionOptions): TextMatch[] {
  const { min, max } = getPhraseBounds(options)
  const matches: TextMatch[] = []
  let index = 0

  while (index < tokens.length) {
    const longest = Math.min(max, Math.floor((tokens.length - index) / 2))
    let repeatedLength = 0

    for (let length = longest; length >= min; length -= 1) {
      let equal = true
      for (let offset = 0; offset < length; offset += 1) {
        const left = tokens[index + offset]!
        const right = tokens[index + length + offset]!
        if (left.normalized !== right.normalized) {
          equal = false
          break
        }
      }
      if (equal && hasSentenceBoundaryInSequence(text, tokens, index, length * 2)) equal = false
      if (equal) {
        repeatedLength = length
        break
      }
    }

    if (repeatedLength > 0) {
      const secondStart = tokens[index + repeatedLength]!.start
      const secondEnd = tokens[index + repeatedLength * 2 - 1]!.end
      matches.push(makeMatch(text, secondStart, secondEnd))
      // Consume both copies so a longer overlapping candidate cannot generate
      // a cascade of suggestions for the same repeated text.
      index += repeatedLength * 2
    } else {
      index += 1
    }
  }

  return matches
}

/**
 * Finds configurable filler words and phrases. Results are suggestions only;
 * occurrences are never changed or omitted based on grammatical context.
 */
export function detectFillerWords(
  text: string,
  options: FillerDetectionOptions = {},
): TextMatch[] {
  return findFillerWords(text, tokenize(text), options.fillerWords)
}

function findFillerWords(text: string, tokens: Token[], fillerWords: readonly string[] | undefined): TextMatch[] {
  const dictionary = (fillerWords ?? DEFAULT_FILLER_WORDS)
    .map((phrase) => tokenize(phrase).map((token) => token.normalized))
    .filter((phrase) => phrase.length > 0)
    .sort((left, right) => right.length - left.length)
  const matches: TextMatch[] = []
  let index = 0

  while (index < tokens.length) {
    let matchedLength = 0
    for (const phrase of dictionary) {
      if (index + phrase.length > tokens.length) continue
      let equal = true
      for (let offset = 0; offset < phrase.length; offset += 1) {
        if (tokens[index + offset]!.normalized !== phrase[offset]) {
          equal = false
          break
        }
      }
      if (equal && hasSentenceBoundaryInSequence(text, tokens, index, phrase.length)) equal = false
      if (equal) {
        matchedLength = phrase.length
        break
      }
    }

    if (matchedLength > 0) {
      matches.push(makeMatch(text, tokens[index]!.start, tokens[index + matchedLength - 1]!.end))
      index += matchedLength
    } else {
      index += 1
    }
  }

  return matches
}

function getSentenceRanges(text: string): TextMatch[] {
  const ranges: TextMatch[] = []
  let segmentStart = 0
  let index = 0

  const addSegment = (start: number, end: number) => {
    while (start < end && /\s/u.test(text[start] ?? '')) start += 1
    while (end > start && /\s/u.test(text[end - 1] ?? '')) end -= 1
    if (start < end && WORD_CHARACTER_PATTERN.test(text.slice(start, end))) ranges.push(makeMatch(text, start, end))
  }

  while (index < text.length) {
    const character = text[index]
    if (character === '\n' || character === '\r') {
      addSegment(segmentStart, index)
      if (character === '\r' && text[index + 1] === '\n') index += 1
      segmentStart = index + 1
      index += 1
      continue
    }

    if (character === '.' || character === '!' || character === '?') {
      let punctuationEnd = index + 1
      while (punctuationEnd < text.length && /[.!?]/u.test(text[punctuationEnd] ?? '')) punctuationEnd += 1
      const next = text[punctuationEnd]
      const decimalPoint = character === '.' && /\d/u.test(text[index - 1] ?? '') && /\d/u.test(next ?? '')
      if (!decimalPoint && !isCommonAbbreviation(text, segmentStart, index) && (next === undefined || /\s/u.test(next))) {
        addSegment(segmentStart, punctuationEnd)
        segmentStart = punctuationEnd
      }
      index = punctuationEnd
      continue
    }

    index += 1
  }

  addSegment(segmentStart, text.length)
  return ranges
}

function countParagraphs(text: string): number {
  let paragraphs = 0
  const blocks = text.split(/\r?\n(?:[\t ]*\r?\n)+/u)
  for (const block of blocks) {
    if (block.trim().length > 0) paragraphs += 1
  }
  return paragraphs
}

/** Calculates simple document statistics; sentence boundaries are intentionally heuristic. */
export function getReadabilityStats(text: string): ReadabilityStats {
  return getReadabilityStatsFromTokens(text, tokenize(text))
}

function getReadabilityStatsFromTokens(
  text: string,
  tokens: Token[],
  sentences: TextMatch[] = getSentenceRanges(text),
): ReadabilityStats {
  let totalWordCharacters = 0
  for (const token of tokens) totalWordCharacters += token.characterLength

  let characterCountWithoutSpaces = 0
  for (const character of text) {
    if (!WHITESPACE_PATTERN.test(character)) characterCountWithoutSpaces += 1
  }

  const wordCount = tokens.length
  const sentenceCount = sentences.length
  return {
    wordCount,
    characterCount: countCodePoints(text),
    characterCountWithoutSpaces,
    sentenceCount,
    paragraphCount: countParagraphs(text),
    averageWordsPerSentence: sentenceCount === 0 ? 0 : wordCount / sentenceCount,
    averageCharactersPerWord: wordCount === 0 ? 0 : totalWordCharacters / wordCount,
  }
}

export function countWords(text: string): number {
  return tokenize(text).length
}

/** Runs all analysis rules as a pure function; no editor or persistence integration is performed. */
export function analyzeWriting(text: string, options: AnalysisOptions = {}): WritingAnalysis {
  const mergedOptions = { ...DEFAULT_ANALYSIS_OPTIONS, ...options }
  const longSentenceWordThreshold = options.longSentenceWordThreshold ?? DEFAULT_ANALYSIS_OPTIONS.longSentenceWordThreshold
  const excessiveFillerCountThreshold = options.excessiveFillerCountThreshold ?? DEFAULT_ANALYSIS_OPTIONS.excessiveFillerCountThreshold
  const tokens = tokenize(text)
  const repeatedWords = findRepeatedWords(text, tokens, mergedOptions.ignoredRepeatedWords)
  const repeatedPhrases = findRepeatedPhrases(text, tokens, mergedOptions)
  const fillerWords = findFillerWords(text, tokens, mergedOptions.fillerWords)
  const sentences = getSentenceRanges(text)
  const stats = getReadabilityStatsFromTokens(text, tokens, sentences)
  const insights: WritingInsight[] = []

  let tokenIndex = 0
  for (const sentence of sentences) {
    while (tokenIndex < tokens.length && tokens[tokenIndex]!.start < sentence.start) tokenIndex += 1
    let sentenceWordCount = 0
    while (tokenIndex < tokens.length && tokens[tokenIndex]!.end <= sentence.end) {
      sentenceWordCount += 1
      tokenIndex += 1
    }
    if (sentenceWordCount > longSentenceWordThreshold) {
      insights.push({ ...sentence, type: 'long-sentence', message: 'This sentence is unusually long.' })
    }
  }

  if (fillerWords.length >= excessiveFillerCountThreshold && text.length > 0) {
    insights.push({
      ...makeMatch(text, 0, text.length),
      type: 'excessive-filler',
      message: 'This document contains several optional filler words or phrases.',
    })
  }

  for (const match of repeatedWords) {
    insights.push({ ...match, type: 'repeated-word', message: 'This word immediately repeats the previous word.' })
  }
  for (const match of repeatedPhrases) {
    insights.push({ ...match, type: 'repeated-phrase', message: 'This phrase immediately repeats the previous phrase.' })
  }

  return { stats, repeatedWords, repeatedPhrases, fillerWords, insights }
}
