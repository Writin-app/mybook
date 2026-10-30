import { getTextSerializersFromSchema } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

interface MappedTextSegment {
  textFrom: number
  textTo: number
  documentFrom: number
  documentTo: number
}

export interface ProseMirrorTextMap {
  /** Text using Tiptap's default getText() serialization. */
  text: string
  /** Text ranges that map directly to contiguous ProseMirror text positions. */
  segments: readonly MappedTextSegment[]
}

export interface DocumentTextRange {
  from: number
  to: number
}

export interface TextOffsetRange {
  start: number
  end: number
}

const DEFAULT_BLOCK_SEPARATOR = '\n\n'

/**
 * Builds an offset map using the same block separator and schema text
 * serializers as Tiptap's default editor.getText(). Text offsets and document
 * positions both count UTF-16 code units. Separators and serialized non-text
 * output are retained in `text` but deliberately have no position mapping.
 */
export function buildProseMirrorTextMap(doc: ProseMirrorNode): ProseMirrorTextMap {
  const range = { from: 0, to: doc.content.size }
  const textSerializers = getTextSerializersFromSchema(doc.type.schema)
  const parts: string[] = []
  const segments: MappedTextSegment[] = []
  let textOffset = 0

  const appendUnmapped = (value: string) => {
    if (!value) return
    parts.push(value)
    textOffset += value.length
  }

  const appendMapped = (value: string, documentFrom: number) => {
    if (!value) return
    const textFrom = textOffset
    const previous = segments.at(-1)
    if (previous && previous.textTo === textFrom && previous.documentTo === documentFrom) {
      previous.textTo += value.length
      previous.documentTo += value.length
    } else {
      segments.push({
        textFrom,
        textTo: textFrom + value.length,
        documentFrom,
        documentTo: documentFrom + value.length,
      })
    }
    parts.push(value)
    textOffset += value.length
  }

  doc.nodesBetween(range.from, range.to, (node, pos, parent, index) => {
    // This is the block-separator behavior in Tiptap's getTextBetween().
    if (node.isBlock && pos > range.from) appendUnmapped(DEFAULT_BLOCK_SEPARATOR)

    const serializer = textSerializers[node.type.name]
    if (serializer) {
      if (parent) {
        appendUnmapped(serializer({ node, pos, parent, index, range }))
      }
      return false
    }

    if (node.isText) appendMapped(node.text ?? '', pos)
  })

  return { text: parts.join(''), segments }
}

/** Returns a ProseMirror range only when every source code unit maps exactly. */
export function mapTextRangeToDocument(
  map: ProseMirrorTextMap,
  start: number,
  end: number,
): DocumentTextRange | null {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > map.text.length) {
    return null
  }

  let textCursor = start
  let documentFrom: number | null = null
  let documentCursor: number | null = null

  for (const segment of map.segments) {
    if (segment.textTo <= textCursor) continue
    if (segment.textFrom > textCursor) return null

    const segmentTextFrom = Math.max(textCursor, segment.textFrom)
    const segmentTextTo = Math.min(end, segment.textTo)
    const segmentDocumentFrom = segment.documentFrom + (segmentTextFrom - segment.textFrom)
    if (documentFrom === null) {
      documentFrom = segmentDocumentFrom
    } else if (documentCursor !== segmentDocumentFrom) {
      return null
    }

    documentCursor = segment.documentFrom + (segmentTextTo - segment.textFrom)
    textCursor = segmentTextTo
    if (textCursor === end) return { from: documentFrom, to: documentCursor }
  }

  return null
}

/** Maps a non-empty ProseMirror selection to the equivalent UTF-16 text range. */
export function mapDocumentRangeToText(
  map: ProseMirrorTextMap,
  from: number,
  to: number,
): TextOffsetRange | null {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from) return null

  const findOffset = (position: number, side: 'start' | 'end'): number | null => {
    for (const segment of map.segments) {
      if (position < segment.documentFrom || position > segment.documentTo) continue
      if (side === 'start' && position === segment.documentTo) continue
      if (side === 'end' && position === segment.documentFrom) continue
      return segment.textFrom + (position - segment.documentFrom)
    }
    return null
  }

  const start = findOffset(from, 'start')
  const end = findOffset(to, 'end')
  return start !== null && end !== null && end > start ? { start, end } : null
}
