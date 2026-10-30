import { describe, expect, it } from 'vitest'
import {
  analyzeWriting,
  countWords,
  detectFillerWords,
  detectRepeatedPhrases,
  detectRepeatedWords,
  getReadabilityStats,
} from './analysis'

describe('repeated word detection', () => {
  it('detects adjacent words case-insensitively and highlights the second word', () => {
    const text = 'The the document. I I think; this is is useful.'
    const matches = detectRepeatedWords(text)

    expect(matches.map(({ text: match, start, end }) => ({ match, start, end }))).toEqual([
      { match: 'the', start: 4, end: 7 },
      { match: 'I', start: 20, end: 21 },
      { match: 'is', start: 37, end: 39 },
    ])
  })

  it('handles whitespace and newlines without treating punctuation as words', () => {
    expect(detectRepeatedWords('word\n  word !!! !!!')).toHaveLength(1)
    expect(detectRepeatedWords('!!! ???')).toEqual([])
    expect(detectRepeatedWords('had had a point')).toEqual([])
  })

  it('matches Unicode words while reporting JavaScript UTF-16 offsets', () => {
    const text = '😀 café CAFÉ'
    expect(detectRepeatedWords(text)).toEqual([
      expect.objectContaining({ text: 'CAFÉ', start: 8, end: 12 }),
    ])
  })

  it('filters common grammatical repetitions but still suggests very very', () => {
    expect(detectRepeatedWords('had had that that very very').map(({ text: match }) => match)).toEqual(['very'])
    expect(detectRepeatedWords('had had that that very very', { ignoredRepeatedWords: [] }))
      .toHaveLength(3)
  })

  it('handles punctuation, multiple spaces, line breaks, contractions, and hyphenated words', () => {
    const text = "very,   very;\n don't don't well-known well-known"
    expect(detectRepeatedWords(text).map(({ text: match }) => match)).toEqual(['very', "don't", 'well-known'])
    expect(detectRepeatedWords('very—very').map(({ text: match }) => match)).toEqual(['very'])
  })
})

describe('repeated phrase detection', () => {
  it('detects immediately repeated phrases and reports the second occurrence', () => {
    const text = 'Please do this in order to in order to continue.'
    const matches = detectRepeatedPhrases(text)

    expect(matches).toEqual([
      expect.objectContaining({ text: 'in order to', start: 27, end: 38 }),
    ])
  })

  it('supports configured lengths, ignores case, and avoids overlapping suggestions', () => {
    expect(detectRepeatedPhrases('Thank you thank YOU', { minPhraseWords: 2, maxPhraseWords: 2 }))
      .toEqual([expect.objectContaining({ text: 'thank YOU' })])
    expect(detectRepeatedPhrases('a b a b a b', { minPhraseWords: 2, maxPhraseWords: 2 }))
      .toHaveLength(1)
    expect(detectRepeatedPhrases('go go')).toEqual([])
  })

  it('finds Unicode-offset phrases and keeps overlapping matches to one suggestion', () => {
    const text = '😀😀 in order to in order to'
    const phrase = detectRepeatedPhrases(text)
    expect(phrase).toEqual([expect.objectContaining({ text: 'in order to', start: 17, end: 28 })])

    const overlap = detectRepeatedPhrases('a b c a b c', { minPhraseWords: 2, maxPhraseWords: 3 })
    expect(overlap).toHaveLength(1)
    expect(overlap[0]?.text).toBe('a b c')
  })

  it('returns repeated phrases even when they may be intentional', () => {
    const text = 'thank you thank you'
    expect(detectRepeatedPhrases(text).map(({ text: match }) => match)).toEqual(['thank you'])
  })
})

describe('filler word detection', () => {
  it('matches configured words and phrases case-insensitively at exact offsets', () => {
    const text = 'Actually, I think this is really useful.'
    expect(detectFillerWords(text)).toEqual([
      expect.objectContaining({ text: 'Actually', start: 0, end: 8 }),
      expect.objectContaining({ text: 'I think', start: 10, end: 17 }),
      expect.objectContaining({ text: 'really', start: 26, end: 32 }),
    ])
  })

  it('allows a custom dictionary and returns suggestions without changing text', () => {
    const text = 'Perhaps maybe.'
    const suggestions = detectFillerWords(text, { fillerWords: ['maybe'] })

    expect(suggestions.map(({ text: match }) => match)).toEqual(['maybe'])
    expect(text).toBe('Perhaps maybe.')
  })
})

describe('readability statistics', () => {
  it('returns stable zero statistics for empty or whitespace-only input', () => {
    expect(getReadabilityStats('')).toMatchObject({
      wordCount: 0,
      characterCount: 0,
      characterCountWithoutSpaces: 0,
      sentenceCount: 0,
      paragraphCount: 0,
      averageWordsPerSentence: 0,
      averageCharactersPerWord: 0,
    })
    expect(getReadabilityStats(' \n  ')).toMatchObject({ wordCount: 0, sentenceCount: 0, paragraphCount: 0 })
  })

  it('counts words, Unicode characters, sentences, paragraphs, and averages', () => {
    expect(getReadabilityStats('Hi, world!\nNext line.\n\n😀 ok')).toEqual({
      wordCount: 5,
      characterCount: 27,
      characterCountWithoutSpaces: 21,
      sentenceCount: 3,
      paragraphCount: 2,
      averageWordsPerSentence: 5 / 3,
      averageCharactersPerWord: 17 / 5,
    })
  })

  it('treats multiple spaces and single line breaks as whitespace, with fragments as sentences', () => {
    expect(getReadabilityStats('one   two\nthree')).toMatchObject({
      wordCount: 3,
      sentenceCount: 2,
      paragraphCount: 1,
      averageWordsPerSentence: 1.5,
    })
    expect(countWords('item one\nitem two')).toBe(4)
  })

  it('counts empty paragraphs and list-like lines without counting empty lines', () => {
    expect(getReadabilityStats('\n\n- first item\n- second item\n\n\n- third item')).toMatchObject({
      wordCount: 6,
      sentenceCount: 3,
      paragraphCount: 2,
    })
  })

  it('does not split sentences at common titles or Latin abbreviations', () => {
    expect(getReadabilityStats('Dr. Lee spoke, e.g. about the result. Then he left.').sentenceCount).toBe(2)
    expect(getReadabilityStats('The U.S. team arrived. Then left.').sentenceCount).toBe(2)
  })
})

describe('combined writing analysis', () => {
  it('reports long sentences and excessive filler with configurable thresholds', () => {
    const result = analyzeWriting('Really very useful. This sentence is unusually long.', {
      longSentenceWordThreshold: 4,
      excessiveFillerCountThreshold: 2,
    })

    expect(result.insights.map(({ type }) => type)).toEqual(['long-sentence', 'excessive-filler'])
    expect(result.insights[0]).toMatchObject({ start: 20 })
  })

  it('supports custom thresholds and runs deterministically on long text', () => {
    const text = `${'A short sentence. '.repeat(1000)}the the`
    const first = analyzeWriting(text, { longSentenceWordThreshold: 2 })
    const second = analyzeWriting(text, { longSentenceWordThreshold: 2 })

    expect(first).toEqual(second)
    expect(first.repeatedWords).toHaveLength(1)
    expect(first.stats.wordCount).toBe(3002)
  })

  it('returns exact source slices for every reported range on a large document', () => {
    const text = `${'In order to write well, '.repeat(4000)}the the`
    const result = analyzeWriting(text)
    const matches = [
      ...result.repeatedWords,
      ...result.repeatedPhrases,
      ...result.fillerWords,
      ...result.insights,
    ]

    expect(matches.length).toBeGreaterThan(0)
    for (const match of matches) {
      expect(text.slice(match.start, match.end)).toBe(match.text)
      expect(match.start).toBeGreaterThanOrEqual(0)
      expect(match.end).toBeLessThanOrEqual(text.length)
    }
  })
})
