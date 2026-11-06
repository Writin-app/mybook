function countWords(text: string) {
  if (typeof Intl.Segmenter === 'function') {
    const segments = new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)
    let count = 0
    for (const segment of segments) if (segment.isWordLike) count += 1
    return count
  }
  return text.trim() ? text.trim().split(/\s+/u).length : 0
}

function countCharacters(text: string) {
  if (typeof Intl.Segmenter === 'function') {
    let count = 0
    for (const segment of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
      if (segment.segment) count += 1
    }
    return count
  }
  return Array.from(text).length
}

export function getDocumentTextCounts(text: string) {
  return { words: countWords(text), characters: countCharacters(text) }
}
