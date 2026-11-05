import type { JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/react'

import { isMarkdownText, myBookMarkdownToDocument } from '../../utils/mybookMarkdown'
import type { GenerativeActionId } from './contracts'

export interface GenerativeInsertionPlan {
  target: number | { from: number; to: number }
  content: string | JSONContent | JSONContent[]
}

/**
 * Prepares the appropriate target range and content payload for TipTap acceptance.
 * Preserves document boundaries, handles markdown structures (headings, lists, blockquotes),
 * supports inline replacement with marks, and correctly spaces Continue Writing insertions.
 */
export function prepareContentForInsertion(
  doc: Editor['state']['doc'],
  actionId: GenerativeActionId,
  scope: 'selected' | 'document',
  range: { from: number; to: number } | undefined,
  proposedText: string,
): GenerativeInsertionPlan {
  if (actionId === 'continue-writing') {
    const insertPos = range ? range.to : doc.content.size
    const clampedPos = Math.max(0, Math.min(insertPos, doc.content.size))
    const $pos = doc.resolve(clampedPos)

    const isEnd = $pos.parentOffset === $pos.parent.content.size
    const isEmptyBlock = $pos.parent.content.size === 0
    const hasMarkdown = isMarkdownText(proposedText) || proposedText.includes('\n\n')

    if (isEmptyBlock) {
      const parsed = myBookMarkdownToDocument(proposedText)
      return {
        target: { from: $pos.before(), to: $pos.after() },
        content:
          parsed.content && parsed.content.length > 0
            ? parsed.content
            : [{ type: 'paragraph', content: [{ type: 'text', text: proposedText }] }],
      }
    }

    if (isEnd && hasMarkdown) {
      const parsed = myBookMarkdownToDocument(proposedText)
      return {
        target: $pos.after(),
        content:
          parsed.content && parsed.content.length > 0
            ? parsed.content
            : [{ type: 'paragraph', content: [{ type: 'text', text: proposedText }] }],
      }
    }

    // Inline continuation or single-line continuation
    const charBefore = doc.textBetween(Math.max(0, clampedPos - 1), clampedPos)
    const needsLeadingSpace =
      Boolean(charBefore) &&
      !/\s/u.test(charBefore) &&
      !/^[\s.,!?;:]/u.test(proposedText)

    return {
      target: clampedPos,
      content: (needsLeadingSpace ? ' ' : '') + proposedText,
    }
  }

  if (scope === 'document') {
    const parsed = myBookMarkdownToDocument(proposedText)
    return {
      target: { from: 0, to: doc.content.size },
      content:
        parsed.content && parsed.content.length > 0
          ? parsed.content
          : [{ type: 'paragraph', content: [{ type: 'text', text: proposedText }] }],
    }
  }

  // Selected scope
  const targetRange = range ?? { from: 0, to: doc.content.size }
  const $from = doc.resolve(targetRange.from)
  const $to = doc.resolve(targetRange.to)
  const isSameBlock = $from.sameParent($to)
  const hasMarkdown = isMarkdownText(proposedText) || proposedText.includes('\n\n')

  if (!isSameBlock || hasMarkdown) {
    const parsed = myBookMarkdownToDocument(proposedText)
    return {
      target: targetRange,
      content:
        parsed.content && parsed.content.length > 0
          ? parsed.content
          : [{ type: 'paragraph', content: [{ type: 'text', text: proposedText }] }],
    }
  }

  // Single-block inline replacement
  const parsed = myBookMarkdownToDocument(proposedText)
  const firstBlock = parsed.content?.[0]
  if (
    parsed.content?.length === 1 &&
    firstBlock &&
    firstBlock.type === 'paragraph' &&
    firstBlock.content
  ) {
    const hasMarks = firstBlock.content.some((n) => n.marks && n.marks.length > 0)
    if (hasMarks) {
      return {
        target: targetRange,
        content: firstBlock.content,
      }
    }
  }

  return {
    target: targetRange,
    content: proposedText,
  }
}
