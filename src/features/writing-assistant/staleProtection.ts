import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/react'

import type { GenerativeActionId } from './contracts'
import { prepareContentForInsertion, type GenerativeInsertionPlan } from './generativeInsertion'

export const DEFAULT_CONTEXT_ANCHOR_LENGTH = 32

export interface SelectionSnapshot {
  fileId: string
  doc: ProseMirrorNode
  range: { from: number; to: number }
  sourceText: string
  contextAnchor: {
    prefix: string
    suffix: string
    prefixOffset: number
    suffixOffset: number
  }
}

export type SelectionStaleReason =
  | 'document-switched'
  | 'empty-selection'
  | 'invalid-range'
  | 'text-changed'
  | 'context-changed'
  | 'document-modified'

export type SelectionValidationResult =
  | {
      status: 'valid'
      targetRange: { from: number; to: number }
      sourceText: string
    }
  | {
      status: 'stale'
      reason: SelectionStaleReason
      message: string
      snapshotRange: { from: number; to: number }
      snapshotSourceText: string
    }

export interface CursorSnapshot {
  fileId: string
  doc: ProseMirrorNode
  cursorPos: number
  surroundingContext: {
    prefix: string
    suffix: string
    prefixOffset: number
    suffixOffset: number
  }
}

export type CursorStaleReason =
  | 'document-switched'
  | 'invalid-position'
  | 'cursor-moved'
  | 'context-changed'
  | 'document-modified'

export type CursorValidationResult =
  | {
      status: 'valid'
      targetPos: number
    }
  | {
      status: 'stale'
      reason: CursorStaleReason
      message: string
      snapshotPos: number
      currentCursorPos?: number
      suggestedFallbackPos?: number
    }

/**
 * Creates an immutable snapshot of an editor selection, including document identity,
 * exact source text, and surrounding anchor context.
 */
export function createSelectionSnapshot(
  fileId: string,
  doc: ProseMirrorNode,
  range: { from: number; to: number },
  contextLength = DEFAULT_CONTEXT_ANCHOR_LENGTH,
): SelectionSnapshot {
  const docSize = doc.content.size
  const clampedFrom = Math.max(0, Math.min(range.from, docSize))
  const clampedTo = Math.max(0, Math.min(range.to, docSize))

  const sourceText = clampedFrom < clampedTo ? doc.textBetween(clampedFrom, clampedTo, '\n') : ''

  const prefixOffset = Math.min(clampedFrom, contextLength)
  const prefix = doc.textBetween(clampedFrom - prefixOffset, clampedFrom, '\n')

  const suffixOffset = Math.min(docSize - clampedTo, contextLength)
  const suffix = doc.textBetween(clampedTo, clampedTo + suffixOffset, '\n')

  return {
    fileId,
    doc,
    range: { from: range.from, to: range.to },
    sourceText,
    contextAnchor: {
      prefix,
      suffix,
      prefixOffset,
      suffixOffset,
    },
  }
}

/**
 * Validates whether a selection snapshot is still strictly valid against the current document state.
 * Conservative safety rules:
 * - If the document identity changed, rejects immediately.
 * - If the range is empty or invalid, rejects.
 * - If the text at the target range does not match, rejects.
 * - If the surrounding anchor context does not match, rejects.
 * - If the document was modified after snapshot creation, rejects.
 * - Never searches for another occurrence of the text elsewhere in the document.
 */
export function validateSelectionSnapshot(
  currentFileId: string,
  currentDoc: ProseMirrorNode,
  snapshot: SelectionSnapshot,
): SelectionValidationResult {
  const snapshotRange = snapshot.range
  const snapshotSourceText = snapshot.sourceText

  // 1. Document Identity
  if (currentFileId !== snapshot.fileId) {
    return {
      status: 'stale',
      reason: 'document-switched',
      message: 'The active document was changed.',
      snapshotRange,
      snapshotSourceText,
    }
  }

  // 2. Empty selection check
  if (snapshotRange.from === snapshotRange.to) {
    return {
      status: 'stale',
      reason: 'empty-selection',
      message: 'The selection range is empty.',
      snapshotRange,
      snapshotSourceText,
    }
  }

  // 3. Range boundaries check
  const docSize = currentDoc.content.size
  if (
    snapshotRange.from < 0 ||
    snapshotRange.to > docSize ||
    snapshotRange.from > snapshotRange.to
  ) {
    return {
      status: 'stale',
      reason: 'invalid-range',
      message: 'Selection range is outside document boundaries.',
      snapshotRange,
      snapshotSourceText,
    }
  }

  // 4. Selected text content check at exact range
  const currentText = currentDoc.textBetween(snapshotRange.from, snapshotRange.to, '\n')
  if (currentText !== snapshot.sourceText) {
    return {
      status: 'stale',
      reason: 'text-changed',
      message: 'The selected text was modified since generation was requested.',
      snapshotRange,
      snapshotSourceText,
    }
  }

  // 5. Context anchor checks (prefix and suffix)
  const prefixStart = Math.max(0, snapshotRange.from - snapshot.contextAnchor.prefixOffset)
  if (snapshotRange.from - prefixStart !== snapshot.contextAnchor.prefixOffset) {
    return {
      status: 'stale',
      reason: 'context-changed',
      message: 'The text preceding the selection was modified.',
      snapshotRange,
      snapshotSourceText,
    }
  }

  const currentPrefix = currentDoc.textBetween(
    prefixStart,
    snapshotRange.from,
    '\n',
  )
  if (currentPrefix !== snapshot.contextAnchor.prefix) {
    return {
      status: 'stale',
      reason: 'context-changed',
      message: 'The text preceding the selection was modified.',
      snapshotRange,
      snapshotSourceText,
    }
  }

  const suffixEnd = Math.min(docSize, snapshotRange.to + snapshot.contextAnchor.suffixOffset)
  if (suffixEnd - snapshotRange.to !== snapshot.contextAnchor.suffixOffset) {
    return {
      status: 'stale',
      reason: 'context-changed',
      message: 'The text following the selection was modified.',
      snapshotRange,
      snapshotSourceText,
    }
  }

  const currentSuffix = currentDoc.textBetween(
    snapshotRange.to,
    suffixEnd,
    '\n',
  )
  if (currentSuffix !== snapshot.contextAnchor.suffix) {
    return {
      status: 'stale',
      reason: 'context-changed',
      message: 'The text following the selection was modified.',
      snapshotRange,
      snapshotSourceText,
    }
  }

  // 6. Strict Document Object Identity Check
  if (currentDoc !== snapshot.doc) {
    return {
      status: 'stale',
      reason: 'document-modified',
      message: 'The document was edited after the request was created.',
      snapshotRange,
      snapshotSourceText,
    }
  }

  return {
    status: 'valid',
    targetRange: snapshotRange,
    sourceText: snapshotSourceText,
  }
}

/**
 * Creates an immutable snapshot of a cursor position and its surrounding context.
 */
export function createCursorSnapshot(
  fileId: string,
  doc: ProseMirrorNode,
  cursorPos: number,
  contextLength = DEFAULT_CONTEXT_ANCHOR_LENGTH,
): CursorSnapshot {
  const docSize = doc.content.size
  const clampedPos = Math.max(0, Math.min(cursorPos, docSize))

  const prefixOffset = Math.min(clampedPos, contextLength)
  const prefix = doc.textBetween(clampedPos - prefixOffset, clampedPos, '\n')

  const suffixOffset = Math.min(docSize - clampedPos, contextLength)
  const suffix = doc.textBetween(clampedPos, clampedPos + suffixOffset, '\n')

  return {
    fileId,
    doc,
    cursorPos,
    surroundingContext: {
      prefix,
      suffix,
      prefixOffset,
      suffixOffset,
    },
  }
}

/**
 * Validates whether a cursor snapshot is still strictly valid for insertion.
 * Conservative safety rules:
 * - If document identity changed, rejects.
 * - If position is out of bounds, rejects.
 * - If cursor moved, rejects.
 * - If surrounding text changed, rejects.
 * - If document modified, rejects.
 * - Never silently moves insertion target.
 */
export function validateCursorSnapshot(
  currentFileId: string,
  currentDoc: ProseMirrorNode,
  currentCursorPos: number | undefined,
  snapshot: CursorSnapshot,
): CursorValidationResult {
  const snapshotPos = snapshot.cursorPos

  // 1. Document Identity
  if (currentFileId !== snapshot.fileId) {
    return {
      status: 'stale',
      reason: 'document-switched',
      message: 'The active document was changed.',
      snapshotPos,
      currentCursorPos,
    }
  }

  // 2. Position boundaries
  const docSize = currentDoc.content.size
  if (snapshotPos < 0 || snapshotPos > docSize) {
    return {
      status: 'stale',
      reason: 'invalid-position',
      message: 'Cursor position is outside document boundaries.',
      snapshotPos,
      currentCursorPos,
      suggestedFallbackPos: Math.max(0, Math.min(docSize, snapshotPos)),
    }
  }

  // 3. Cursor movement check
  if (currentCursorPos !== undefined && currentCursorPos !== snapshotPos) {
    return {
      status: 'stale',
      reason: 'cursor-moved',
      message: 'The cursor moved from its original position.',
      snapshotPos,
      currentCursorPos,
      suggestedFallbackPos: currentCursorPos,
    }
  }

  // 4. Surrounding context check
  const prefixStart = Math.max(0, snapshotPos - snapshot.surroundingContext.prefixOffset)
  if (snapshotPos - prefixStart !== snapshot.surroundingContext.prefixOffset) {
    return {
      status: 'stale',
      reason: 'context-changed',
      message: 'The text surrounding the cursor was modified.',
      snapshotPos,
      currentCursorPos,
    }
  }

  const currentPrefix = currentDoc.textBetween(
    prefixStart,
    snapshotPos,
    '\n',
  )

  const suffixEnd = Math.min(docSize, snapshotPos + snapshot.surroundingContext.suffixOffset)
  if (suffixEnd - snapshotPos !== snapshot.surroundingContext.suffixOffset) {
    return {
      status: 'stale',
      reason: 'context-changed',
      message: 'The text surrounding the cursor was modified.',
      snapshotPos,
      currentCursorPos,
    }
  }

  const currentSuffix = currentDoc.textBetween(
    snapshotPos,
    suffixEnd,
    '\n',
  )

  if (
    currentPrefix !== snapshot.surroundingContext.prefix ||
    currentSuffix !== snapshot.surroundingContext.suffix
  ) {
    return {
      status: 'stale',
      reason: 'context-changed',
      message: 'The text surrounding the cursor was modified.',
      snapshotPos,
      currentCursorPos,
    }
  }

  // 5. Strict Document Object Identity Check
  if (currentDoc !== snapshot.doc) {
    return {
      status: 'stale',
      reason: 'document-modified',
      message: 'The document was edited after the request was created.',
      snapshotPos,
      currentCursorPos,
    }
  }

  return {
    status: 'valid',
    targetPos: snapshotPos,
  }
}

/**
 * Validates a selection snapshot and prepares a safe TipTap insertion plan.
 * Returns { valid: true, plan } if safe to apply via TipTap transaction.
 * Returns { valid: false, validation } with stale reason if document/selection changed.
 */
export function validateAndPrepareSelectionInsertion(
  editor: Editor,
  fileId: string,
  snapshot: SelectionSnapshot,
  actionId: GenerativeActionId,
  proposedText: string,
): { valid: true; plan: GenerativeInsertionPlan } | { valid: false; validation: SelectionValidationResult } {
  const validation = validateSelectionSnapshot(fileId, editor.state.doc, snapshot)
  if (validation.status !== 'valid') {
    return { valid: false, validation }
  }

  const plan = prepareContentForInsertion(
    editor.state.doc,
    actionId,
    'selected',
    validation.targetRange,
    proposedText,
  )

  return { valid: true, plan }
}

/**
 * Validates a cursor snapshot and prepares a safe TipTap insertion plan.
 * Returns { valid: true, plan } if safe to apply via TipTap transaction.
 * Returns { valid: false, validation } with stale reason if document/cursor changed.
 */
export function validateAndPrepareCursorInsertion(
  editor: Editor,
  fileId: string,
  snapshot: CursorSnapshot,
  actionId: GenerativeActionId,
  proposedText: string,
): { valid: true; plan: GenerativeInsertionPlan } | { valid: false; validation: CursorValidationResult } {
  const currentCursorPos = editor.state.selection.empty ? editor.state.selection.from : undefined
  const validation = validateCursorSnapshot(fileId, editor.state.doc, currentCursorPos, snapshot)
  if (validation.status !== 'valid') {
    return { valid: false, validation }
  }

  const plan = prepareContentForInsertion(
    editor.state.doc,
    actionId,
    'selected',
    { from: validation.targetPos, to: validation.targetPos },
    proposedText,
  )

  return { valid: true, plan }
}
